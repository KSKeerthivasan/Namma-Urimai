"""Phase 2 of PROJECT.md Section 11: load the baseline CSVs into Supabase Postgres.

Loads schemes.csv into public.schemes first, then schemes_faqs.csv into
public.scheme_faqs, in batches of 500 rows using upserts. Expects the
DATABASE_URL environment variable to hold the PostgreSQL connection string;
no connection string, password or key is hardcoded here.
"""

import csv
import os
import sys
from datetime import date
from pathlib import Path

import psycopg

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCHEMES_CSV = PROJECT_ROOT / "schemes.csv"
FAQS_CSV = PROJECT_ROOT / "schemes_faqs.csv"
BATCH_SIZE = 500

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

TRUE_VALUES = {"true", "1", "yes"}
FALSE_VALUES = {"false", "0", "no"}

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


class DataError(Exception):
    """A CSV value that cannot be converted to its column type."""


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


def read_csv(path, columns, types, key_of):
    """Read a CSV fully into memory and return (rows, data_row_count, duplicate_count).

    Every value is converted before anything is written to the database, so a
    bad value fails the run before any load starts.
    """
    rows = []
    seen_keys = set()
    duplicate_count = 0

    with path.open(newline="", encoding="utf-8") as handle:
        reader = csv.reader(handle)
        header = next(reader, None)
        if header != columns:
            raise DataError(
                f"{path.name}: header does not match the expected columns.\n"
                f"  expected: {columns}\n  found:    {header}"
            )

        for row_number, record in enumerate(reader, start=1):
            if not record:
                # Skip fully blank lines; they carry no data.
                continue
            if len(record) != len(columns):
                raise DataError(
                    f"{path.name} data row {row_number}: expected {len(columns)} fields, "
                    f"found {len(record)}"
                )
            values = tuple(
                convert_value(column, raw, types, row_number, path.name)
                for column, raw in zip(columns, record)
            )
            key = key_of(values)
            if key in seen_keys:
                duplicate_count += 1
            else:
                seen_keys.add(key)
            rows.append(values)

    return rows, len(rows), duplicate_count


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


def skip_empty_answers(faq_rows):
    """Drop FAQ rows whose answer is empty after stripping whitespace.

    public.scheme_faqs.answer is NOT NULL, so these rows cannot be loaded.
    Each skipped row is printed. Returns (kept_rows, skipped_count).
    """
    kept = []
    skipped = 0
    for values in faq_rows:
        scheme_slug, _, faq_number, question, answer = values
        if answer is None or answer.strip() == "":
            short_question = (question or "")[:80]
            print(
                f"SKIPPED empty answer: scheme_slug={scheme_slug} "
                f"faq_number={faq_number} question={short_question}"
            )
            skipped += 1
        else:
            kept.append(values)
    return kept, skipped


def main() -> int:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print(
            "ERROR: environment variable DATABASE_URL is not set. "
            "Set it to your PostgreSQL connection string and re-run.",
            file=sys.stderr,
        )
        return 1

    try:
        scheme_rows, scheme_count, scheme_dups = read_csv(
            SCHEMES_CSV, SCHEME_COLUMNS, SCHEME_TYPES, key_of=lambda v: v[0]
        )
        faq_rows, faq_count, faq_dups = read_csv(
            FAQS_CSV, FAQ_COLUMNS, FAQ_TYPES, key_of=lambda v: (v[0], v[2])
        )
    except (DataError, OSError, StopIteration) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    faq_rows, faq_skipped = skip_empty_answers(faq_rows)
    print(f"scheme_faqs: skipped {faq_skipped} rows with empty answer")

    print(f"Read {scheme_count} data rows from {SCHEMES_CSV.name}")
    print(f"Read {faq_count} data rows from {FAQS_CSV.name}")
    if scheme_dups:
        print(
            f"WARNING: {scheme_dups} duplicate slug(s) in {SCHEMES_CSV.name}; "
            "the upsert keeps the last occurrence of each."
        )
    if faq_dups:
        print(
            f"WARNING: {faq_dups} duplicate (scheme_slug, faq_number) key(s) in "
            f"{FAQS_CSV.name}; the upsert keeps the last occurrence of each."
        )

    try:
        with psycopg.connect(database_url) as conn:
            load_batches(conn, "schemes", SCHEMES_SQL, scheme_rows)
            load_batches(conn, "scheme_faqs", FAQS_SQL, faq_rows)

            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) FROM public.schemes")
                db_schemes = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM public.scheme_faqs")
                db_faqs = cur.fetchone()[0]
    except psycopg.Error as exc:
        print(f"ERROR: database operation failed: {exc}", file=sys.stderr)
        return 1

    print(f"public.schemes row count: {db_schemes} (CSV data rows: {scheme_count})")
    print(f"public.scheme_faqs row count: {db_faqs} (CSV data rows: {faq_count})")
    print(
        f"scheme_faqs rows loaded: {len(faq_rows)} "
        f"(CSV data rows read: {faq_count}, skipped empty answers: {faq_skipped})"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
