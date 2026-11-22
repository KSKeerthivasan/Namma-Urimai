import type { RationCardCode } from "@/lib/types";

export type ChipKind = "card" | "education" | "farmer" | "pension" | "income";

export type ChipOption = {
  id: string;
  kind: ChipKind;
  label: string;
  keyword?: string; // Keyword passed to full-text search to narrow down results
  code?: RationCardCode; // Internal ration card code if applicable
  min?: number;
  max?: number;
};

// 1. Health & Medical Domain Chips
export const HEALTH_CHIPS: readonly ChipOption[] = [
  { id: "card-rice", kind: "card", label: "🍚 Rice Card (PHH)", code: "PHH", keyword: "cmchis" },
  { id: "card-sugar", kind: "card", label: "🍬 Sugar Card (NPHH)", code: "NPHH", keyword: "cmchis" },
  { id: "card-antyodaya", kind: "card", label: "🌾 Antyodaya (AAY)", code: "AAY", keyword: "cmchis" },
  { id: "card-none", kind: "card", label: "🚫 No Card", code: "None", keyword: "health insurance" },
];

// 2. Education & Scholarship Domain Chips (Narrows down to exact course/level)
export const SCHOLARSHIP_CHIPS: readonly ChipOption[] = [
  { id: "edu-college", kind: "education", label: "🎓 College / Degree (UG/PG)", keyword: "college university" },
  { id: "edu-school", kind: "education", label: "🎒 School (Class 1 - 12)", keyword: "school standard" },
  { id: "edu-diploma", kind: "education", label: "🛠️ Polytechnic / Diploma", keyword: "polytechnic diploma" },
  { id: "edu-girl", kind: "education", label: "👩‍🎓 Girl Student (Pudhumaipen)", keyword: "girl student" },
  { id: "edu-differently-abled", kind: "education", label: "♿ Special Needs / Differently Abled", keyword: "differently abled" },
];

// 3. Farmers & Agriculture Domain Chips
export const FARMER_CHIPS: readonly ChipOption[] = [
  { id: "farm-small", kind: "farmer", label: "🌾 Small / Marginal Farmer (< 2 Ha)", keyword: "small farmer" },
  { id: "farm-irrigation", kind: "farmer", label: "💧 Drip & Micro Irrigation", keyword: "micro irrigation" },
  { id: "farm-machinery", kind: "farmer", label: "🚜 Tractor & Farm Machinery", keyword: "machinery" },
  { id: "farm-dairy", kind: "farmer", label: "🐄 Dairy & Cattle Subsidy", keyword: "dairy animal husbandry" },
];

// 4. Senior Citizen & Pension Domain Chips
export const PENSION_CHIPS: readonly ChipOption[] = [
  { id: "pen-oap", kind: "pension", label: "👴 Old Age Pension (60+ Years)", keyword: "old age" },
  { id: "pen-widow", kind: "pension", label: "👩 Destitute Widow Pension", keyword: "widow" },
  { id: "pen-disability", kind: "pension", label: "♿ Disability Pension", keyword: "differently abled disability" },
];

export const CARD_CHIPS = HEALTH_CHIPS;

export const BENEFIT_TYPE_CODES: readonly string[] = [];
