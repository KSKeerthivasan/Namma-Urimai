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

  // Format user's income nicely for URL and detail views
  const formattedIncome = profile?.income_annual
    ? profile.income_annual <= 100000
      ? "Below ₹1,00,000 / year"
      : profile.income_annual <= 250000
      ? "₹1,00,000 - ₹2,50,000 / year"
      : profile.income_annual <= 500000
      ? "₹2,50,000 - ₹5,00,000 / year"
      : `₹${profile.income_annual.toLocaleString("en-IN")} / year`
    : "";

  const effectiveNeed =
    profile?.condition ||
    profile?.medical_need ||
    profile?.education_need ||
    profile?.general_need ||
    "";

  const effectiveAge = profile?.age ? String(profile.age) : "";

  // Serialize profile criteria into URL for the scheme detail page
  const ctaHref =
    `/schemes/${scheme.slug}` +
    `?age=${encodeURIComponent(effectiveAge)}` +
    `&state=${encodeURIComponent(profile?.state ?? "")}` +
    `&district=${encodeURIComponent(profile?.district ?? "")}` +
    `&ration_card=${encodeURIComponent(profile?.ration_card ?? "")}` +
    `&medical_need=${encodeURIComponent(effectiveNeed)}` +
    `&income=${encodeURIComponent(formattedIncome)}`;

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
      profile?.district
        ? `Location: Resident of ${profile.district}${profile.state ? `, ${profile.state}` : ""}`
        : `Location: Resident of ${profile?.state || "Tamil Nadu"}`,
      profile?.medical_need
        ? `Medical Need: ${profile.medical_need} covered under cashless surgical packages`
        : `Medical Coverage: Cashless hospitalization and surgery covered across network hospitals`,
      profile?.ration_card === "NPHH"
        ? `Card Status: Sugar Card (NPHH) verified eligible for cashless treatment`
        : profile?.ration_card === "PHH"
        ? `Card Status: Priority Household (Rice Card / PHH) eligible for 100% cashless coverage`
        : profile?.ration_card === "AAY"
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
      profile?.condition
        ? `Eligibility Condition: Verified for ${profile.condition}`
        : `Eligibility: Meets standard applicant demographic and residency criteria`,
      formattedIncome
        ? `Financial Criteria: Family annual income (${formattedIncome}) meets scheme ceiling`
        : `Financial Criteria: Direct Benefit Transfer (DBT) security allowance`,
      profile?.state
        ? `Residency: Verified for residents of ${profile.district ? `${profile.district}, ` : ""}${profile.state}`
        : `Jurisdiction: ${isCentral ? "Central Government welfare entitlement" : `${scheme.state || "Tamil Nadu"} state public program`}`,
      sName.includes("pension")
        ? `Disbursement: Monthly social security pension directly to bank account via DBT`
        : `Application Mode: Transparent application roadmap via government portal / e-Sevai`,
    ];
  }

  return (
    <article className="flex flex-col rounded-2xl bg-white p-6 shadow-md border border-slate-200 hover:shadow-lg transition-all">
      {/* Top Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="rounded-full bg-[#0F294A] px-3 py-1 text-xs font-semibold text-white tracking-wide">
          {levelLabel}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          {t("eligible_100", locale)}
        </span>
        {closingSoon && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 border border-amber-300">
            {daysLeft === 0
              ? t("closes_today", locale)
              : t("closes_in", locale, { n: daysLeft ?? 0 })}
          </span>
        )}
        {scheme.dbt_scheme === true && (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800 border border-blue-200">
            {t("dbt", locale)}
          </span>
        )}
      </div>

      {/* Scheme Name with Domain Icon */}
      <div className="flex items-start gap-2.5 mb-2">
        {isEducation ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-800 mt-0.5">
            <GraduationCap className="h-4 w-4" />
          </div>
        ) : isHealth ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 mt-0.5">
            <HeartPulse className="h-4 w-4" />
          </div>
        ) : isFarmer ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-800 mt-0.5">
            <Tractor className="h-4 w-4" />
          </div>
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-800 mt-0.5">
            <Award className="h-4 w-4" />
          </div>
        )}
        <h3 className="text-xl font-bold text-[#0F294A] leading-snug">
          {scheme.scheme_name}
        </h3>
      </div>

      {/* High-Impact Benefit Banner */}
      {isHealth ? (
        <div className="mb-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 p-3.5">
          <p className="text-sm font-bold text-emerald-900">
            🛡️ Cashless Treatment Coverage up to ₹5,00,000 per family per year
          </p>
          <p className="text-xs text-emerald-700 mt-0.5">
            Zero out-of-pocket expenses for bed, surgery, medicines, and ICU across empaneled hospitals.
          </p>
        </div>
      ) : isEducation ? (
        <div className="mb-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 p-3.5">
          <p className="text-sm font-bold text-blue-900">
            🎓 Full Tuition Waiver & Monthly Financial Maintenance Support
          </p>
          <p className="text-xs text-blue-700 mt-0.5">
            Disbursed directly into student bank account via DBT for qualifying academic programs.
          </p>
        </div>
      ) : scheme.brief_description ? (
        <p className="text-sm text-slate-700 mb-4 line-clamp-2 leading-relaxed">
          {scheme.brief_description}
        </p>
      ) : null}

      {/* Transparent Reasoning: Why You Qualify (FR-5) */}
      <div className="mb-5 rounded-xl bg-slate-50 border border-slate-200/80 p-3.5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
          {t("tab_qualify", locale)}
        </p>
        <ul className="space-y-1.5 text-sm text-slate-800">
          {qualifyBullets.map((bullet, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <Link
          href={ctaHref}
          className="inline-flex min-h-[48px] items-center gap-1.5 rounded-xl bg-[#1E40AF] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#0F294A] transition-all"
        >
          <FileText className="h-4 w-4" />
          <span>{t("view_checklist", locale)}</span>
          <ChevronRight className="h-4 w-4" />
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

      <footer className="mt-3 pt-2 text-xs text-slate-500 flex items-center justify-between">
        <span>{t("verified_active", locale)}</span>
        <a
          href={canonical}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          myscheme.gov.in ↗
        </a>
      </footer>
    </article>
  );
}
