import Link from "next/link";
import { notFound } from "next/navigation";
import SaveSchemeButton from "@/components/SaveSchemeButton";
import SchemeTabs from "@/components/SchemeTabs";
import PrintDossier from "@/components/PrintDossier";
import {
  buildQualifyRows,
  deadlineBadge,
  faqItems,
  isCoveredByOwnedDocs,
  rationCardLabel,
  splitBenefits,
  splitDocuments,
  splitParagraphs,
  stripMarkup,
  toList,
  type Criteria,
} from "@/lib/schemeDetail";
import { getSupabase } from "@/lib/supabaseClient";
import type { SchemeDetail, SchemeFaq } from "@/lib/types";

export const dynamic = "force-dynamic";

const SCHEME_COLUMNS = [
  "slug",
  "scheme_name",
  "short_title",
  "level",
  "state",
  "ministry",
  "department",
  "beneficiary_type",
  "target_beneficiaries",
  "benefit_type",
  "categories",
  "sub_categories",
  "tags",
  "brief_description",
  "detailed_description",
  "benefits",
  "eligibility",
  "exclusions",
  "application_mode",
  "application_process",
  "documents_required",
  "references",
  "scheme_open_date",
  "scheme_close_date",
  "dbt_scheme",
  "faq_count",
  "source_url",
].join(", ");

type PageProps = {
  params: { slug: string };
  searchParams: { [key: string]: string | string[] | undefined };
};

// First value of a query parameter, trimmed; null when absent or blank.
function firstParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : null;
}

// Healthcare-related schemes get the hospital cashless-treatment guide.
const HEALTHCARE_PATTERN = /health|medical|hospital|insurance|surgery|treatment/i;

const DEADLINE_CLASS = {
  soon: "bg-saffron text-navy",
  future: "bg-navy text-white",
  past: "bg-slate-200 text-slate-900",
} as const;

export default async function SchemeDetailPage({ params, searchParams }: PageProps) {
  const slug = params.slug;
  const supabase = getSupabase();

  const [schemeRes, faqRes] = await Promise.all([
    supabase.from("schemes").select(SCHEME_COLUMNS).eq("slug", slug).maybeSingle(),
    supabase
      .from("scheme_faqs")
      .select("faq_number, question, answer")
      .eq("scheme_slug", slug)
      .order("faq_number", { ascending: true }),
  ]);

  if (schemeRes.error || faqRes.error) {
    console.error("scheme detail query failed:", schemeRes.error ?? faqRes.error);
    throw new Error("Scheme details are temporarily unavailable");
  }
  if (!schemeRes.data) {
    notFound();
  }

  const scheme = schemeRes.data as unknown as SchemeDetail;
  const faqRows = (faqRes.data ?? []) as SchemeFaq[];

  const isHealthcare = HEALTHCARE_PATTERN.test(
    [
      ...toList(scheme.categories),
      ...toList(scheme.sub_categories),
      ...toList(scheme.tags),
      stripMarkup(scheme.scheme_name),
    ].join(" ")
  );

  const rawIncome = firstParam(searchParams.income);
  let displayIncome = rawIncome;
  if (rawIncome && /^\d+$/.test(rawIncome.trim())) {
    const num = parseInt(rawIncome.trim(), 10);
    displayIncome =
      num <= 100000
        ? "Below ₹1,00,000 / year"
        : num <= 250000
        ? "₹1,00,000 - ₹2,50,000 / year"
        : num <= 500000
        ? "₹2,50,000 - ₹5,00,000 / year"
        : `₹${num.toLocaleString("en-IN")} / year`;
  }

  const criteria: Criteria = {
    state: firstParam(searchParams.state),
    age: firstParam(searchParams.age),
    income: displayIncome,
    medicalNeed: firstParam(searchParams.medical_need),
    rationCard: firstParam(searchParams.ration_card),
  };

  const levelLabel =
    scheme.level === "Central"
      ? "Central Government"
      : scheme.state
        ? `${scheme.state} State Government`
        : scheme.level;
  const authorities = [levelLabel, scheme.ministry, scheme.department]
    .map((v) => stripMarkup(v))
    .filter(Boolean);

  const deadline = deadlineBadge(scheme.scheme_close_date);
  const canonical = `https://www.myscheme.gov.in/schemes/${scheme.slug}`;

  const citizenDetails: [string, string][] = [];
  if (criteria.state) citizenDetails.push(["State", criteria.state]);
  const district = firstParam(searchParams.district);
  if (district) citizenDetails.push(["District", district]);
  if (criteria.age) citizenDetails.push(["Age", criteria.age]);
  const card = rationCardLabel(criteria.rationCard);
  if (card) citizenDetails.push(["Ration card", card]);
  if (criteria.income) citizenDetails.push(["Income", criteria.income]);
  if (criteria.medicalNeed) citizenDetails.push(["Need", criteria.medicalNeed]);

  const shortTitle = stripMarkup(scheme.short_title);
  const schemeName = stripMarkup(scheme.scheme_name);

  const documentsToObtain = splitDocuments(scheme.documents_required).filter(
    (doc) => !isCoveredByOwnedDocs(doc)
  );

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        {/* Dedicated Clean Printable Government Dossier (Only visible on print) */}
        <PrintDossier
          scheme={scheme}
          citizenDetails={citizenDetails}
          documentsToObtain={documentsToObtain}
          isHealthcare={isHealthcare}
        />

        {/* Interactive Screen Layout (Hidden on Print) */}
        <div className="print:hidden space-y-6">
          <header className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <Link
              href="/"
              className="inline-flex min-h-[48px] items-center font-semibold text-govtblue underline underline-offset-4 hover:text-navy"
            >
              ← Back to search
            </Link>

            <h1 className="text-3xl font-bold text-navy">
              {schemeName}
              {shortTitle ? ` (${shortTitle})` : ""}
            </h1>

            <SaveSchemeButton
              scheme={{
                slug: scheme.slug,
                scheme_name: schemeName,
                short_title: shortTitle || null,
                level: scheme.level,
                state: scheme.state,
                scheme_close_date: scheme.scheme_close_date,
              }}
            />

            <div className="flex flex-wrap items-center gap-2">
              {authorities.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-navy px-3 py-1 text-sm font-semibold text-navy"
                >
                  {label}
                </span>
              ))}
              {scheme.dbt_scheme === true && (
                <span className="rounded-full bg-govtblue px-3 py-1 text-sm font-semibold text-white">
                  Direct bank transfer (DBT)
                </span>
              )}
              {deadline && (
                <span
                  className={`rounded-full px-3 py-1 text-sm font-bold ${DEADLINE_CLASS[deadline.tone]}`}
                >
                  {deadline.text}
                </span>
              )}
            </div>

            <div className="space-y-1 text-base text-slate-800">
              <p>
                <span className="rounded-full bg-forest px-3 py-1 text-sm font-bold text-navy">
                  Verified Active: November 2026
                </span>
              </p>
              <p>
                Official page:{" "}
                <a
                  href={canonical}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-semibold text-govtblue underline underline-offset-4"
                >
                  {canonical}
                </a>
              </p>
            </div>

            {citizenDetails.length > 0 && (
              <dl className="flex flex-wrap gap-x-6 gap-y-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-900">
                <dt className="sr-only">Your details</dt>
                {citizenDetails.map(([label, value]) => (
                  <div key={label} className="flex gap-1">
                    <dt className="font-semibold">{label}:</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </header>

          <SchemeTabs
            slug={scheme.slug}
            schemeName={schemeName}
            isHealthcare={isHealthcare}
            benefitParagraphs={splitParagraphs(scheme.detailed_description)}
            benefitItems={splitBenefits(scheme.benefits)}
            qualifyRows={buildQualifyRows(scheme, criteria)}
            documentsToObtain={documentsToObtain}
            faqs={faqItems(faqRows)}
          />
        </div>
      </div>
    </main>
  );
}
