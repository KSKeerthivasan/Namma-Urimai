"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import ChatInterface from "@/components/ChatInterface";
import SchemeCard from "@/components/SchemeCard";
import { mergeSchemes } from "@/lib/healthSearch";
import type { DynamicChip, DynamicFollowup, Profile, SchemeRow } from "@/lib/types";
import { Sparkles, Filter, X, ChevronDown, RotateCcw, ShieldCheck } from "lucide-react";

type SearchParams = { q?: string; state?: string; benefit_type?: string; limit?: number };

export default function Home() {
  const [originalMessage, setOriginalMessage] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileState, setProfileState] = useState<string | undefined>(undefined);
  const [activeSearchTerms, setActiveSearchTerms] = useState<string[]>([]);
  const [activeFilterName, setActiveFilterName] = useState<string | null>(null);
  const [dynamicFollowup, setDynamicFollowup] = useState<DynamicFollowup | null>(null);
  const [schemes, setSchemes] = useState<SchemeRow[]>([]);
  const [displayCount, setDisplayCount] = useState<number>(12);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Restore session from sessionStorage on page load/refresh
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("namma_page_session");
      if (stored) {
        const data = JSON.parse(stored);
        if (data.originalMessage) setOriginalMessage(data.originalMessage);
        if (data.profile) setProfile(data.profile);
        if (data.profileState) setProfileState(data.profileState);
        if (data.activeSearchTerms) setActiveSearchTerms(data.activeSearchTerms);
        if (data.activeFilterName) setActiveFilterName(data.activeFilterName);
        if (data.dynamicFollowup) setDynamicFollowup(data.dynamicFollowup);
        if (data.schemes) setSchemes(data.schemes);
      }
    } catch {}
  }, []);

  // Save session to sessionStorage on state updates
  useEffect(() => {
    try {
      if (originalMessage) {
        sessionStorage.setItem(
          "namma_page_session",
          JSON.stringify({
            originalMessage,
            profile,
            profileState,
            activeSearchTerms,
            activeFilterName,
            dynamicFollowup,
            schemes,
          })
        );
      }
    } catch {}
  }, [originalMessage, profile, profileState, activeSearchTerms, activeFilterName, dynamicFollowup, schemes]);

  async function fetchSchemes(params: SearchParams): Promise<SchemeRow[]> {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.state) qs.set("state", params.state);
    if (params.benefit_type) qs.set("benefit_type", params.benefit_type);
    if (params.limit) qs.set("limit", String(params.limit));
    const res = await fetch(`/api/schemes?${qs.toString()}`);
    if (!res.ok) throw new Error(`schemes failed: ${res.status}`);
    const data: { schemes?: SchemeRow[] } = await res.json();
    return data.schemes ?? [];
  }

  // Multi-attribute eligibility filtering (State, Income, Education, Community, Card)
  function applyPreciseEligibilityFilter(
    schemeList: SchemeRow[],
    currentProfile: Profile | null,
    filterName: string | null
  ): SchemeRow[] {
    const userState = (currentProfile?.state || "").trim().toLowerCase();
    const eduNeed = (currentProfile?.education_need || "").toLowerCase();
    const community = (currentProfile?.community || filterName || "").toLowerCase();
    const filterLower = (filterName || "").toLowerCase();
    const isMedical = Boolean(currentProfile?.medical_need);
    const rationCard = currentProfile?.ration_card;
    const income = currentProfile?.income_annual;

    let filtered = [...schemeList];

    // 1. Strict State Filter: Retain ONLY citizen's state and Central schemes
    if (userState && userState !== "all" && userState !== "other") {
      filtered = filtered.filter((s) => {
        const sState = (s.state || "").toLowerCase();
        const isCentral = s.level === "Central";
        return isCentral || sState.includes(userState);
      });
    }

    // 2. Income Ceilings Filtering (e.g. < 1 Lakh, < 2.5 Lakhs)
    if (income) {
      filtered = filtered.filter((s) => {
        const text = `${s.brief_description || ""} ${s.eligibility || ""}`.toLowerCase();
        // If scheme specifies strict low-income requirement (< 1 Lakh or < 50k), exclude if income > 1.5 Lakhs
        if (income > 150000 && text.includes("not exceed ₹1,00,000")) return false;
        if (income > 300000 && text.includes("not exceed ₹2,50,000")) return false;
        if (income > 550000 && text.includes("not exceed ₹4,50,000")) return false;
        return true;
      });
    }

    // 3. Education Stage Filtering
    const isCollegeNarrowed =
      eduNeed.includes("college") ||
      eduNeed.includes("undergrad") ||
      eduNeed.includes("university") ||
      eduNeed.includes("degree") ||
      filterLower.includes("college") ||
      filterLower.includes("undergrad");

    const isSchoolNarrowed =
      eduNeed.includes("school") ||
      eduNeed.includes("secondary") ||
      filterLower.includes("class 11") ||
      filterLower.includes("higher secondary") ||
      filterLower.includes("school");

    const isPolytechnicNarrowed =
      eduNeed.includes("polytechnic") ||
      eduNeed.includes("diploma") ||
      filterLower.includes("polytechnic") ||
      filterLower.includes("diploma");

    if (isCollegeNarrowed) {
      filtered = filtered.filter((s) => {
        const text = `${s.scheme_name} ${s.brief_description || ""} ${s.eligibility || ""}`.toLowerCase();
        const isJuniorSchool =
          text.includes("i to viii") ||
          text.includes("1 to 8") ||
          text.includes("ix to x") ||
          text.includes("ix and x") ||
          text.includes("pre-matric") ||
          text.includes("pre matric") ||
          text.includes("primary school") ||
          text.includes("elementary") ||
          text.includes("middle school") ||
          text.includes("note books to the children") ||
          text.includes("studying up to higher secondary") ||
          text.includes("class 1 to") ||
          text.includes("children studying in school");
        return !isJuniorSchool;
      });
    } else if (isSchoolNarrowed) {
      filtered = filtered.filter((s) => {
        const text = `${s.scheme_name} ${s.brief_description || ""}`.toLowerCase();
        return (
          !text.includes("under-graduate") &&
          !text.includes("post-graduate") &&
          !text.includes("university rank") &&
          !text.includes("doctorate")
        );
      });
    } else if (isPolytechnicNarrowed) {
      filtered = filtered.filter((s) => {
        const text = `${s.scheme_name} ${s.brief_description || ""}`.toLowerCase();
        return text.includes("diploma") || text.includes("polytechnic");
      });
    }

    // 4. Community & Reservation Quota Filtering
    const isBCMBC =
      community.includes("bc") ||
      community.includes("mbc") ||
      community.includes("dnc") ||
      community.includes("obc") ||
      filterLower.includes("bc") ||
      filterLower.includes("mbc");

    const isSCST =
      community.includes("sc") ||
      community.includes("st") ||
      filterLower.includes("sc") ||
      filterLower.includes("st");

    const isFirstGraduate =
      community.includes("first graduate") ||
      filterLower.includes("first graduate");

    const isGeneralEWS =
      community.includes("general") ||
      community.includes("ews") ||
      filterLower.includes("general") ||
      filterLower.includes("ews");

    if (isBCMBC) {
      filtered = filtered.filter((s) => {
        const text = `${s.scheme_name} ${s.brief_description || ""} ${s.eligibility || ""}`.toLowerCase();
        const isStrictSCST =
          (text.includes("scheduled caste") || text.includes("scheduled tribe") || text.includes(" st ") || text.includes(" sc ")) &&
          !text.includes("backward") &&
          !text.includes("obc") &&
          !text.includes("mbc");
        if (isStrictSCST) return false;
        return (
          text.includes("backward") ||
          text.includes("obc") ||
          text.includes("mbc") ||
          text.includes("dnc") ||
          text.includes("denotified") ||
          text.includes("merit") ||
          text.includes("higher education") ||
          text.includes("central sector") ||
          text.includes("inspire") ||
          text.includes("free education")
        );
      });
    } else if (isSCST) {
      filtered = filtered.filter((s) => {
        const text = `${s.scheme_name} ${s.brief_description || ""} ${s.eligibility || ""}`.toLowerCase();
        const isStrictBCMBC =
          (text.includes("backward classes") || text.includes("most backward")) &&
          !text.includes("scheduled") &&
          !text.includes("tribal");
        if (isStrictBCMBC) return false;
        return (
          text.includes("scheduled caste") ||
          text.includes("scheduled tribe") ||
          text.includes("tribal") ||
          text.includes("adi dravidar") ||
          text.includes("post matric") ||
          text.includes("merit") ||
          text.includes("central sector")
        );
      });
    } else if (isFirstGraduate) {
      filtered = filtered.filter((s) => {
        const text = `${s.scheme_name} ${s.brief_description || ""} ${s.eligibility || ""}`.toLowerCase();
        return (
          text.includes("first graduate") ||
          text.includes("no graduate") ||
          text.includes("free education") ||
          text.includes("higher education assurance") ||
          text.includes("pudhumai penn") ||
          text.includes("undergraduate") ||
          text.includes("central sector")
        );
      });
    } else if (isGeneralEWS) {
      filtered = filtered.filter((s) => {
        const text = `${s.scheme_name} ${s.brief_description || ""} ${s.eligibility || ""}`.toLowerCase();
        const isStrictReserved =
          (text.includes("only for scheduled") || text.includes("only for backward")) &&
          !text.includes("general") &&
          !text.includes("open to all");
        return !isStrictReserved;
      });
    }

    // 5. Healthcare & Ration Card Filtering
    if (isMedical && rationCard) {
      filtered = filtered.filter((s) => {
        const name = s.scheme_name.toLowerCase();
        const desc = (s.brief_description || "").toLowerCase();
        return (
          name.includes("chief minister") ||
          name.includes("cmchis") ||
          name.includes("pradhan mantri jan arogya") ||
          name.includes("pm-jay") ||
          name.includes("health insurance") ||
          desc.includes("cashless") ||
          desc.includes("hospitalization")
        );
      });
    }

    return filtered;
  }

  async function runIntelligentSearch(
    terms: string[],
    userState?: string,
    benefitType?: string,
    extractedProfile?: Profile | null,
    narrowingKeyword?: string | null,
    filterLabel?: string | null
  ) {
    setSearching(true);
    setSearchError(null);

    const effectiveState =
      userState && userState.toLowerCase() !== "other" && userState.toLowerCase() !== "all"
        ? userState
        : undefined;
    const eduNeed = (extractedProfile?.education_need || "").toLowerCase();
    const keywordStr = (narrowingKeyword || "").toLowerCase();
    const termsJoined = terms.join(" ").toLowerCase();

    const isCollegeNarrowed =
      eduNeed.includes("college") ||
      eduNeed.includes("undergrad") ||
      eduNeed.includes("university") ||
      eduNeed.includes("degree") ||
      keywordStr.includes("college") ||
      keywordStr.includes("undergraduate") ||
      termsJoined.includes("college");

    const isSchoolNarrowed =
      eduNeed.includes("school") ||
      eduNeed.includes("secondary") ||
      keywordStr.includes("higher secondary") ||
      keywordStr.includes("class 11");

    const isPolytechnicNarrowed =
      eduNeed.includes("polytechnic") ||
      eduNeed.includes("diploma") ||
      keywordStr.includes("polytechnic");

    const queries = new Set<string>();

    if (isCollegeNarrowed) {
      queries.add("college scholarship");
      queries.add("undergraduate scholarship");
      queries.add("university scholarship");
      queries.add("higher education");
      if (narrowingKeyword && !narrowingKeyword.includes("college")) {
        queries.add(narrowingKeyword);
      }
    } else if (isSchoolNarrowed) {
      queries.add("higher secondary scholarship");
      queries.add("school scholarship");
      queries.add("class 11 12 scholarship");
    } else if (isPolytechnicNarrowed) {
      queries.add("polytechnic diploma");
      queries.add("diploma scholarship");
    } else {
      terms.forEach((t) => {
        const clean = t.trim().toLowerCase();
        if (clean === "welfare" || clean === "student welfare" || clean === "assistance" || clean.length < 3) return;
        queries.add(clean);
      });

      if (extractedProfile?.medical_need) {
        queries.add("health insurance");
        queries.add("surgery");
        queries.add("hospital");
      }
      if (
        extractedProfile?.education_need ||
        terms.some((t) => t.toLowerCase().includes("scholar") || t.toLowerCase().includes("student"))
      ) {
        queries.add("scholarship");
        queries.add("higher education");
      }
      if (
        extractedProfile?.occupation?.toLowerCase().includes("farm") ||
        terms.some((t) => t.toLowerCase().includes("kisan") || t.toLowerCase().includes("farm"))
      ) {
        queries.add("farmer");
        queries.add("agriculture");
      }
    }

    const queryList = Array.from(queries);
    if (queryList.length === 0) queryList.push("scholarship");

    try {
      const searchPromises = queryList.map((term) =>
        fetchSchemes({ q: term, state: effectiveState, benefit_type: benefitType, limit: 40 }).catch(
          (): SchemeRow[] => []
        )
      );

      const results = await Promise.all(searchPromises);
      let merged = mergeSchemes(results);

      // Apply multi-attribute eligibility filtering
      merged = applyPreciseEligibilityFilter(merged, extractedProfile || profile, filterLabel || activeFilterName);

      if (merged.length === 0) {
        const fallback = await fetchSchemes({ state: effectiveState, limit: 20 }).catch((): SchemeRow[] => []);
        merged = fallback;
      }

      setSchemes(merged);
      setDisplayCount(12);
    } catch {
      setSchemes([]);
      setSearchError("Could not load schemes. Please try again.");
    } finally {
      setSearching(false);
    }
  }

  function handleAnalysisComplete(result: {
    profile: Profile;
    conversationalResponse: string;
    searchTerms: string[];
    userMessage: string;
    dynamicFollowup?: DynamicFollowup | null;
  }) {
    const state = result.profile.state?.trim() || undefined;
    setOriginalMessage(result.userMessage);
    let resolvedProfile = result.profile;
    setProfile((prev) => {
      const merged: Profile = {
        ...(prev || {}),
        ...result.profile,
      };
      if (!merged.income_annual && prev?.income_annual) {
        merged.income_annual = prev.income_annual;
      }
      resolvedProfile = merged;
      return merged;
    });
    setProfileState(state);
    setActiveSearchTerms(result.searchTerms);
    setDynamicFollowup(result.dynamicFollowup ?? null);

    runIntelligentSearch(result.searchTerms, state, undefined, resolvedProfile, null, activeFilterName);
  }

  function handleChipSelect(chip: DynamicChip) {
    setActiveFilterName(chip.label);
    setDynamicFollowup(null);

    const narrowingKeyword = chip.narrowing_keyword;
    const currentTerms = [narrowingKeyword, ...activeSearchTerms];
    setActiveSearchTerms(currentTerms);

    const lowerChip = (chip.label + " " + chip.narrowing_keyword).toLowerCase();
    const updatedProfile: Profile = profile ? { ...profile } : {};

    if (
      lowerChip.includes("1 lakh -") ||
      lowerChip.includes("1 to 2.5") ||
      lowerChip.includes("below 2.5") ||
      lowerChip.includes("< 2.5") ||
      lowerChip.includes("₹1 lakh")
    ) {
      updatedProfile.income_annual = 200000;
    } else if (lowerChip.includes("below 1 lakh") || lowerChip.includes("< 1 lakh")) {
      updatedProfile.income_annual = 90000;
    } else if (lowerChip.includes("2.5 lakh -") || lowerChip.includes("below 5") || lowerChip.includes("< 5")) {
      updatedProfile.income_annual = 400000;
    } else if (lowerChip.includes("above 5 lakh") || lowerChip.includes("> 5 lakh")) {
      updatedProfile.income_annual = 600000;
    }

    if (lowerChip.includes("destitute") || lowerChip.includes("no family support")) {
      updatedProfile.condition = "Destitute / No Family Support";
      if (!updatedProfile.general_need) updatedProfile.general_need = "Old Age Pension / Destitute support";
    } else if (lowerChip.includes("differently abled") || lowerChip.includes("disab")) {
      updatedProfile.condition = "Differently Abled Senior";
    }

    setProfile(updatedProfile);
    runIntelligentSearch(currentTerms, profileState, undefined, updatedProfile, narrowingKeyword, chip.label);
  }

  function clearActiveFilter() {
    setActiveFilterName(null);
    if (profile) {
      runIntelligentSearch(activeSearchTerms, profileState, undefined, profile, null, null);
    }
  }

  function handleResetAll() {
    setOriginalMessage(null);
    setProfile(null);
    setProfileState(undefined);
    setActiveSearchTerms([]);
    setActiveFilterName(null);
    setDynamicFollowup(null);
    setSchemes([]);
    try {
      sessionStorage.removeItem("namma_page_session");
      sessionStorage.removeItem("namma_profile");
      sessionStorage.removeItem("namma_chat_messages");
      sessionStorage.removeItem("namma_schemes");
      sessionStorage.removeItem("namma_filter");
      sessionStorage.removeItem("namma_followup");
      localStorage.removeItem("namma_profile");
    } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const displayedSchemes = schemes.slice(0, displayCount);
  const hasMore = schemes.length > displayCount;

  return (
    <div className="min-h-screen bg-[#F8FAF7] text-base text-stone-900 pb-16">
      <Header />

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        {/* Editorial Civic Hero Headline */}
        <section className="text-center max-w-3xl mx-auto pt-2 pb-1 space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/70 border border-emerald-300/80 px-3.5 py-1 text-xs font-bold text-emerald-950 shadow-2xs">
            <span className="flex h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>Verified 5,200+ Central &amp; State Welfare Programs</span>
          </div>
          <h1 className="font-serif-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#132A1D] tracking-tight leading-[1.16]">
            Every welfare scheme you qualify for. In simple words.
          </h1>
          <p className="text-sm md:text-base text-stone-600 font-normal max-w-2xl mx-auto leading-relaxed">
            Tell us your situation naturally. We match you with government pensions, scholarships, medical coverage, and direct financial subsidies.
          </p>
        </section>

        {/* Interactive Conversational Assistant (Template Showcase Container) */}
        <div className="rounded-3xl bg-gradient-to-b from-[#E7EFE8]/70 via-[#F0F5F1]/40 to-white/20 p-2 sm:p-3 border border-[#D5E3D6] shadow-2xs">
          <ChatInterface
            onAnalysisComplete={handleAnalysisComplete}
            followup={dynamicFollowup}
            onChipSelect={handleChipSelect}
            onResetSession={handleResetAll}
          />
        </div>

        {/* Searching Status */}
        {searching && (
          <div className="flex items-center justify-center gap-3 p-6 text-stone-700 bg-white rounded-3xl border border-stone-200/90 shadow-2xs">
            <Sparkles className="h-5 w-5 text-emerald-700 animate-spin" />
            <p className="font-semibold text-sm md:text-base">Narrowing down verified government schemes specifically for your criteria...</p>
          </div>
        )}

        {/* Search Error Alert */}
        {searchError && (
          <div className="rounded-2xl bg-red-50 p-4 border border-red-200 text-red-900 font-medium text-sm">
            {searchError}
          </div>
        )}

        {/* Matched Schemes Results Section */}
        {originalMessage && !searching && !searchError && (
          <section aria-label="Scheme results" className="flex flex-col gap-5 mt-2">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-stone-200/90 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-900 shadow-2xs">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-serif-display text-xl md:text-2xl font-bold text-[#132A1D]">
                    {schemes.length === 0
                      ? "Found 0 Welfare Schemes Matching Your Criteria"
                      : schemes.length <= 5
                      ? `Found ${schemes.length} Best-Matched Welfare Schemes For You`
                      : activeFilterName || profile?.community || profile?.income_annual
                      ? `Found ${schemes.length} Verified Schemes Specifically Matching Your Criteria`
                      : `Found ${schemes.length} Welfare Schemes You Qualify For`}
                  </h2>
                  <p className="text-xs md:text-sm text-stone-600 font-medium mt-0.5">
                    {schemes.length <= 5
                      ? "✓ Filtered to your exact background criteria — these are your highest-probability schemes."
                      : activeFilterName
                      ? `Filtered specifically for ${activeFilterName} in ${profile?.district ? `${profile.district}, ` : ""}${profile?.state || "Tamil Nadu & Central"}`
                      : `Showing verified government welfare programs for ${profile?.district ? `${profile.district}, ` : ""}${profile?.state || "Tamil Nadu & Central"}`}
                  </p>
                </div>
              </div>

              {/* Active Filter Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {activeFilterName && (
                  <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-300/80 px-3 py-1 text-xs font-bold text-emerald-950 shadow-2xs">
                    <span>Active: {activeFilterName}</span>
                    <button
                      type="button"
                      onClick={clearActiveFilter}
                      className="rounded-full p-0.5 hover:bg-emerald-200 text-emerald-800 transition-colors cursor-pointer"
                      title="Clear filter"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {profile?.state && (
                  <div className="flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-blue-900 shadow-2xs">
                    <span>📍 {profile.state}</span>
                  </div>
                )}
                {profile?.income_annual && (
                  <div className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-950 shadow-2xs">
                    <span>💵 ₹{(profile.income_annual).toLocaleString()}/yr</span>
                  </div>
                )}
                {profile?.condition && (
                  <div className="flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-xs font-semibold text-purple-900 shadow-2xs">
                    <span>🏠 {profile.condition}</span>
                  </div>
                )}
                {profile?.education_need && (
                  <div className="flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-900 shadow-2xs">
                    <span>🎓 {profile.education_need}</span>
                  </div>
                )}
                {profile?.ration_card && (
                  <div className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-950 shadow-2xs">
                    <Filter className="h-3 w-3 text-amber-700" />
                    <span>Card: {profile.ration_card}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleResetAll}
                  className="inline-flex items-center gap-1.5 rounded-full border border-stone-300 bg-white hover:bg-stone-50 text-stone-700 px-3.5 py-1 text-xs font-bold transition-all shadow-2xs hover:border-[#132A1D] hover:text-[#132A1D] cursor-pointer ml-auto"
                  title="Clear conversation and search for a new scheme"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>New Scheme Search</span>
                </button>
              </div>
            </div>

            {/* Scheme Cards Grid */}
            <div className="grid gap-5 md:grid-cols-2">
              {displayedSchemes.map((scheme) => (
                <SchemeCard
                  key={scheme.slug}
                  scheme={scheme}
                  profile={profile}
                  activeFilter={activeFilterName}
                />
              ))}
            </div>

            {/* Load More Button for large result sets */}
            {hasMore && (
              <div className="flex justify-center mt-4">
                <button
                  type="button"
                  onClick={() => setDisplayCount((prev) => prev + 12)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-2.5 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition-all"
                >
                  <span>Show More Schemes ({schemes.length - displayCount} remaining)</span>
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            )}
          </section>
        )}

      </main>
    </div>
  );
}
