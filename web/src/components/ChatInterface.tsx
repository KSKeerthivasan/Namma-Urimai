"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { t, type TranslationKey } from "@/lib/i18n";
import type { ChatApiResponse, DynamicChip, DynamicFollowup, Profile } from "@/lib/types";
import { Send, Sparkles, User, Bot, AlertCircle, RotateCcw } from "lucide-react";
import DynamicChips from "@/components/DynamicChips";

type Props = {
  onAnalysisComplete?: (result: {
    profile: Profile;
    conversationalResponse: string;
    searchTerms: string[];
    userMessage: string;
    dynamicFollowup?: DynamicFollowup | null;
  }) => void;
  onProfile?: (profile: Profile, message: string) => void;
  followup?: DynamicFollowup | null;
  onChipSelect?: (chip: DynamicChip) => void;
  onResetSession?: () => void;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  isInitial?: boolean;
  profile?: Profile;
};

const SAMPLES = [
  { key: "sample_hernia" as TranslationKey, fallback: "I am 48 years old from Chennai with a Sugar Card, need hernia surgery" },
  { key: "sample_pension" as TranslationKey, fallback: "Old age pension plan" },
  { key: "sample_scholarship" as TranslationKey, fallback: "Scholarship for students" },
];

export default function ChatInterface({
  onAnalysisComplete,
  onProfile,
  followup,
  onChipSelect,
  onResetSession,
}: Props) {
  const { locale } = useLocale();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accumulatedProfile, setAccumulatedProfile] = useState<Profile | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const initialWelcomeText =
    locale === "ta"
      ? "வணக்கம்! நான் உங்கள் உரிமை வழிகாட்டி. உங்கள் வயது, ஊர், மற்றும் உங்களுக்குத் தேவையான மருத்துவ சிகிச்சை, கல்வி உதவித்தொகை அல்லது ஓய்வூதியத்தை எளிய தமிழில் சொல்லுங்கள். உங்களுக்கான அனைத்து அரசு நலத்திட்டங்களையும் நான் கண்டறிந்து தருகிறேன்."
      : locale === "hi"
      ? "नमस्ते! मैं आपका कल्याणकारी योजना सहायक हूँ। अपनी उम्र, शहर/जिला और अपनी जरूरत (सर्जरी, छात्रवृत्ति, पेंशन) सरल शब्दों में बताएं। मैं आपको पात्र सभी सरकारी योजनाएं खोज कर दूंगा।"
      : locale === "te"
      ? "నమస్కారం! నేను మీ సంక్షేమ పథకాల మార్గదర్శిని. మీ వయస్సు, ప్రాంతం మరియు మీకు కావలసిన సహాయం (వైద్యం, పెన్షన్, స్కాలర్‌షిప్) తెలపండి. మీరు అర్హులైన అన్ని పథకాలను నేను చూపిస్తాను."
      : "Namaste! I am your Namma-Urimai Welfare Scheme Navigator. Tell me your situation in simple words — your age, city/district, and what medical surgery, pension, scholarship, or assistance you need. I will find every central and state scheme you qualify for.";

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      isInitial: true,
      text: initialWelcomeText,
    },
  ]);

  // Restore messages and profile from sessionStorage if user refreshed the page
  useEffect(() => {
    try {
      const savedMsgs = sessionStorage.getItem("namma_chat_messages");
      if (savedMsgs) {
        const parsed = JSON.parse(savedMsgs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
      const savedProf = sessionStorage.getItem("namma_profile");
      if (savedProf) {
        setAccumulatedProfile(JSON.parse(savedProf));
      }
    } catch {}
  }, []);

  // Persist messages to sessionStorage
  useEffect(() => {
    try {
      if (messages.length > 1) {
        sessionStorage.setItem("namma_chat_messages", JSON.stringify(messages));
      }
    } catch {}
  }, [messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, followup]);

  function handleReset() {
    sessionStorage.removeItem("namma_chat_messages");
    sessionStorage.removeItem("namma_profile");
    sessionStorage.removeItem("namma_schemes");
    sessionStorage.removeItem("namma_filter");
    sessionStorage.removeItem("namma_followup");
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        isInitial: true,
        text: initialWelcomeText,
      },
    ]);
    setAccumulatedProfile(null);
    setText("");
    if (onResetSession) {
      onResetSession();
    }
  }

  function handleChipClick(chip: DynamicChip) {
    if (onChipSelect) {
      onChipSelect(chip);
    }

    const cleanLabel = chip.label.replace(/^[^\w\s]+/, "").trim();
    let textToSend = chip.label;
    if (chip.narrowing_keyword && chip.narrowing_keyword.toLowerCase() !== "other") {
      if (cleanLabel.toLowerCase() === chip.narrowing_keyword.toLowerCase()) {
        textToSend = cleanLabel;
      } else {
        textToSend = `${cleanLabel} ${chip.narrowing_keyword}`;
      }
    }

    const lowerChip = textToSend.toLowerCase();
    const updated = { ...(accumulatedProfile || {}) };

    if (
      lowerChip.includes("1 lakh -") ||
      lowerChip.includes("1 to 2.5") ||
      lowerChip.includes("below 2.5") ||
      lowerChip.includes("< 2.5") ||
      lowerChip.includes("₹1 lakh")
    ) {
      updated.income_annual = 200000;
    } else if (lowerChip.includes("below 1 lakh") || lowerChip.includes("< 1 lakh")) {
      updated.income_annual = 90000;
    } else if (lowerChip.includes("2.5 lakh -") || lowerChip.includes("below 5") || lowerChip.includes("< 5")) {
      updated.income_annual = 400000;
    } else if (lowerChip.includes("above 5 lakh") || lowerChip.includes("> 5 lakh")) {
      updated.income_annual = 600000;
    }

    if (lowerChip.includes("destitute") || lowerChip.includes("no family support")) {
      updated.condition = "Destitute / No Family Support";
      if (!updated.general_need) updated.general_need = "Old Age Pension / Destitute support";
    } else if (lowerChip.includes("differently abled") || lowerChip.includes("disab")) {
      updated.condition = "Differently Abled Senior";
    }

    if (lowerChip.includes("tamil nadu")) updated.state = "Tamil Nadu";
    else if (lowerChip.includes("karnataka")) updated.state = "Karnataka";
    else if (lowerChip.includes("maharashtra")) updated.state = "Maharashtra";

    setAccumulatedProfile(updated);
    try {
      sessionStorage.setItem("namma_profile", JSON.stringify(updated));
      localStorage.setItem("namma_profile", JSON.stringify(updated));
    } catch {}

    handleSend(textToSend, chip.label, updated);
  }

  async function handleSend(customText?: string, displayLabel?: string, overrideProfile?: Profile) {
    const message = (customText ?? text).trim();
    if (!message || loading) return;

    const currentProfile = overrideProfile || accumulatedProfile;
    const userDisplayText = displayLabel || message;
    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: "user", text: userDisplayText }]);
    setText("");
    setLoading(true);
    setError(null);

    const historyPayload = messages.slice(-4).map((m) => ({
      role: m.role,
      text: m.text,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          profile: currentProfile,
          history: historyPayload,
        }),
      });

      if (!res.ok) throw new Error(`chat failed: ${res.status}`);
      const data: ChatApiResponse = await res.json();

      if (!data.profile) throw new Error("chat returned no profile");

      const resolvedProfile: Profile = {
        ...(currentProfile || {}),
        ...data.profile,
      };
      if (!data.profile.income_annual && currentProfile?.income_annual) {
        resolvedProfile.income_annual = currentProfile.income_annual;
      }
      if (!data.profile.condition && currentProfile?.condition) {
        resolvedProfile.condition = currentProfile.condition;
      }
      if (!data.profile.state && currentProfile?.state) {
        resolvedProfile.state = currentProfile.state;
      }
      if (!data.profile.district && currentProfile?.district) {
        resolvedProfile.district = currentProfile.district;
      }

      setAccumulatedProfile(resolvedProfile);
      try {
        sessionStorage.setItem("namma_profile", JSON.stringify(resolvedProfile));
        localStorage.setItem("namma_profile", JSON.stringify(resolvedProfile));
      } catch {}

      const assistantMsgId = `asst-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          text: data.conversational_response || "Here are the government schemes that match your profile:",
          profile: resolvedProfile,
        },
      ]);

      if (onAnalysisComplete) {
        onAnalysisComplete({
          profile: resolvedProfile,
          conversationalResponse: data.conversational_response,
          searchTerms: data.search_terms ?? [],
          userMessage: message,
          dynamicFollowup: data.dynamic_followup,
        });
      }
      if (onProfile) {
        onProfile(resolvedProfile, message);
      }
    } catch {
      setError(t("chat_error", locale));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section aria-label="Citizen Conversation" className="flex flex-col gap-4">
      {/* Conversation Thread */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-5 shadow-sm border border-slate-200 min-h-[220px] max-h-[500px] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 text-xs text-slate-500 font-semibold">
          <span className="flex items-center gap-1 text-[#0F294A]">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Namma-Urimai Citizen Assistance
          </span>
          {messages.length > 1 && (
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-slate-600 hover:text-red-700 transition-colors"
              title="Reset conversation and start fresh"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Start Fresh</span>
            </button>
          )}
        </div>

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            }`}
          >
            {/* Avatar */}
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-sm ${
                msg.role === "user" ? "bg-[#0F294A]" : "bg-gradient-to-tr from-[#1E40AF] to-teal-600"
              }`}
            >
              {msg.role === "user" ? <User className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
            </div>

            {/* Bubble */}
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm md:text-base leading-relaxed ${
                msg.role === "user"
                  ? "bg-[#0F294A] text-white rounded-tr-none shadow-sm"
                  : "bg-slate-50 text-slate-900 border border-slate-200/90 rounded-tl-none shadow-sm"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.text}</p>

              {/* Extracted Profile Tags if present */}
              {msg.profile && (
                <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-wrap gap-1.5 text-xs">
                  {msg.profile.state && (
                    <span className="rounded-md bg-blue-100 text-blue-800 px-2 py-0.5 font-medium">
                      📍 {msg.profile.district ? `${msg.profile.district}, ` : ""}{msg.profile.state}
                    </span>
                  )}
                  {msg.profile.age && (
                    <span className="rounded-md bg-purple-100 text-purple-800 px-2 py-0.5 font-medium">
                      🎂 {msg.profile.age} years old
                    </span>
                  )}
                  {msg.profile.income_annual && (
                    <span className="rounded-md bg-emerald-100 text-emerald-900 px-2 py-0.5 font-medium">
                      💵 ₹{(msg.profile.income_annual).toLocaleString()} / yr
                    </span>
                  )}
                  {msg.profile.ration_card && (
                    <span className="rounded-md bg-amber-100 text-amber-900 px-2 py-0.5 font-bold">
                      💳 {msg.profile.ration_card === "NPHH" ? "Sugar Card (NPHH)" : msg.profile.ration_card === "PHH" ? "Rice Card (PHH)" : msg.profile.ration_card}
                    </span>
                  )}
                  {msg.profile.education_need && (
                    <span className="rounded-md bg-indigo-100 text-indigo-900 px-2 py-0.5 font-medium">
                      🎓 {msg.profile.education_need}
                    </span>
                  )}
                  {msg.profile.community && (
                    <span className="rounded-md bg-teal-100 text-teal-900 px-2 py-0.5 font-medium">
                      👥 {msg.profile.community}
                    </span>
                  )}
                  {msg.profile.medical_need && (
                    <span className="rounded-md bg-rose-100 text-rose-900 px-2 py-0.5 font-medium">
                      🏥 {msg.profile.medical_need}
                    </span>
                  )}
                  {msg.profile.condition && (
                    <span className="rounded-md bg-purple-100 text-purple-900 px-2 py-0.5 font-medium">
                      🏠 {msg.profile.condition}
                    </span>
                  )}
                  {msg.profile.general_need && (
                    <span className="rounded-md bg-teal-100 text-teal-900 px-2 py-0.5 font-medium">
                      🛡️ {msg.profile.general_need}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#1E40AF] to-teal-600 text-white shadow-sm">
              <Bot className="h-5 w-5 animate-spin" />
            </div>
            <div className="rounded-2xl rounded-tl-none bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
              <span>Matching eligibility criteria against 5,200+ Central & State schemes...</span>
            </div>
          </div>
        )}

        {/* Dynamic Contextual Clarification Chips from AI (hidden while loading) */}
        {!loading && followup && followup.chips && followup.chips.length > 0 && onChipSelect && (
          <div className="my-2 ml-12">
            <DynamicChips
              title={followup.question}
              chips={followup.chips}
              onSelect={handleChipClick}
            />
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Box Card (Spoken/mic option removed as requested) */}
      <div className="rounded-3xl bg-white p-4.5 shadow-xs border border-stone-200/90">
        <label htmlFor="situation" className="sr-only">
          {t("chat_label", locale)}
        </label>
        <div className="flex flex-col gap-3">
          <textarea
            id="situation"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            placeholder={t("chat_placeholder", locale)}
            className="w-full rounded-2xl border border-stone-300/80 p-3.5 text-base text-stone-900 placeholder:text-stone-400 focus:border-[#132A1D] focus:ring-2 focus:ring-emerald-100 outline-none transition-all resize-none font-normal"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Quick Sample Situation Pills */}
            <div className="flex flex-wrap items-center gap-1.5" aria-label={t("sample_label", locale)}>
              <span className="text-xs font-bold text-stone-500 mr-1 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Try:
              </span>
              {SAMPLES.map((sample, idx) => {
                const label = t(sample.key, locale);
                const display = label && label !== sample.key ? label : sample.fallback;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setText(display);
                      handleSend(display);
                    }}
                    className="min-h-[32px] rounded-full border border-stone-200/90 bg-stone-50/80 px-3.5 py-1 text-xs font-semibold text-stone-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-950 transition-all text-left shadow-2xs cursor-pointer"
                  >
                    {display.length > 35 ? display.slice(0, 35) + "..." : display}
                  </button>
                );
              })}
            </div>

            {/* Action Button: Send only */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={loading || text.trim() === ""}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#132A1D] px-6 text-xs font-bold text-white shadow-xs hover:bg-[#1E3A2B] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                <span>{loading ? t("sending", locale) : t("send", locale)}</span>
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs font-medium text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
