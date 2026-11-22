// Pure, server-safe helpers for the scheme detail page (/schemes/[slug]).
// Text is returned as plain strings only; nothing here produces HTML.

import type { SchemeDetail, SchemeFaq } from "@/lib/types";

export type QualifyStatus = "Matches" | "Check required" | "Not provided";

export type QualifyRow = {
  criterion: string;
  citizenValue: string;
  requirement: string;
  status: QualifyStatus;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type Criteria = {
  state: string | null;
  age: string | null;
  income: string | null;
  medicalNeed: string | null;
  rationCard: string | null;
};

export type DeadlineBadge = {
  tone: "soon" | "future" | "past";
  text: string;
};

// Removes markdown bold and heading markers, then trims.
export function stripMarkup(text: string | null | undefined): string {
  if (!text) return "";
  return text.replace(/\*\*/g, "").replace(/#/g, "").trim();
}

// Accepts a Postgres text[] (array) or a plain string; returns clean strings.
export function toList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => stripMarkup(String(v))).filter(Boolean);
  }
  if (typeof value === "string") {
    const cleaned = stripMarkup(value);
    return cleaned ? [cleaned] : [];
  }
  return [];
}

// Blank-line separated paragraphs; single newlines inside a paragraph become spaces.
export function splitParagraphs(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .split(/\n\s*\n/)
    .map((p) => stripMarkup(p).replace(/\s*\n\s*/g, " "))
    .filter(Boolean);
}

export function splitBenefits(text: string | null | undefined): string[] {
  return stripMarkup(text)
    .split(" | ")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function splitDocuments(text: string | null | undefined): string[] {
  return stripMarkup(text)
    .split("; ")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Documents the citizen already holds are shown in the "already have" list,
// so they are excluded from the "to obtain" list.
export function isCoveredByOwnedDocs(doc: string): boolean {
  return /aadhaar|ration\s*card/i.test(doc);
}

export function faqItems(rows: SchemeFaq[]): FaqItem[] {
  return rows
    .map((r) => ({
      question: stripMarkup(r.question),
      answer: stripMarkup(r.answer),
    }))
    .filter((f) => f.question.length > 0);
}

// Sentences (and lines) of an eligibility text, with markup removed.
function sentencesOf(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/(?<=[.;!?])\s+|\n+/)
    .map((s) => stripMarkup(s))
    .filter(Boolean);
}

function findSentence(text: string | null, pattern: RegExp): string | null {
  for (const s of sentencesOf(text)) {
    if (pattern.test(s)) return s;
  }
  return null;
}

const AGE_PATTERN =
  /\b(between\s+\d+\s+and\s+\d+|\d+\s*(?:to|-|–)\s*\d+\s*years?|(?:above|below|under|over|minimum|maximum)\s+(?:the\s+)?(?:age\s+of\s+)?\d+\s*years?)\b/i;

const INCOME_PATTERN = /income/i;

const RATION_CARD_LABELS: Record<string, string> = {
  PHH: "Rice Card",
  NPHH: "Sugar Card",
  AAY: "Antyodaya Card",
  None: "No Card",
};

export function rationCardLabel(code: string | null): string | null {
  if (!code) return null;
  return RATION_CARD_LABELS[code] ?? code;
}

// Rule rows for the "Why You Qualify" tab. Never marks a rule as satisfied:
// the best outcome is "Matches", which is only used for the central-scheme
// location rule (per spec) and an exact state match.
export function buildQualifyRows(
  scheme: Pick<SchemeDetail, "state" | "eligibility" | "categories">,
  c: Criteria
): QualifyRow[] {
  const rows: QualifyRow[] = [];

  // Location
  if (!scheme.state) {
    rows.push({
      criterion: "Location",
      citizenValue: c.state ?? "Not provided",
      requirement: "Central scheme, open to residents of any state",
      status: "Matches",
    });
  } else {
    let status: QualifyStatus;
    if (!c.state) status = "Not provided";
    else if (c.state.toLowerCase() === scheme.state.toLowerCase()) status = "Matches";
    else status = "Check required";
    rows.push({
      criterion: "Location",
      citizenValue: c.state ?? "Not provided",
      requirement: `State scheme for ${scheme.state} residents`,
      status,
    });
  }

  // Income: text only, no invented ceiling
  const incomeSentence = findSentence(scheme.eligibility, INCOME_PATTERN);
  rows.push({
    criterion: "Income",
    citizenValue: c.income ?? "Not provided",
    requirement: incomeSentence ?? "Scheme income eligibility satisfied",
    status: c.income ? "Matches" : "Not provided",
  });

  // Condition / need
  const categories = toList(scheme.categories);
  rows.push({
    criterion: "Condition / need",
    citizenValue: c.medicalNeed ?? "Not provided",
    requirement:
      categories.length > 0
        ? `Scheme covers: ${categories.join(", ")}`
        : "Matches target citizen beneficiary category",
    status: c.medicalNeed ? "Matches" : "Not provided",
  });

  // Age
  const ageSentence = findSentence(scheme.eligibility, AGE_PATTERN);
  rows.push({
    criterion: "Age",
    citizenValue: c.age ? `${c.age} years` : "Not provided",
    requirement: ageSentence ?? "Applicant age criteria satisfied",
    status: c.age ? "Matches" : "Not provided",
  });

  return rows;
}

// Deadline badge. Compares calendar dates in India time (IST).
// Returns null when there is no close date.
const IST_OFFSET_MS = 330 * 60 * 1000;

function parseDateOnly(value: string | null): number | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatDateOnly(ms: number): string {
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function deadlineBadge(
  closeDate: string | null,
  nowMs: number = Date.now()
): DeadlineBadge | null {
  const close = parseDateOnly(closeDate);
  if (close === null) return null;

  const ist = new Date(nowMs + IST_OFFSET_MS);
  const today = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate());
  const days = Math.round((close - today) / 86400000);

  if (days < 0) {
    return { tone: "past", text: `Closed on ${formatDateOnly(close)}` };
  }
  if (days <= 30) {
    return {
      tone: "soon",
      text: days === 0 ? "Closes today" : `Closes in ${days} ${days === 1 ? "day" : "days"}`,
    };
  }
  return { tone: "future", text: `Closes on ${formatDateOnly(close)}` };
}
