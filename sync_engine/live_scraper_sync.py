"""Live sync for the myscheme.gov.in scheme catalogue (PROJECT.md Section 4.3, Phase 3).

DRY-RUN BY DEFAULT. Without --apply this script discovers live slugs, fetches
detail and FAQ data, maps it to the CSV columns and prints a report. It writes
no CSV, no backup and nothing to the database.

With --apply, in this order:
  a. copy schemes.csv and schemes_faqs.csv byte-for-byte to timestamped backups;
  b. update changed rows in place, append new schemes to the bottom, and rewrite
     both CSVs atomically (temp file in the same directory, then os.replace);
  c. upsert the touched rows into public.schemes, then public.scheme_faqs.
     DATABASE_URL must be set in the environment; it is never hardcoded.

Usage (Windows):
  python sync_engine/live_scraper_sync.py           dry run, writes nothing
  python sync_engine/live_scraper_sync.py --apply   writes CSVs and database
  cmd:         set DATABASE_URL=postgresql://...
  PowerShell:  $env:DATABASE_URL="postgresql://..."
"""

import argparse
import csv
import http.client
import json
import os
import shutil
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCHEMES_CSV = PROJECT_ROOT / "schemes.csv"
FAQS_CSV = PROJECT_ROOT / "schemes_faqs.csv"
BATCH_SIZE = 500

API_BASE = "https://www.myscheme.gov.in/api/apisetu"
DISCOVERY_URL = API_BASE + "/search/schemes?lang=en&q=[]&keyword=&sort=&from={offset}&size={size}"
DETAIL_URL = API_BASE + "/schemes?slug={slug}&lang=en"
FAQS_URL = API_BASE + "/schemes/{scheme_id}/faqs?lang=en"
SOURCE_URL = "https://www.myscheme.gov.in/schemes/{slug}"

PAGE_SIZE = 100
MAX_OFFSET = 50000  # hard stop for discovery paging
WORKERS = 6
REQUEST_DELAY = 0.15
TIMEOUT_SECONDS = 30
MAX_RETRIES = 3
BACKOFF_BASE = 1.0
USER_AGENT = "Scheme-Baseline-Sync/1.0 (catalogue sync; contact the project owner)"

SCHEME_COLUMNS = [
    "slug", "scheme_name", "short_title", "level", "state", "ministry",
    "department", "beneficiary_type", "target_beneficiaries", "benefit_type",
    "categories", "sub_categories", "tags", "brief_description",
    "detailed_description", "benefits", "eligibility", "exclusions",
    "application_mode", "application_process", "documents_required",
    "references", "scheme_open_date", "scheme_close_date", "dbt_scheme",
    "faq_count", "source_url",
]
SCHEME_TYPES = {
    "scheme_open_date": "date",
    "scheme_close_date": "date",
    "dbt_scheme": "bool",
    "faq_count": "int",
}

FAQ_COLUMNS = ["scheme_slug", "scheme_name", "faq_number", "question", "answer"]
FAQ_TYPES = {"faq_number": "int"}

# Columns the API mapping does not fill. For these, an existing CSV value is kept.
UNMAPPED_COLUMNS = ("state", "exclusions", "documents_required")

TRUE_VALUES = {"true", "1", "yes"}
FALSE_VALUES = {"false", "0", "no"}
DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %b %Y", "%d %B %Y")

SCHEMES_SQL = (
    "INSERT INTO public.schemes ("
    + ", ".join(f'"{c}"' for c in SCHEME_COLUMNS)
    + ") VALUES ("
    + ", ".join(["%s"] * len(SCHEME_COLUMNS))
    + ") ON CONFLICT (slug) DO UPDATE SET "
    + ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in SCHEME_COLUMNS if c != "slug")
    + ", updated_at = NOW()"
)

FAQS_SQL = (
    "INSERT INTO public.scheme_faqs (scheme_slug, scheme_name, faq_number, question, answer) "
    "VALUES (%s, %s, %s, %s, %s) "
    "ON CONFLICT (scheme_slug, faq_number) DO UPDATE SET "
    "scheme_name = EXCLUDED.scheme_name, question = EXCLUDED.question, "
    "answer = EXCLUDED.answer, updated_at = NOW()"
)

UNCERTAIN_MAPPINGS = [
    "state: no API field mapped; existing value kept, blank for new schemes",
    "exclusions: no API field mapped; existing value kept, blank for new schemes",
    "documents_required: documents endpoint NOT implemented; existing value kept, blank for new schemes",
    "beneficiary_type: taken from basicDetails.schemeFor; target_beneficiaries from targetBeneficiaries labels",
    "level: label text of basicDetails.level is used as-is (expected 'Central' / 'State/ UT')",
    "application_mode: applicationProcess[].mode values joined with '; ' (actual values unverified)",
    "benefits / eligibility: markdown bullets converted to ' | ' / '; ' separators; other markdown kept",
    "brief_description / detailed_description: whitespace collapsed to one line; markdown syntax kept",
    "scheme_open_date / scheme_close_date: several date formats tried; DD/MM vs MM/DD ambiguity; unparseable values keep the existing value and are counted",
    "references: URLs only; link titles dropped",
    "faq answers: answer_md kept as raw text; questions/answers are stripped of outer whitespace",
    "faq_number: original 1-based position in the API FAQ list, so skipped FAQs leave gaps",
]


class DataError(Exception):
    """A CSV value that cannot be converted, or a CSV that does not match its schema."""


class FetchError(Exception):
    """An API request that failed after all retries."""


# ---------------------------------------------------------------------------
# Value conversion (copied from sync_engine/db_ingest_baseline.py)
# ---------------------------------------------------------------------------

def convert_value(column, raw, types, row_number, file_name):
    """Convert one raw CSV string to the Python value for its column.

    Empty strings become NULL (None). Columns without an entry in ``types``
    are TEXT and are returned unchanged.
    """
    kind = types.get(column)
    if kind is None:
        return raw if raw != "" else None

    stripped = raw.strip()
    if stripped == "":
        return None

    if kind == "date":
        try:
            return date.fromisoformat(stripped)
        except ValueError:
            raise DataError(
                f"{file_name} data row {row_number}, column {column}: "
                f"cannot parse {raw!r} as a DATE (expected YYYY-MM-DD)"
            )
    if kind == "bool":
        lowered = stripped.lower()
        if lowered in TRUE_VALUES:
            return True
        if lowered in FALSE_VALUES:
            return False
        raise DataError(
            f"{file_name} data row {row_number}, column {column}: "
            f"cannot parse {raw!r} as a BOOLEAN (expected true/false, 1/0 or yes/no)"
        )
    if kind == "int":
        try:
            return int(stripped)
        except ValueError:
            raise DataError(
                f"{file_name} data row {row_number}, column {column}: "
                f"cannot parse {raw!r} as an INTEGER"
            )
    raise DataError(f"internal error: unknown type {kind!r} for column {column}")


def convert_row(columns, row, types, row_number, file_name):
    return tuple(
        convert_value(column, raw, types, row_number, file_name)
        for column, raw in zip(columns, row)
    )


def load_batches(conn, label, sql, rows):
    """Upsert rows in batches of BATCH_SIZE, committing after each batch."""
    total = 0
    with conn.cursor() as cur:
        for start in range(0, len(rows), BATCH_SIZE):
            batch = rows[start:start + BATCH_SIZE]
            cur.executemany(sql, batch)
            conn.commit()
            total += len(batch)
            print(f"{label}: batch committed, running count {total} / {len(rows)}")
    return total


# ---------------------------------------------------------------------------
# HTTP with politeness and retries
# ---------------------------------------------------------------------------

def fetch_json(url):
    request = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"}
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"unexpected payload type {type(payload).__name__}")
    if payload.get("statusCode", 200) != 200:
        raise ValueError(f"API statusCode {payload.get('statusCode')}")
    return payload


def get_json(url):
    """GET a JSON document. Sleeps before every attempt; retries with backoff."""
    last_error = None
    for attempt in range(MAX_RETRIES + 1):
        if attempt:
            time.sleep(BACKOFF_BASE * (2 ** (attempt - 1)))
        time.sleep(REQUEST_DELAY)
        try:
            return fetch_json(url)
        except (OSError, ValueError, http.client.HTTPException) as exc:
            last_error = exc
    raise FetchError(f"{url} failed after {MAX_RETRIES + 1} attempts: {last_error}")


def discover_slugs():
    """Page through the search API until an empty page or the reported total."""
    slugs = []
    seen = set()
    offset = 0
    total = None
    while offset <= MAX_OFFSET:
        payload = get_json(DISCOVERY_URL.format(offset=offset, size=PAGE_SIZE))
        hits = payload["data"]["hits"]
        if total is None:
            total = (hits.get("page") or {}).get("total")
        items = hits.get("items") or []
        if not items:
            break
        for item in items:
            slug = ((item or {}).get("fields") or {}).get("slug")
            if slug and slug not in seen:
                seen.add(slug)
                slugs.append(slug)
        offset += PAGE_SIZE
        if total is not None and offset >= total:
            break
    return slugs, total


def fetch_all(slugs):
    """Fetch detail + FAQs for each slug with WORKERS threads.

    Returns (fetched, failed): fetched maps slug -> {"data", "faqs"};
    failed maps slug -> error text.
    """
    def work(slug):
        try:
            detail = get_json(DETAIL_URL.format(slug=urllib.parse.quote(slug)))
            data = detail.get("data")
            if not isinstance(data, dict):
                raise ValueError(f"{slug}: detail data is null")
            if not isinstance(data.get("en"), dict):
                raise ValueError(f"{slug}: detail data.en is null")
            scheme_id = data.get("_id")
            if scheme_id is None:
                raise ValueError(f"{slug}: detail _id is missing")
            faq_payload = get_json(
                FAQS_URL.format(scheme_id=urllib.parse.quote(str(scheme_id)))
            )
            faq_data = faq_payload.get("data")
            if not isinstance(faq_data, dict):
                raise ValueError(f"{slug}: FAQ data is null")
            faq_en = faq_data.get("en")
            if not isinstance(faq_en, dict):
                raise ValueError(f"{slug}: FAQ data.en is null")
            faqs = faq_en.get("faqs") or []
            if not isinstance(faqs, list):
                faqs = []
            return slug, {"data": data, "faqs": faqs}, None
        except Exception as exc:  # recorded as a failed slug, run continues
            return slug, None, f"{type(exc).__name__}: {exc}"

    fetched = {}
    failed = {}
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = [pool.submit(work, slug) for slug in slugs]
        for count, future in enumerate(as_completed(futures), start=1):
            slug, result, error = future.result()
            if error is None:
                fetched[slug] = result
            else:
                failed[slug] = error
            if count % 500 == 0 or count == len(slugs):
                print(f"progress: {count} / {len(slugs)} slugs processed")
    return fetched, failed


# ---------------------------------------------------------------------------
# Mapping API response -> CSV columns
# ---------------------------------------------------------------------------

def as_dict(value):
    """Return value if it is a dict, otherwise an empty dict (optional API sections)."""
    return value if isinstance(value, dict) else {}


def clean(value):
    return "" if value is None else str(value).strip()


def collapse(value):
    return "" if value is None else " ".join(str(value).split())


def label_of(obj):
    return clean(obj.get("label")) if isinstance(obj, dict) else ""


def labels_joined(seq):
    return "; ".join(label_of(x) for x in (seq or []) if label_of(x))


def strings_joined(seq):
    return "; ".join(clean(x) for x in (seq or []) if clean(x))


def bullet_lines(md):
    lines = []
    for line in str(md or "").splitlines():
        text = line.strip()
        if text.startswith(("- ", "* ")):
            text = text[2:].strip()
        if text:
            lines.append(text)
    return lines


def benefits_pipe(md):
    """Convention from schemes.csv: '- item | - item'."""
    return " | ".join("- " + line for line in bullet_lines(md))


def eligibility_semicolon(md):
    """Convention from schemes.csv: 'sentence; sentence'."""
    return "; ".join(bullet_lines(md))


def normalise_date(raw):
    """'' when the API has no date, YYYY-MM-DD when parsed, None when unparseable."""
    text = clean(raw)
    if not text:
        return ""
    for candidate in (text, text[:10]):
        for fmt in DATE_FORMATS:
            try:
                return datetime.strptime(candidate, fmt).date().isoformat()
            except ValueError:
                pass
    return None


def bool_text(value):
    """Convention from schemes.csv: 'True' / 'False'; null -> blank."""
    if value is True:
        return "True"
    if value is False:
        return "False"
    return ""


def map_scheme(slug, data, faq_total):
    """Map one detail response to a dict keyed by CSV column.

    A value of None means 'not mapped from the API': the existing CSV value is
    kept. An empty string means the API has no value and overwrites the CSV.
    """
    en = data.get("en") or {}
    basic = as_dict(en.get("basicDetails"))
    content = as_dict(en.get("schemeContent"))
    eligibility = as_dict(en.get("eligibilityCriteria"))
    process = [p for p in (en.get("applicationProcess") or []) if isinstance(p, dict)]
    references = [r for r in (content.get("references") or []) if isinstance(r, dict)]
    return {
        "slug": slug,
        "scheme_name": clean(basic.get("schemeName")),
        "short_title": clean(basic.get("schemeShortTitle")),
        "level": label_of(basic.get("level")),
        "state": None,
        "ministry": label_of(basic.get("nodalMinistryName")),
        "department": label_of(basic.get("nodalDepartmentName")),
        "beneficiary_type": clean(basic.get("schemeFor")),
        "target_beneficiaries": labels_joined(basic.get("targetBeneficiaries")),
        "benefit_type": label_of(content.get("benefitTypes")),
        "categories": labels_joined(basic.get("schemeCategory")),
        "sub_categories": labels_joined(basic.get("schemeSubCategory")),
        "tags": strings_joined(basic.get("tags")),
        "brief_description": collapse(content.get("briefDescription")),
        "detailed_description": collapse(content.get("detailedDescription_md")),
        "benefits": benefits_pipe(content.get("benefits_md")),
        "eligibility": eligibility_semicolon(eligibility.get("eligibilityDescription_md")),
        "exclusions": None,
        "application_mode": strings_joined(p.get("mode") for p in process),
        "application_process": " | ".join(
            text for text in (collapse(p.get("process_md")) for p in process) if text
        ),
        "documents_required": None,
        "references": "; ".join(
            clean(r.get("url")) for r in references if clean(r.get("url"))
        ),
        "scheme_open_date": normalise_date(basic.get("schemeOpenDate")),
        "scheme_close_date": normalise_date(basic.get("schemeCloseDate")),
        "dbt_scheme": bool_text(basic.get("dbtScheme")),
        "faq_count": str(faq_total),
        "source_url": SOURCE_URL.format(slug=slug),
    }


def map_faqs(scheme_slug, scheme_name, faqs):
    """Return (kept_rows, skipped_empty_answer, skipped_empty_question)."""
    kept = []
    skipped_answer = 0
    skipped_question = 0
    for position, faq in enumerate(faqs, start=1):
        faq = faq if isinstance(faq, dict) else {}
        question = clean(faq.get("question"))
        answer = clean(faq.get("answer_md"))
        if not answer:
            skipped_answer += 1
        elif not question:
            skipped_question += 1
        else:
            kept.append([scheme_slug, scheme_name, str(position), question, answer])
    return kept, skipped_answer, skipped_question


def merged_scheme_row(mapped, existing_row):
    existing = dict(zip(SCHEME_COLUMNS, existing_row)) if existing_row else {}
    out = []
    for column in SCHEME_COLUMNS:
        value = mapped.get(column)
        if value is None:
            value = existing.get(column, "")
        out.append(value)
    return out


# ---------------------------------------------------------------------------
# CSV read/write
# ---------------------------------------------------------------------------

def read_existing(path, columns):
    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        header = next(reader, None)
        if header != columns:
            raise DataError(
                f"{path.name}: header does not match the expected columns.\n"
                f"  expected: {columns}\n  found:    {header}"
            )
        rows = []
        for row_number, record in enumerate(reader, start=1):
            if not record:
                continue
            if len(record) != len(columns):
                raise DataError(
                    f"{path.name} data row {row_number}: expected {len(columns)} fields, "
                    f"found {len(record)}"
                )
            rows.append(record)
    return rows


def line_ending(path):
    with path.open("rb") as handle:
        head = handle.read(8192)
    return "\r\n" if b"\r\n" in head else "\n"


def write_csv_atomic(path, header, rows, line_end):
    fd, tmp_name = tempfile.mkstemp(dir=str(path.parent), prefix=path.stem + ".", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", newline="", encoding="utf-8") as handle:
            writer = csv.writer(handle, lineterminator=line_end)
            writer.writerow(header)
            writer.writerows(rows)
        os.replace(tmp_name, path)
    except BaseException:
        if os.path.exists(tmp_name):
            os.remove(tmp_name)
        raise


def shorten(value, width=120):
    text = str(value)
    return text if len(text) <= width else text[: width - 3] + "..."


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Sync live myscheme.gov.in schemes into the CSVs and database. "
        "Dry run unless --apply is given."
    )
    parser.add_argument(
        "--apply", action="store_true",
        help="write backups, CSVs and the database (default: dry run, writes nothing)",
    )
    parser.add_argument(
        "--db-only", action="store_true",
        help="with --apply: write the database only; leave the CSVs and backups untouched",
    )
    args = parser.parse_args()
    if args.db_only and not args.apply:
        parser.error("--db-only requires --apply; nothing was written.")
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    database_url = os.environ.get("DATABASE_URL")
    psycopg = None
    if args.apply:
        if not database_url:
            print(
                "ERROR: environment variable DATABASE_URL is not set. "
                "Set it to your PostgreSQL connection string and re-run. Nothing was written.",
                file=sys.stderr,
            )
            return 1
        try:
            import psycopg as psycopg_module
        except ImportError:
            print("ERROR: psycopg is not installed. Nothing was written.", file=sys.stderr)
            return 1
        psycopg = psycopg_module

    if args.db_only:
        mode_text = "APPLY DB-ONLY (CSVs and backups untouched)"
    elif args.apply:
        mode_text = "APPLY (writes backups, CSVs and database)"
    else:
        mode_text = "DRY RUN (nothing will be written)"
    print("Mode: " + mode_text)

    try:
        existing_scheme_rows = read_existing(SCHEMES_CSV, SCHEME_COLUMNS)
        existing_faq_rows = read_existing(FAQS_CSV, FAQ_COLUMNS)
    except (DataError, OSError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1
    existing_by_slug = {}
    for row in existing_scheme_rows:
        if row[0] in existing_by_slug:
            print(f"ERROR: duplicate slug in schemes.csv: {row[0]}. Nothing was written.",
                  file=sys.stderr)
            return 1
        existing_by_slug[row[0]] = row

    try:
        live_slugs, api_total = discover_slugs()
    except (FetchError, KeyError, TypeError, ValueError) as exc:
        print(f"ERROR: slug discovery failed; nothing was written: {exc}", file=sys.stderr)
        return 1

    new_slugs = [s for s in live_slugs if s not in existing_by_slug]
    print(f"Live slugs discovered: {len(live_slugs)} (API reports total {api_total})")
    print(f"  new (not in schemes.csv): {len(new_slugs)}")
    print(f"  existing (in schemes.csv): {len(live_slugs) - len(new_slugs)}")
    print(f"Local schemes.csv rows not seen live (left untouched): "
          f"{len([s for s in existing_by_slug if s not in set(live_slugs)])}")

    fetched, failed = fetch_all(live_slugs)
    ordered = [s for s in live_slugs if s in fetched]

    scheme_final = {}
    faq_final = {}
    faq_skipped_answer = 0
    faq_skipped_question = 0
    unparsed_dates = 0
    for slug in ordered:
        data = fetched[slug]["data"]
        faqs = fetched[slug]["faqs"]
        mapped = map_scheme(slug, data, len(faqs))
        if mapped["scheme_open_date"] is None or mapped["scheme_close_date"] is None:
            unparsed_dates += 1
        merged = merged_scheme_row(mapped, existing_by_slug.get(slug))
        scheme_name = merged[SCHEME_COLUMNS.index("scheme_name")]
        kept, skip_a, skip_q = map_faqs(slug, scheme_name, faqs)
        scheme_final[slug] = merged
        faq_final[slug] = kept
        faq_skipped_answer += skip_a
        faq_skipped_question += skip_q

    # Build the new CSV contents in memory.
    new_schemes_out = []
    for row in existing_scheme_rows:
        new_schemes_out.append(scheme_final[row[0]] if row[0] in scheme_final else row)
    for slug in ordered:
        if slug not in existing_by_slug:
            new_schemes_out.append(scheme_final[slug])

    refreshed = {slug: rows for slug, rows in faq_final.items() if rows}
    new_faqs_out = []
    emitted = set()
    for row in existing_faq_rows:
        slug = row[0]
        if slug in refreshed:
            if slug not in emitted:
                new_faqs_out.extend(refreshed[slug])
                emitted.add(slug)
            continue
        new_faqs_out.append(row)
    for slug in ordered:
        if slug in refreshed and slug not in emitted:
            new_faqs_out.extend(refreshed[slug])
            emitted.add(slug)

    touched_scheme_rows = [scheme_final[s] for s in ordered]
    touched_faq_rows = [row for s in ordered for row in refreshed.get(s, [])]

    # Report.
    updated_count = len([s for s in ordered if s in existing_by_slug])
    appended_count = len(ordered) - updated_count
    print(f"Fetched OK: {len(ordered)}   FAILED: {len(failed)}")
    print(f"schemes to update in place: {updated_count}   to append: {appended_count}")
    print(f"scheme_faqs rows to write: {len(touched_faq_rows)}   "
          f"skipped empty answers: {faq_skipped_answer}   "
          f"skipped empty questions: {faq_skipped_question}")
    if unparsed_dates:
        print(f"WARNING: {unparsed_dates} scheme(s) had a date that could not be parsed; "
              "the existing CSV value was kept for that date.")

    if not args.apply:
        print("\nSample mapped rows (first 3 successfully fetched slugs):")
        for slug in ordered[:3]:
            label = "UPDATE" if slug in existing_by_slug else "NEW"
            print(f"--- {slug} [{label}]")
            for column, value in zip(SCHEME_COLUMNS, scheme_final[slug]):
                print(f"  {column}: {shorten(value)}")
            print(f"  scheme_faqs rows: {len(faq_final[slug])}")

    print("\nFAILED slugs:")
    if failed:
        for slug in sorted(failed, key=lambda s: live_slugs.index(s)):
            print(f"  {slug}: {shorten(failed[slug], 200)}")
    else:
        print("  (none)")

    print("\nUNCERTAIN MAPPINGS:")
    for item in UNCERTAIN_MAPPINGS:
        print(f"  - {item}")

    if not args.apply:
        print("\nDry run complete. Nothing was written. Re-run with --apply to write.")
        return 0

    # Validate database values before any file is written.
    try:
        scheme_db_rows = [
            convert_row(SCHEME_COLUMNS, row, SCHEME_TYPES, i, SCHEMES_CSV.name)
            for i, row in enumerate(touched_scheme_rows, start=1)
        ]
        faq_db_rows = [
            convert_row(FAQ_COLUMNS, row, FAQ_TYPES, i, FAQS_CSV.name)
            for i, row in enumerate(touched_faq_rows, start=1)
        ]
    except DataError as exc:
        print(f"ERROR: {exc}. Nothing was written.", file=sys.stderr)
        return 1

    if not args.db_only:
        # a. Timestamped byte-for-byte backups.
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_schemes = PROJECT_ROOT / f"schemes_backup_{stamp}.csv"
        backup_faqs = PROJECT_ROOT / f"schemes_faqs_backup_{stamp}.csv"
        for source, destination in ((SCHEMES_CSV, backup_schemes), (FAQS_CSV, backup_faqs)):
            if destination.exists():
                print(f"ERROR: backup {destination.name} already exists; nothing was written.",
                      file=sys.stderr)
                return 1
            shutil.copyfile(source, destination)
            print(f"Backup written: {destination.name}")

        # b. Atomic CSV rewrite.
        write_csv_atomic(SCHEMES_CSV, SCHEME_COLUMNS, new_schemes_out, line_ending(SCHEMES_CSV))
        write_csv_atomic(FAQS_CSV, FAQ_COLUMNS, new_faqs_out, line_ending(FAQS_CSV))
        print(f"CSV written: {SCHEMES_CSV.name} ({len(new_schemes_out)} rows), "
              f"{FAQS_CSV.name} ({len(new_faqs_out)} rows)")

    # c. Database upserts: schemes first, then scheme_faqs.
    try:
        with psycopg.connect(database_url) as conn:
            load_batches(conn, "schemes", SCHEMES_SQL, scheme_db_rows)
            load_batches(conn, "scheme_faqs", FAQS_SQL, faq_db_rows)
    except psycopg.Error as exc:
        print(f"ERROR: database upsert failed: {exc}", file=sys.stderr)
        print("The CSVs were already rewritten; the backups hold the originals. "
              "Re-running with --apply is safe and retries the upsert.", file=sys.stderr)
        return 1

    print(f"Database upserted: {len(scheme_db_rows)} schemes, {len(faq_db_rows)} scheme_faqs rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
