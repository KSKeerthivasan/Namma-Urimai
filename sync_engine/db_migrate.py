# DDL below is the Section 3 contract of PROJECT.md; "references" is quoted because it is a reserved word in PostgreSQL.
import os
import sys

import psycopg

DDL_STATEMENTS = [
    """
CREATE TABLE IF NOT EXISTS public.schemes (
    slug TEXT PRIMARY KEY, scheme_name TEXT NOT NULL, short_title TEXT, level TEXT, state TEXT, ministry TEXT, department TEXT, beneficiary_type TEXT, target_beneficiaries TEXT, benefit_type TEXT, categories TEXT, sub_categories TEXT, tags TEXT, brief_description TEXT, detailed_description TEXT, benefits TEXT, eligibility TEXT, exclusions TEXT, application_mode TEXT, application_process TEXT, documents_required TEXT, "references" TEXT, scheme_open_date DATE, scheme_close_date DATE, dbt_scheme BOOLEAN DEFAULT FALSE, faq_count INTEGER DEFAULT 0, source_url TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
""",
    "CREATE INDEX IF NOT EXISTS idx_schemes_state ON public.schemes(state);",
    "CREATE INDEX IF NOT EXISTS idx_schemes_level ON public.schemes(level);",
    "CREATE INDEX IF NOT EXISTS idx_schemes_benefit_type ON public.schemes(benefit_type);",
    "CREATE INDEX IF NOT EXISTS idx_schemes_fts ON public.schemes USING GIN (to_tsvector('english', coalesce(scheme_name, '') || ' ' || coalesce(brief_description, '') || ' ' || coalesce(categories, '') || ' ' || coalesce(tags, '') || ' ' || coalesce(benefits, '')));",
    """
CREATE TABLE IF NOT EXISTS public.scheme_faqs (
    scheme_slug TEXT NOT NULL REFERENCES public.schemes(slug) ON DELETE CASCADE, scheme_name TEXT NOT NULL, faq_number INTEGER NOT NULL, question TEXT NOT NULL, answer TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(), PRIMARY KEY (scheme_slug, faq_number)
);
""",
    "CREATE INDEX IF NOT EXISTS idx_scheme_faqs_slug ON public.scheme_faqs(scheme_slug);",
    "ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;",
    "ALTER TABLE public.scheme_faqs ENABLE ROW LEVEL SECURITY;",
    'DROP POLICY IF EXISTS "Public schemes read access" ON public.schemes;',
    'CREATE POLICY "Public schemes read access" ON public.schemes FOR SELECT USING (true);',
    'DROP POLICY IF EXISTS "Public scheme_faqs read access" ON public.scheme_faqs;',
    'CREATE POLICY "Public scheme_faqs read access" ON public.scheme_faqs FOR SELECT USING (true);',
]


def main() -> int:
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print(
            "ERROR: environment variable DATABASE_URL is not set. "
            "Set it to your PostgreSQL connection string and re-run.",
            file=sys.stderr,
        )
        return 1

    # psycopg's connection context manager runs everything in one transaction:
    # commit on clean exit, rollback on any exception.
    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            for statement in DDL_STATEMENTS:
                cur.execute(statement)

    print("Migration completed successfully: schemes and scheme_faqs schema applied.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
