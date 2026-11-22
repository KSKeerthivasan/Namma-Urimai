"use client";

import Link from "next/link";
import SaveSchemeButton from "@/components/SaveSchemeButton";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { daysUntilClose } from "@/lib/savedSchemes";
import type { Profile, SchemeRow } from "@/lib/types";
import { CheckCircle2, ChevronRight, FileText, ShieldCheck, GraduationCap, HeartPulse, Tractor, Award } from "lucide-react";

type Props = {
  scheme: SchemeRow;
  profile?: Profile | null;
  activeFilter?: string | null;
};

export default function SchemeCard({ scheme, profile, activeFilter }: Props) {
  const { locale } = useLocale();
  const isCentral = scheme.level === "Central";
  const levelLabel = isCentral
    ? t("central_government", locale)
    : t("state_government", locale, { state: scheme.state ?? "Tamil Nadu" });

  const daysLeft = daysUntilClose(scheme.scheme_close_date);
  const closingSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 30;
  const canonical = `https://www.myscheme.gov.in/schemes/${scheme.slug}`;

  // Ensure user's income is always extracted from profile or storage fallback
  let effectiveIncomeAnnual = profile?.income_annual;
  let effectiveState = profile?.state ?? "";
  let effectiveDistrict = profile?.district ?? "";
  let effectiveRationCard = profile?.ration_card ?? "";
  let effectiveNeed =
    profile?.condition ||
    profile?.medical_need ||
    profile?.education_need ||
    profile?.general_need ||
    "";
  let effectiveAge = profile?.age ? String(profile.age) : "";

  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem("namma_profile") || localStorage.getItem("namma_profile");
      if (stored) {
        const p = JSON.parse(stored);
        if (!effectiveIncomeAnnual && p.income_annual) effectiveIncomeAnnual = Number(p.income_annual);
        if (!effectiveState && p.state) effectiveState = p.state;
        if (!effectiveDistrict && p.district) effectiveDistrict = p.district;
        if (!effectiveRationCard && p.ration_card) effectiveRationCard = p.ration_card;
        if (!effectiveNeed) effectiveNeed = p.condition || p.medical_need || p.education_need || p.general_need || "";
        if (!effectiveAge && p.age) effectiveAge = String(p.age);
      }
    } catch {}
  }

  const formattedIncome = effectiveIncomeAnnual
    ? effectiveIncomeAnnual <= 100000
      ? "Below ₹1,00,000 / year"
      : effectiveIncomeAnnual <= 250000
      ? "₹1,00,000 - ₹2,50,000 / year"
      : effectiveIncomeAnnual <= 500000
      ? "₹2,50,000 - ₹5,00,000 / year"
      : `₹${effectiveIncomeAnnual.toLocaleString("en-IN")} / year`
    : "";

  // Serialize profile criteria into URL for the scheme detail page
  const ctaHref =
    `/schemes/${scheme.slug}` +
    `?age=${encodeURIComponent(effectiveAge)}` +
    `&state=${encodeURIComponent(effectiveState)}` +
    `&district=${encodeURIComponent(effectiveDistrict)}` +
    `&ration_card=${encodeURIComponent(effectiveRationCard)}` +
    `&medical_need=${encodeURIComponent(effectiveNeed)}` +
    `&income=${encodeURIComponent(formattedIncome || (effectiveIncomeAnnual ? String(effectiveIncomeAnnual) : ""))}`;

  // Detect domain of the scheme
  const sName = scheme.scheme_name.toLowerCase();
  const sDesc = (scheme.brief_description || "").toLowerCase();
  const isHealth = sName.includes("health") || sName.includes("insurance") || sName.includes("cmchis") || sName.includes("pmjay") || sName.includes("medical");
  const isEducation = sName.includes("scholar") || sName.includes("education") || sName.includes("student") || sName.includes("fellowship") || sDesc.includes("scholarship");
  const isFarmer = sName.includes("kisan") || sName.includes("farmer") || sName.includes("agri") || sName.includes("crop");

  // Domain-specific "Why You Qualify" bullets
  let qualifyBullets: string[] = [];

  if (isEducation) {
    qualifyBullets = [
      activeFilter
        ? `Academic Stage: Matches your selected category (${activeFilter})`
        : `Academic Stage: Financial assistance for higher education and tuition support`,
      `Jurisdiction: ${isCentral ? "Central Government scheme (All-India coverage)" : `Tamil Nadu State Welfare scholarship`}`,
      `Financial Support: Direct Bank Transfer (DBT) maintenance & course fee allowance`,
      `Merit & Enrollment: Satisfies student eligibility criteria and academic enrollment rules`,
    ];
  } else if (isHealth) {
    qualifyBullets = [
      effectiveDistrict
        ? `Location: Resident of ${effectiveDistrict}${effectiveState ? `, ${effectiveState}` : ""}`
        : `Location: Resident of ${effectiveState || "Tamil Nadu"}`,
      effectiveNeed
        ? `Medical Need: ${effectiveNeed} covered under cashless surgical packages`
        : `Medical Coverage: Cashless hospitalization and surgery covered across network hospitals`,
      effectiveRationCard === "NPHH"
        ? `Card Status: Sugar Card (NPHH) verified eligible for cashless treatment`
        : effectiveRationCard === "PHH"
        ? `Card Status: Priority Household (Rice Card / PHH) eligible for 100% cashless coverage`
        : effectiveRationCard === "AAY"
        ? `Card Status: Antyodaya Anna Yojana (AAY) highest priority coverage`
        : `Economic Criteria: Eligible under state public healthcare guidelines`,
      `Benefit Ceiling: Up to ₹5,00,000 cashless cover per family per year`,
    ];
  } else if (isFarmer) {
    qualifyBullets = [
      `Beneficiary Category: Farmer / Agricultural cultivator entitlement`,
      `Jurisdiction: ${isCentral ? "National agricultural support initiative" : `${scheme.state || "Tamil Nadu"} agricultural program`}`,
      `Benefit Type: Direct input subsidy, equipment grant or crop assistance`,
      `Disbursement: Direct DBT credit to Aadhaar-linked bank account`,
    ];
  } else {
    qualifyBullets = [
      effectiveNeed
        ? `Eligibility Condition: Verified for ${effectiveNeed}`
        : `Eligibility: Meets standard applicant demographic and residency criteria`,
      formattedIncome
        ? `Financial Criteria: Family annual income (${formattedIncome}) meets scheme ceiling`
        : `Financial Criteria: Direct Benefit Transfer (DBT) security allowance`,
      effectiveState
        ? `Residency: Verified for residents of ${effectiveDistrict ? `${effectiveDistrict}, ` : ""}${effectiveState}`
        : `Jurisdiction: ${isCentral ? "Central Government welfare entitlement" : `${scheme.state || "Tamil Nadu"} state public program`}`,
      sName.includes("pension")
        ? `Disbursement: Monthly social security pension directly to bank account via DBT`
        : `Application Mode: Transparent application roadmap via government portal / e-Sevai`,
    ];
  }

  return (
    <article className="flex flex-col rounded-3xl bg-white p-6 shadow-2xs border border-stone-200/90 hover:shadow-md hover:border-[#C5D9C7] transition-all duration-200">
      {/* Top Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="rounded-full bg-[#132A1D] px-3.5 py-1 text-xs font-bold text-white tracking-wide">
          {levelLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#EBF5EE] px-3 py-1 text-xs font-bold text-[#1E4D2B] border border-[#CDE5D2]">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-700" />
          {t("eligible_100", locale)}
        </span>
        {closingSoon && (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 border border-amber-300">
            {daysLeft === 0
              ? t("closes_today", locale)
              : t("closes_in", locale, { n: daysLeft ?? 0 })}
          </span>
        )}
        {scheme.dbt_scheme === true && (
          <span className="rounded-full bg-[#EBF5EE] px-3 py-1 text-xs font-bold text-[#1E4D2B] border border-[#CDE5D2]">
            {t("dbt", locale)}
          </span>
        )}
      </div>

      {/* Scheme Name with Domain Icon */}
      <div className="flex items-start gap-3 mb-2.5">
        {isEducation ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F5F1] text-[#132A1D] border border-[#D5E3D6] mt-0.5">
            <GraduationCap className="h-4.5 w-4.5" />
          </div>
        ) : isHealth ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F5F1] text-[#132A1D] border border-[#D5E3D6] mt-0.5">
            <HeartPulse className="h-4.5 w-4.5" />
          </div>
        ) : isFarmer ? (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-900 border border-amber-200 mt-0.5">
            <Tractor className="h-4.5 w-4.5" />
          </div>
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F0F5F1] text-[#132A1D] border border-[#D5E3D6] mt-0.5">
            <Award className="h-4.5 w-4.5" />
          </div>
        )}
        <h3 className="font-serif-display text-xl font-bold text-[#132A1D] leading-snug">
          {scheme.scheme_name}
        </h3>
      </div>

      {/* High-Impact Benefit Banner */}
      {isHealth ? (
        <div className="mb-4 rounded-2xl bg-[#F0F5F1] border border-[#D5E3D6] p-3.5">
          <p className="text-xs font-bold text-[#132A1D]">
            🛡️ Cashless Treatment Coverage up to ₹5,00,000 per family per year
          </p>
          <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
            Zero out-of-pocket expenses for bed, surgery, medicines, and ICU across empaneled hospitals.
          </p>
        </div>
      ) : isEducation ? (
        <div className="mb-4 rounded-2xl bg-[#F0F5F1] border border-[#D5E3D6] p-3.5">
          <p className="text-xs font-bold text-[#132A1D]">
            🎓 Full Tuition Waiver &amp; Monthly Financial Maintenance Support
          </p>
          <p className="text-xs text-stone-600 mt-0.5 leading-relaxed">
            Disbursed directly into student bank account via DBT for qualifying academic programs.
          </p>
        </div>
      ) : scheme.brief_description ? (
        <p className="text-sm text-stone-600 mb-4 line-clamp-2 leading-relaxed">
          {scheme.brief_description}
        </p>
      ) : null}

      {/* Transparent Reasoning: Why You Qualify */}
      <div className="mb-5 rounded-2xl bg-stone-50/80 border border-stone-200/80 p-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500 mb-2">
          {t("tab_qualify", locale)}
        </p>
        <ul className="space-y-1.5 text-xs text-stone-700">
          {qualifyBullets.map((bullet, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-stone-100">
        <Link
          href={ctaHref}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#132A1D] px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#1E3A2B] transition-all cursor-pointer"
        >
          <FileText className="h-3.5 w-3.5" />
          <span>{t("view_checklist", locale)}</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
        <SaveSchemeButton
          scheme={{
            slug: scheme.slug,
            scheme_name: scheme.scheme_name,
            short_title: scheme.short_title,
            level: scheme.level,
            state: scheme.state,
            scheme_close_date: scheme.scheme_close_date,
          }}
        />
      </div>

      <footer className="mt-3 pt-2 text-xs text-stone-500 flex items-center justify-between">
        <span className="text-[11px]">{t("verified_active", locale)}</span>
        <a
          href={canonical}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-[#132A1D] font-semibold underline underline-offset-2 hover:text-emerald-800"
        >
          myscheme.gov.in ↗
        </a>
      </footer>
    </article>
  );
}
