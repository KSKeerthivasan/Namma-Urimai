"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { Printer, CheckCircle2 } from "lucide-react";

type Props = {
  slug?: string;
  documentsToObtain: string[];
};

const OWNED_DOCUMENTS = ["Aadhaar card", "Smart Ration Card"];

export default function DocumentChecklist({ slug = "default", documentsToObtain }: Props) {
  const { locale } = useLocale();
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  // Restore checked items from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`namma_checklist_${slug}`);
      if (stored) {
        setChecked(JSON.parse(stored));
      }
    } catch {}
  }, [slug]);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(`namma_checklist_${slug}`, JSON.stringify(next));
        window.dispatchEvent(new CustomEvent("namma-checklist-updated", { detail: next }));
      } catch {}
      return next;
    });
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F0F5F1] border border-[#D5E3D6] p-4 rounded-2xl text-xs text-[#132A1D] font-medium">
        <div className="space-y-1">
          <p className="font-bold text-[#132A1D]">
            Check off documents as you gather them. Your selections are automatically saved in your browser and mirrored in the PDF printout.
          </p>
          <p className="text-[11px] text-stone-600 font-medium">
            No login required — your document progress is maintained directly in your local browser.
          </p>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="print-hide shrink-0 inline-flex items-center gap-1.5 rounded-full bg-[#132A1D] px-4 py-2 font-bold text-white shadow-xs hover:bg-[#1E3A2B] transition-all cursor-pointer"
        >
          <Printer className="h-4 w-4" />
          <span>Save / Print PDF</span>
        </button>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-navy flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span>{t("doc_have", locale)}</span>
        </h3>
        <ul className="space-y-2">
          {OWNED_DOCUMENTS.map((doc) => {
            const key = `have-${doc}`;
            return (
              <li key={key}>
                <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 hover:border-blue-300 transition-all shadow-2xs">
                  <input
                    type="checkbox"
                    className="h-5 w-5 rounded accent-govtblue cursor-pointer"
                    checked={!!checked[key]}
                    onChange={() => toggle(key)}
                  />
                  <span className={`text-base ${checked[key] ? "line-through text-slate-500 font-medium" : "text-slate-900 font-semibold"}`}>
                    {doc}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-bold text-navy">{t("doc_obtain", locale)}</h3>
        {documentsToObtain.length === 0 ? (
          <p className="text-base text-slate-800">Standard personal identity documents apply.</p>
        ) : (
          <ul className="space-y-2">
            {documentsToObtain.map((doc) => {
              const key = `obtain-${doc}`;
              return (
                <li key={key}>
                  <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 hover:border-blue-300 transition-all shadow-2xs">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded accent-govtblue cursor-pointer"
                      checked={!!checked[key]}
                      onChange={() => toggle(key)}
                    />
                    <span className={`text-base ${checked[key] ? "line-through text-slate-500 font-medium" : "text-slate-900 font-semibold"}`}>
                      {doc}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Direct Action Button: Print/Save as PDF directly */}
      <div className="pt-2">
        <button
          type="button"
          onClick={handlePrint}
          className="print-hide inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#0F294A] px-6 py-3 font-bold text-white shadow-sm hover:bg-[#1E40AF] transition-all"
        >
          <Printer className="h-4 w-4" />
          <span>{t("doc_print", locale)}</span>
        </button>
      </div>
    </div>
  );
}
