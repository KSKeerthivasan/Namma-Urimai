"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import ChatInterface from "@/components/ChatInterface";
import SchemeCard from "@/components/SchemeCard";
import { mergeSchemes } from "@/lib/healthSearch";
import type { DynamicChip, DynamicFollowup, Profile, SchemeRow } from "@/lib/types";
import { ShieldCheck, Sparkles, Filter, X, ChevronDown, UserCheck, LogIn } from "lucide-react";
import CitizenAuthModal from "@/components/CitizenAuthModal";

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
  const [hideGuestBanner, setHideGuestBanner] = useState<boolean>(false);

  const [citizenUser, setCitizenUser] = useState<{ phone: string; name: string } | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  // Restore session from sessionStorage on page load/refresh
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("namma_citizen_user");
      if (storedUser) {
        setCitizenUser(JSON.parse(storedUser));
      }
    } catch {}

    const handleAuth = (e: Event) => {
      const customEvent = e as CustomEvent<{ phone: string; name: string } | null>;
      setCitizenUser(customEvent.detail || null);
    };

    window.addEventListener("namma-auth-changed", handleAuth);
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
      const dismissedBanner = localStorage.getItem("namma_guest_dismissed");
      if (dismissedBanner === "true") {
        setHideGuestBanner(true);
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
    setProfile(result.profile);
    setProfileState(state);
    setActiveSearchTerms(result.searchTerms);
    setDynamicFollowup(result.dynamicFollowup ?? null);

    runIntelligentSearch(result.searchTerms, state, undefined, result.profile, null, activeFilterName);
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
    sessionStorage.removeItem("namma_page_session");
  }

  function dismissGuestBanner() {
    setHideGuestBanner(true);
    try {
      localStorage.setItem("namma_guest_dismissed", "true");
    } catch {}
  }

  const displayedSchemes = schemes.slice(0, displayCount);
  const hasMore = schemes.length > displayCount;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-base text-slate-900 pb-16">
      <Header />

      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6">
        {/* Citizen Access Mode: Guest vs Login Decision Banner */}
        {!hideGuestBanner && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 to-[#0F294A] text-white p-4.5 rounded-2xl shadow-sm border border-slate-800">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-blue-300 mt-0.5">
                {citizenUser ? <ShieldCheck className="h-5 w-5 text-emerald-400" /> : <UserCheck className="h-5 w-5" />}
              </div>
              <div className="text-xs space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-sm text-slate-100">
                    {citizenUser ? `Citizen Account Active (+91 ${citizenUser.phone.slice(-4)})` : "Guest Mode Active (No Login Required)"}
                  </p>
                  <span className={`px-2 py-0.5 rounded-md font-semibold text-[11px] ${citizenUser ? "bg-emerald-900/80 text-emerald-300 border border-emerald-600/40" : "bg-blue-900/60 text-blue-200 border border-blue-700/40"}`}>
                    {citizenUser ? "☁️ Cloud Synced" : "Local Browser Only"}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed max-w-3xl">
                  {citizenUser ? (
                    <span>Your document checklist checkboxes, saved schemes, and application roadmap progress are synced across all your devices.</span>
                  ) : (
                    <span>
                      You can freely search all 5,200+ central &amp; state schemes and download official A4 PDF dossiers without logging in.
                      <strong className="text-amber-300 block sm:inline sm:ml-1">
                        ⚠️ Note: Without login, you cannot track your document checklist or application roadmap completion across devices.
                      </strong>
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-center mt-2 md:mt-0">
              {!citizenUser && (
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-1.5 text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Login to Track</span>
                </button>
              )}
              <Link
                href="/tracker"
                className="inline-flex items-center rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 text-xs font-bold text-white transition-all"
              >
                Saved Schemes
              </Link>
              <button
                type="button"
                onClick={dismissGuestBanner}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
                title="Dismiss note"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Interactive Conversational Assistant */}
        <ChatInterface
          onAnalysisComplete={handleAnalysisComplete}
          followup={dynamicFollowup}
          onChipSelect={handleChipSelect}
          onResetSession={handleResetAll}
        />

        {/* Searching Status */}
        {searching && (
          <div className="flex items-center justify-center gap-3 p-6 text-slate-600 bg-white rounded-2xl border border-slate-200 shadow-xs">
            <Sparkles className="h-5 w-5 text-[#1E40AF] animate-spin" />
            <p className="font-medium text-base">Narrowing down verified government schemes specifically for your criteria...</p>
          </div>
        )}

        {/* Search Error Alert */}
        {searchError && (
          <div className="rounded-xl bg-red-50 p-4 border border-red-200 text-red-800 font-medium">
            {searchError}
          </div>
        )}

        {/* Matched Schemes Results Section */}
        {originalMessage && !searching && !searchError && (
          <section aria-label="Scheme results" className="flex flex-col gap-5 mt-1">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 shadow-xs">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-[#0F294A]">
                    {schemes.length === 0
                      ? "Found 0 Welfare Schemes Matching Your Criteria"
                      : schemes.length <= 5
                      ? `Found ${schemes.length} Best-Matched Welfare Schemes For You`
                      : activeFilterName || profile?.community || profile?.income_annual
                      ? `Found ${schemes.length} Verified Schemes Specifically Matching Your Criteria`
                      : `Found ${schemes.length} Welfare Schemes You Qualify For`}
                  </h2>
                  <p className="text-xs md:text-sm text-slate-600 font-medium mt-0.5">
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
                  <div className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-300 px-3 py-1 text-xs font-bold text-blue-900 shadow-2xs">
                    <span>Active: {activeFilterName}</span>
                    <button
                      type="button"
                      onClick={clearActiveFilter}
                      className="rounded-full p-0.5 hover:bg-blue-200 text-blue-700 transition-colors"
                      title="Clear filter"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {profile?.state && (
                  <div className="flex items-center gap-1 rounded-xl bg-blue-50 border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-800">
                    <span>📍 {profile.state}</span>
                  </div>
                )}
                {profile?.income_annual && (
                  <div className="flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                    <span>💵 ₹{(profile.income_annual).toLocaleString()}/yr</span>
                  </div>
                )}
                {profile?.condition && (
                  <div className="flex items-center gap-1 rounded-xl bg-purple-50 border border-purple-200 px-2.5 py-1 text-xs font-semibold text-purple-800">
                    <span>🏠 {profile.condition}</span>
                  </div>
                )}
                {profile?.education_need && (
                  <div className="flex items-center gap-1 rounded-xl bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-800">
                    <span>🎓 {profile.education_need}</span>
                  </div>
                )}
                {profile?.ration_card && (
                  <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-bold text-amber-900">
                    <Filter className="h-3.5 w-3.5" />
                    <span>Card: {profile.ration_card}</span>
                  </div>
                )}
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

        {/* Citizen Authentication Modal */}
        <CitizenAuthModal
          isOpen={authModalOpen}
          onClose={() => setAuthModalOpen(false)}
          onLoginSuccess={(user) => setCitizenUser(user)}
        />
      </main>
    </div>
  );
}
