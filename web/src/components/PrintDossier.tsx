"use client";

import { useEffect, useState } from "react";
import type { SchemeDetail } from "@/lib/types";

type Props = {
  scheme: SchemeDetail;
  citizenDetails: [string, string][];
  documentsToObtain: string[];
  isHealthcare: boolean;
};

const OWNED_DOCUMENTS = ["Aadhaar card", "Smart Ration Card"];

export default function PrintDossier({
  scheme,
  citizenDetails,
  documentsToObtain,
  isHealthcare,
}: Props) {
  const [checkedState, setCheckedState] = useState<Record<string, boolean>>({});
  const [effectiveCitizenDetails, setEffectiveCitizenDetails] = useState<[string, string][]>(citizenDetails);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("namma_profile") || localStorage.getItem("namma_profile");
      if (stored) {
        const p = JSON.parse(stored);
        setEffectiveCitizenDetails((prev) => {
          const map = new Map<string, string>(prev);
          if (p.state && !map.has("State")) map.set("State", p.state);
          if (p.district && !map.has("District")) map.set("District", p.district);
          if (p.age && !map.has("Age")) map.set("Age", `${p.age} years`);
          if (p.income_annual && !map.has("Income") && !map.has("Annual Income")) {
            const num = Number(p.income_annual);
            const formatted =
              num <= 100000
                ? "Below ₹1,00,000 / year"
                : num <= 250000
                ? "₹1,00,000 - ₹2,50,000 / year"
                : num <= 500000
                ? "₹2,50,000 - ₹5,00,000 / year"
                : `₹${num.toLocaleString("en-IN")} / year`;
            map.set("Income", formatted);
          }
          const need = p.condition || p.general_need || p.medical_need || p.education_need;
          if (need && !map.has("Need") && !map.has("Condition / Need")) {
            map.set("Need", String(need));
          }
          return Array.from(map.entries());
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    // Read user's live interactive checkbox state from localStorage
    const syncFromStorage = () => {
      try {
        const stored = localStorage.getItem(`namma_checklist_${scheme.slug}`);
        if (stored) {
          setCheckedState(JSON.parse(stored));
        }
      } catch {}
    };

    syncFromStorage();

    const handleUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Record<string, boolean>>;
      if (customEvent.detail) {
        setCheckedState(customEvent.detail);
      }
    };

    window.addEventListener("namma-checklist-updated", handleUpdate);
    window.addEventListener("beforeprint", syncFromStorage);
    return () => {
      window.removeEventListener("namma-checklist-updated", handleUpdate);
      window.removeEventListener("beforeprint", syncFromStorage);
    };
  }, [scheme.slug]);

  const schemeName = scheme.scheme_name.replace(/<[^>]+>/g, "");
  const shortTitle = scheme.short_title?.replace(/<[^>]+>/g, "");
  const levelLabel =
    scheme.level === "Central"
      ? "Central Government"
      : scheme.state
      ? `${scheme.state} State Government`
      : scheme.level;

  return (
    <div className="hidden print:block print:w-full print:text-black print:bg-white text-xs leading-tight font-sans">
      {/* Official Government Dossier Header */}
      <div className="border-b-2 border-slate-900 pb-2 mb-3 flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-700">
            Government of India &amp; Government of Tamil Nadu
          </p>
          <h1 className="text-lg font-extrabold text-slate-950 uppercase tracking-tight">
            Namma-Urimai (நம் உரிமை) · Official Scheme Application Brief
          </h1>
          <p className="text-[10px] text-slate-600">
            Verified Active Welfare Program · Source: myscheme.gov.in · Generated for Citizen Records
          </p>
        </div>
        <div className="text-right text-[10px] text-slate-700">
          <p className="font-bold">Official Application Checklist</p>
          <p>Print / PDF Record</p>
        </div>
      </div>

      {/* Scheme Title & Sponsoring Authority */}
      <div className="bg-slate-100/90 border border-slate-300 rounded p-2.5 mb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-950">
              {schemeName} {shortTitle ? `(${shortTitle})` : ""}
            </h2>
            <p className="text-[11px] text-slate-700 mt-0.5">
              <strong>Sponsoring Authority:</strong> {levelLabel}
              {scheme.ministry ? ` · ${scheme.ministry.replace(/<[^>]+>/g, "")}` : ""}
              {scheme.department ? ` · ${scheme.department.replace(/<[^>]+>/g, "")}` : ""}
            </p>
          </div>
          {scheme.dbt_scheme && (
            <span className="shrink-0 border border-slate-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
              Direct Benefit Transfer (DBT)
            </span>
          )}
        </div>
      </div>

      {/* Citizen Verified Profile Grid (if available) */}
      {effectiveCitizenDetails.length > 0 && (
        <div className="border border-slate-300 rounded p-2 mb-3 bg-slate-50/50">
          <p className="text-[10px] font-bold uppercase text-slate-800 tracking-wider mb-1">
            Citizen Application Profile:
          </p>
          <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
            {effectiveCitizenDetails.map(([key, val]) => (
              <div key={key}>
                <span className="text-slate-600 font-medium">{key}: </span>
                <span className="font-bold text-slate-900">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two-Column Printable Document Checklist (Reflects EXACT user checkbox state) */}
      <div className="border border-slate-300 rounded p-2.5 mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
          Mandatory Document Checklist:
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {/* Col 1: Documents You Already Have */}
          <div>
            <p className="font-bold text-[11px] text-slate-800 mb-1">
              1. Standard Documents You Have:
            </p>
            <ul className="space-y-1.5">
              {OWNED_DOCUMENTS.map((doc) => {
                const isChecked = !!checkedState[`have-${doc}`];
                return (
                  <li key={doc} className="flex items-center gap-1.5 text-[11px]">
                    <span className="inline-block w-4 h-4 border border-slate-900 text-center font-bold text-[10px] leading-3.5">
                      {isChecked ? "✓" : " "}
                    </span>
                    <span className={isChecked ? "font-semibold text-slate-950" : "text-slate-700"}>
                      {doc}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Col 2: Documents to Obtain */}
          <div>
            <p className="font-bold text-[11px] text-slate-800 mb-1">
              2. Specific Documents to Obtain:
            </p>
            {documentsToObtain.length === 0 ? (
              <p className="text-[11px] text-slate-600 italic">Standard personal identity documents apply.</p>
            ) : (
              <ul className="space-y-1.5">
                {documentsToObtain.map((doc) => {
                  const isChecked = !!checkedState[`obtain-${doc}`];
                  return (
                    <li key={doc} className="flex items-center gap-1.5 text-[11px]">
                      <span className="inline-block w-4 h-4 border border-slate-900 text-center font-bold text-[10px] leading-3.5">
                        {isChecked ? "✓" : " "}
                      </span>
                      <span className={isChecked ? "font-semibold text-slate-950" : "text-slate-700"}>
                        {doc}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Submission Roadmap Steps */}
      <div className="border border-slate-300 rounded p-2.5 mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-1.5 border-b border-slate-200 pb-1">
          Application Submission Roadmap:
        </h3>
        <ol className="grid grid-cols-3 gap-3 text-[10px] text-slate-800">
          <li className="border-r border-slate-200 pr-2">
            <strong className="block text-slate-950">Step 1: Document Prep</strong>
            Carry original identity cards, passbook &amp; photocopies.
          </li>
          <li className="border-r border-slate-200 pr-2">
            <strong className="block text-slate-950">
              {isHealthcare ? "Step 2: Hospital Verification" : "Step 2: Submission Center"}
            </strong>
            {isHealthcare
              ? "Approach Arogya Mitra at empaneled network hospital helpdesk."
              : "Submit application at designated government center or Tahsildar office."}
          </li>
          <li>
            <strong className="block text-slate-950">Step 3: Acknowledgement</strong>
            Always collect official stamped receipt with CAN / Application Number.
          </li>
        </ol>
      </div>

      {/* Official 24x7 Helplines Footer */}
      <div className="border-t border-slate-300 pt-2 flex items-center justify-between text-[10px] text-slate-700">
        <div>
          <span className="font-bold">Official Helplines (Toll-Free): </span>
          <span>108 (Emergency) · 104 (Health) · 14417 (Education) · 181 (Women in Distress) · 1100 (CM Helpline)</span>
        </div>
        <div className="font-mono text-[9px] text-slate-500">
          Namma-Urimai Citizen Dossier
        </div>
      </div>
    </div>
  );
}
