"use client";

import { useState } from "react";
import type { DynamicChip } from "@/lib/types";
import { Sparkles, Edit3, ArrowRight } from "lucide-react";

type Props = {
  title?: string;
  chips?: DynamicChip[];
  onSelect: (chip: DynamicChip) => void;
};

export default function DynamicChips({ title, chips, onSelect }: Props) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState("");

  if (!chips || chips.length === 0) return null;

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = customValue.trim();
    if (!trimmed) return;
    onSelect({
      label: trimmed,
      narrowing_keyword: trimmed,
    });
    setCustomValue("");
    setShowCustomInput(false);
  }

  return (
    <section aria-label="Dynamic narrowing options" className="rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/90 p-4 shadow-sm border border-blue-200/90">
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
          <p className="text-sm font-bold text-[#0F294A]">{title}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {chips.map((chip, idx) => {
          const isOther = chip.label.toLowerCase().includes("other") || chip.narrowing_keyword.toLowerCase() === "other";
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (isOther) {
                  setShowCustomInput(true);
                } else {
                  onSelect(chip);
                }
              }}
              className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-all shadow-xs ${
                isOther
                  ? "border-dashed border-indigo-400 bg-white text-indigo-800 hover:bg-indigo-50"
                  : "border-blue-300 bg-white text-[#1E40AF] hover:bg-[#1E40AF] hover:text-white hover:border-[#1E40AF] hover:shadow-sm"
              }`}
            >
              {isOther && <Edit3 className="h-3.5 w-3.5 text-indigo-600" />}
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* Inline Custom Input for "Other" Options */}
      {showCustomInput && (
        <form onSubmit={handleCustomSubmit} className="mt-3 pt-3 border-t border-blue-200/80 flex items-center gap-2">
          <input
            type="text"
            autoFocus
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Type your state or specific detail (e.g. Kerala, ₹1.5 Lakhs)..."
            className="flex-1 rounded-xl border border-blue-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#1E40AF] focus:ring-2 focus:ring-blue-100 outline-none"
          />
          <button
            type="submit"
            disabled={!customValue.trim()}
            className="inline-flex min-h-[40px] items-center gap-1 rounded-xl bg-[#0F294A] px-4 py-2 text-sm font-bold text-white hover:bg-[#1E40AF] disabled:opacity-40 transition-all shadow-xs"
          >
            <span>Submit</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowCustomInput(false)}
            className="rounded-xl px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-all"
          >
            Cancel
          </button>
        </form>
      )}
    </section>
  );
}
