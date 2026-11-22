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
    <section aria-label="Dynamic narrowing options" className="rounded-2xl bg-[#F0F5F1] p-4 shadow-2xs border border-[#D5E3D6]">
      {title && (
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-emerald-700 shrink-0" />
          <p className="text-sm font-bold text-[#132A1D]">{title}</p>
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
              className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                isOther
                  ? "border-dashed border-emerald-600/70 bg-white text-emerald-900 hover:bg-emerald-50"
                  : "border-stone-300 bg-white text-[#132A1D] hover:bg-[#132A1D] hover:text-white hover:border-[#132A1D] hover:shadow-xs"
              }`}
            >
              {isOther && <Edit3 className="h-3.5 w-3.5 text-emerald-700" />}
              <span>{chip.label}</span>
            </button>
          );
        })}
      </div>

      {/* Inline Custom Input for "Other" Options */}
      {showCustomInput && (
        <form onSubmit={handleCustomSubmit} className="mt-3 pt-3 border-t border-[#D5E3D6] flex items-center gap-2">
          <input
            type="text"
            autoFocus
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            placeholder="Type your state or specific detail (e.g. Kerala, ₹1.5 Lakhs)..."
            className="flex-1 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-[#132A1D] focus:ring-2 focus:ring-emerald-100 outline-none"
          />
          <button
            type="submit"
            disabled={!customValue.trim()}
            className="inline-flex min-h-[38px] items-center gap-1 rounded-full bg-[#132A1D] px-4 py-2 text-xs font-bold text-white hover:bg-[#1E3A2B] disabled:opacity-40 transition-all shadow-xs cursor-pointer"
          >
            <span>Submit</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setShowCustomInput(false)}
            className="rounded-full px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-200 transition-all cursor-pointer"
          >
            Cancel
          </button>
        </form>
      )}
    </section>
  );
}
