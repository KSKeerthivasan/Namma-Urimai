"use client";

import { useId, useRef, useState, useEffect } from "react";
import DocumentChecklist from "@/components/DocumentChecklist";
import ApplicationRoadmap from "@/components/ApplicationRoadmap";
import HospitalRoadmap from "@/components/HospitalRoadmap";
import { useLocale } from "@/components/LocaleProvider";
import { t, type TranslationKey } from "@/lib/i18n";
import type { FaqItem, QualifyRow, QualifyStatus } from "@/lib/schemeDetail";

// All props are plain serialisable data. No functions cross the server/client boundary.
export type SchemeTabsProps = {
  slug?: string;
  schemeName: string;
  benefitParagraphs: string[];
  benefitItems: string[];
  qualifyRows: QualifyRow[];
  documentsToObtain: string[];
  faqs: FaqItem[];
  // Server decides this from the scheme's categories and name; the tab label follows it.
  isHealthcare: boolean;
};

type TabKey = "benefits" | "qualify" | "documents" | "steps" | "faqs";

const TABS: { key: TabKey; labelKey: TranslationKey }[] = [
  { key: "benefits", labelKey: "tab_benefits" },
  { key: "qualify", labelKey: "tab_qualify" },
  { key: "documents", labelKey: "tab_documents" },
  { key: "steps", labelKey: "tab_guide" },
  { key: "faqs", labelKey: "tab_faqs" },
];

const STATUS_CLASS: Record<QualifyStatus, string> = {
  Matches: "bg-forest text-navy",
  "Check required": "bg-saffron text-navy",
  "Not provided": "bg-slate-200 text-slate-900",
};

const NOT_AVAILABLE = "Not available on the portal listing.";

export default function SchemeTabs({
  slug,
  schemeName,
  benefitParagraphs,
  benefitItems,
  qualifyRows,
  documentsToObtain,
  faqs,
  isHealthcare,
}: SchemeTabsProps) {
  const { locale } = useLocale();
  const [active, setActive] = useState<TabKey>("benefits");
  const [effectiveQualifyRows, setEffectiveQualifyRows] = useState<QualifyRow[]>(qualifyRows);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const uid = useId();

  // Hydrate missing criteria from sessionStorage if available
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("namma_profile");
      if (stored) {
        const p = JSON.parse(stored);
        setEffectiveQualifyRows((prev) =>
          prev.map((row) => {
            if (row.criterion === "Income" && (row.citizenValue === "Not provided" || !row.citizenValue)) {
              if (p.income_annual) {
                const num = Number(p.income_annual);
                const formatted =
                  num <= 100000
                    ? "Below ₹1,00,000 / year"
                    : num <= 250000
                    ? "₹1,00,000 - ₹2,50,000 / year"
                    : num <= 500000
                    ? "₹2,50,000 - ₹5,00,000 / year"
                    : `₹${num.toLocaleString("en-IN")} / year`;
                return { ...row, citizenValue: formatted, status: "Matches" as QualifyStatus };
              }
            }
            if (row.criterion === "Condition / need" && (row.citizenValue === "Not provided" || !row.citizenValue)) {
              const need = p.condition || p.general_need || p.medical_need || p.education_need;
              if (need) {
                return { ...row, citizenValue: String(need), status: "Matches" as QualifyStatus };
              }
            }
            if (row.criterion === "Location" && (row.citizenValue === "Not provided" || !row.citizenValue)) {
              if (p.state) {
                return { ...row, citizenValue: p.district ? `${p.district}, ${p.state}` : String(p.state), status: "Matches" as QualifyStatus };
              }
            }
            if (row.criterion === "Age" && (row.citizenValue === "Not provided" || !row.citizenValue)) {
              if (p.age) {
                return { ...row, citizenValue: `${p.age} years`, status: "Matches" as QualifyStatus };
              }
            }
            return row;
          })
        );
      }
    } catch {}
  }, []);

  // Non-healthcare schemes get the general application roadmap instead of the hospital guide.
  const stepsLabel = t(isHealthcare ? "tab_guide" : "tab_roadmap", locale);
  const tabs = TABS.map((tab) => ({
    key: tab.key,
    label: tab.key === "steps" ? stepsLabel : t(tab.labelKey, locale),
  }));

  function activate(index: number) {
    const target = tabs[index];
    setActive(target.key);
    buttonRefs.current[index]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        activate((index + 1) % tabs.length);
        break;
      case "ArrowLeft":
        event.preventDefault();
        activate((index - 1 + tabs.length) % tabs.length);
        break;
      case "Home":
        event.preventDefault();
        activate(0);
        break;
      case "End":
        event.preventDefault();
        activate(tabs.length - 1);
        break;
      default:
        break;
    }
  }

  const tabId = (key: TabKey) => `${uid}-tab-${key}`;
  const panelId = (key: TabKey) => `${uid}-panel-${key}`;

  return (
    <section className="space-y-4">
      <p className="print-only text-xl font-bold text-navy">{schemeName}</p>

      <div
        role="tablist"
        aria-label="Scheme details"
        className="print-hide flex flex-wrap gap-2 border-b border-slate-300"
      >
        {tabs.map((tab, index) => {
          const selected = active === tab.key;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              type="button"
              role="tab"
              id={tabId(tab.key)}
              aria-selected={selected}
              aria-controls={panelId(tab.key)}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.key)}
              onKeyDown={(e) => onKeyDown(e, index)}
              className={`min-h-[48px] min-w-[48px] border-b-4 px-4 py-2 text-base font-semibold ${
                selected
                  ? "border-govtblue text-govtblue"
                  : "border-transparent text-slate-700 hover:text-navy"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Benefits & Coverage */}
      <div
        role="tabpanel"
        id={panelId("benefits")}
        aria-labelledby={tabId("benefits")}
        hidden={active !== "benefits"}
        tabIndex={0}
        className="space-y-6 rounded-xl border border-slate-200 bg-white p-6"
      >
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-navy">What the scheme covers</h2>
          {benefitParagraphs.length === 0 ? (
            <p className="text-base text-slate-800">{NOT_AVAILABLE}</p>
          ) : (
            benefitParagraphs.map((p, i) => (
              <p key={i} className="text-base leading-relaxed text-slate-900">
                {p}
              </p>
            ))
          )}
        </div>
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-navy">Benefits at a glance</h3>
          {benefitItems.length === 0 ? (
            <p className="text-base text-slate-800">{NOT_AVAILABLE}</p>
          ) : (
            <ul className="list-disc space-y-2 pl-6 text-base text-slate-900">
              {benefitItems.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Why You Qualify */}
      <div
        role="tabpanel"
        id={panelId("qualify")}
        aria-labelledby={tabId("qualify")}
        hidden={active !== "qualify"}
        tabIndex={0}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
      >
        <h2 className="text-xl font-bold text-navy">Why You Qualify</h2>
        <ul className="space-y-3">
          {effectiveQualifyRows.map((row) => (
            <li
              key={row.criterion}
              className="grid gap-2 rounded-lg border border-slate-200 p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-center"
            >
              <div>
                <p className="text-sm font-semibold text-slate-700">Criterion</p>
                <p className="text-base font-bold text-navy">{row.criterion}</p>
              </div>
              <div className="space-y-1">
                <p className="text-base text-slate-900">
                  <span className="font-semibold">Your details: </span>
                  {row.citizenValue}
                </p>
                <p className="text-base text-slate-900">
                  <span className="font-semibold">Scheme: </span>
                  {row.requirement}
                </p>
              </div>
              <span
                className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-bold ${STATUS_CLASS[row.status]}`}
              >
                {row.status}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-slate-700">
          This is a guide. Confirm eligibility on the official portal.
        </p>
      </div>

      {/* Document Checklist */}
      <div
        role="tabpanel"
        id={panelId("documents")}
        aria-labelledby={tabId("documents")}
        hidden={active !== "documents"}
        tabIndex={0}
        className="rounded-xl border border-slate-200 bg-white p-6"
      >
        <h2 className="mb-4 text-xl font-bold text-navy">{t("tab_documents", locale)}</h2>
        <DocumentChecklist slug={slug} documentsToObtain={documentsToObtain} />
      </div>

      {/* Step-by-Step Guide */}
      <div
        role="tabpanel"
        id={panelId("steps")}
        aria-labelledby={tabId("steps")}
        hidden={active !== "steps"}
        tabIndex={0}
        className="rounded-xl border border-slate-200 bg-white p-6"
      >
        <h2 className="mb-4 text-xl font-bold text-navy">{stepsLabel}</h2>
        {isHealthcare ? <HospitalRoadmap /> : <ApplicationRoadmap />}
      </div>

      {/* FAQs */}
      <div
        role="tabpanel"
        id={panelId("faqs")}
        aria-labelledby={tabId("faqs")}
        hidden={active !== "faqs"}
        tabIndex={0}
        className="space-y-3 rounded-xl border border-slate-200 bg-white p-6"
      >
        <h2 className="text-xl font-bold text-navy">Frequently Asked Questions</h2>
        {faqs.length === 0 ? (
          <p className="text-base text-slate-800">No FAQs are listed for this scheme yet.</p>
        ) : (
          faqs.map((faq, i) => (
            <details
              key={i}
              className="group rounded-lg border border-slate-200 bg-slate-50"
            >
              <summary className="flex min-h-[48px] cursor-pointer items-center px-4 py-2 text-base font-semibold text-navy">
                {faq.question}
              </summary>
              <p className="px-4 pb-4 text-base text-slate-900">{faq.answer}</p>
            </details>
          ))
        )}
      </div>
    </section>
  );
}
