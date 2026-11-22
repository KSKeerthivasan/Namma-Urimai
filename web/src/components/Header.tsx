"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { t, type Locale } from "@/lib/i18n";
import { Bookmark, Phone, Check, User, LogOut, ShieldCheck } from "lucide-react";
import CitizenAuthModal from "@/components/CitizenAuthModal";

const LANGUAGES: { code: Locale; label: string; name: string }[] = [
  { code: "en", label: "English", name: "English" },
  { code: "ta", label: "தமிழ்", name: "Tamil" },
  { code: "hi", label: "हिन्दी", name: "Hindi" },
  { code: "te", label: "తెలుగు", name: "Telugu" },
];

const HELPLINES = [
  { number: "108", label: "Medical", title: "Medical Emergency" },
  { number: "104", label: "Health", title: "Health & Telemedicine Helpline" },
  { number: "14417", label: "Education", title: "Education Helpline" },
  { number: "181", label: "Women", title: "Women Helpline" },
  { number: "1100", label: "CM Helpline", title: "CM Citizen Grievance Helpline" },
];

type CitizenUser = {
  phone: string;
  name: string;
  loggedIn: boolean;
};

export default function Header() {
  const { locale, setLocale } = useLocale();
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CitizenUser | null>(null);

  useEffect(() => {
    // Check initial login state
    try {
      const stored = localStorage.getItem("namma_citizen_user");
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch {}

    const handleAuthChange = (e: Event) => {
      const customEvent = e as CustomEvent<CitizenUser | null>;
      if (customEvent.detail) {
        setCurrentUser(customEvent.detail);
      } else {
        setCurrentUser(null);
      }
    };

    window.addEventListener("namma-auth-changed", handleAuthChange);
    return () => window.removeEventListener("namma-auth-changed", handleAuthChange);
  }, []);

  function handleLogout() {
    try {
      localStorage.removeItem("namma_citizen_user");
      window.dispatchEvent(new CustomEvent("namma-auth-changed", { detail: null }));
    } catch {}
    setCurrentUser(null);
  }

  function handleHelplineClick(e: React.MouseEvent<HTMLAnchorElement>, number: string, title: string) {
    const isMobile = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    
    // On mobile devices, allow native tel: link to trigger the phone dialer
    if (isMobile) {
      return;
    }

    // On desktop browsers where tel: might not be configured, also copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(number).then(() => {
        setCopiedNumber(`${number} - ${title}`);
        setTimeout(() => setCopiedNumber(null), 3500);
      }).catch(() => {
        setCopiedNumber(`Dial ${number} from your phone (${title})`);
        setTimeout(() => setCopiedNumber(null), 3500);
      });
    } else {
      setCopiedNumber(`Dial ${number} from your phone (${title})`);
      setTimeout(() => setCopiedNumber(null), 3500);
    }
  }

  return (
    <header className="bg-white border-b border-slate-200">
      {/* 24x7 Government Helpline Utility Strip */}
      <div className="bg-[#0F294A] text-slate-100 text-xs px-4 py-2 border-b border-slate-800">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 font-medium text-slate-300">
            <Phone className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold text-white">24x7 Helplines (Toll-Free):</span>
          </div>

          <nav aria-label={t("helplines_nav", locale)} className="flex flex-wrap items-center gap-2">
            {HELPLINES.map((h) => (
              <a
                key={h.number}
                href={`tel:${h.number}`}
                onClick={(e) => handleHelplineClick(e, h.number, h.title)}
                title={`Call ${h.number} - ${h.title} (Opens phone dialer or copies number)`}
                className="inline-flex items-center gap-1 rounded-md bg-slate-800/90 hover:bg-[#1E40AF] px-2.5 py-0.5 text-slate-200 hover:text-white transition-all cursor-pointer border border-slate-700/60"
              >
                <span className="font-bold text-amber-400 tracking-wide">{h.number}</span>
                <span className="text-slate-300 text-[11px] font-medium">{h.label}</span>
              </a>
            ))}
          </nav>

          {/* Desktop Clipboard Notification Toast */}
          {copiedNumber && (
            <div className="w-full flex items-center justify-center gap-1.5 bg-emerald-900/90 text-emerald-100 px-3 py-1 rounded border border-emerald-500/40 text-xs animate-fade-in font-medium">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Helpline <strong>{copiedNumber}</strong> copied to clipboard (also opening phone dialer if available).</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Brand & Action Header */}
      <div className="mx-auto max-w-6xl px-4 py-3.5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-2xl md:text-3xl font-extrabold text-[#0F294A] tracking-tight hover:opacity-90 transition-opacity">
              {t("app_name", locale)}
            </Link>
            <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
              Civic Navigator
            </span>
          </div>
          <p className="text-sm md:text-base text-slate-600 font-medium">
            {t("app_tagline", locale)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Language Selector */}
          <div role="group" aria-label={t("language_group", locale)} className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {LANGUAGES.map((lang) => {
              const active = locale === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  aria-label={`Show in ${lang.name}`}
                  aria-pressed={active}
                  onClick={() => setLocale(lang.code)}
                  className={`min-h-[38px] px-3 rounded-lg text-sm font-semibold transition-all ${
                    active
                      ? "bg-[#1E40AF] text-white shadow-xs"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-200"
                  }`}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>

          {/* Citizen Login / Status Button */}
          {currentUser ? (
            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-1.5 text-xs">
              <div className="flex items-center gap-1 font-bold text-emerald-900">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>+91 {currentUser.phone.slice(-4)}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Log out to Guest Mode"
                className="text-slate-500 hover:text-red-700 p-1 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-[#0F294A] bg-white px-3.5 text-sm font-bold text-[#0F294A] hover:bg-blue-50 transition-all cursor-pointer shadow-2xs"
            >
              <User className="h-4 w-4 text-[#1E40AF]" />
              <span>Login</span>
            </button>
          )}

          {/* Saved Schemes Link */}
          <Link
            href="/tracker"
            className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-[#0F294A] px-4 text-sm font-bold text-white shadow-sm hover:bg-[#1E40AF] transition-all"
          >
            <Bookmark className="h-4 w-4" />
            <span>{t("nav_saved", locale)}</span>
          </Link>
        </div>
      </div>

      {/* Citizen Authentication Modal */}
      <CitizenAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onLoginSuccess={(user) => setCurrentUser(user as CitizenUser)}
      />
    </header>
  );
}
