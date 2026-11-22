"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { t, type Locale } from "@/lib/i18n";
import { Bookmark, Phone, Check } from "lucide-react";

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

export default function Header() {
  const { locale, setLocale } = useLocale();
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

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
    <header className="bg-[#F8FAF7]/95 backdrop-blur-md border-b border-stone-200/80 sticky top-0 z-40">
      {/* 24x7 Government Helpline Utility Strip */}
      <div className="bg-[#132A1D] text-stone-200 text-xs px-4 py-2 border-b border-emerald-950/40">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 font-medium text-stone-300">
            <Phone className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold text-white tracking-wide">24x7 Helplines (Toll-Free):</span>
          </div>

          <nav aria-label={t("helplines_nav", locale)} className="flex flex-wrap items-center gap-1.5">
            {HELPLINES.map((h) => (
              <a
                key={h.number}
                href={`tel:${h.number}`}
                onClick={(e) => handleHelplineClick(e, h.number, h.title)}
                title={`Call ${h.number} - ${h.title} (Opens phone dialer or copies number)`}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 hover:bg-emerald-700/40 px-3 py-0.5 text-stone-200 hover:text-white transition-all cursor-pointer border border-white/15"
              >
                <span className="font-bold text-amber-300 tracking-wide">{h.number}</span>
                <span className="text-stone-300 text-[11px] font-medium">{h.label}</span>
              </a>
            ))}
          </nav>

          {/* Desktop Clipboard Notification Toast */}
          {copiedNumber && (
            <div className="w-full flex items-center justify-center gap-1.5 bg-emerald-950 text-emerald-200 px-3 py-1 rounded-full border border-emerald-500/40 text-xs animate-fade-in font-medium">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Helpline <strong>{copiedNumber}</strong> copied to clipboard (also opening phone dialer if available).</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Brand & Action Header */}
      <div className="mx-auto max-w-6xl px-4 py-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <Link href="/" className="font-serif-display text-2xl md:text-3xl font-bold text-[#132A1D] tracking-tight hover:opacity-90 transition-opacity">
              {t("app_name", locale)}
            </Link>
            <span className="rounded-full bg-emerald-100/80 border border-emerald-300/80 px-2.5 py-0.5 text-xs font-bold text-emerald-900 tracking-wide">
              Civic Navigator
            </span>
          </div>
          <p className="text-xs md:text-sm text-stone-600 font-medium mt-0.5">
            {t("app_tagline", locale)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Language Selector in Pill Container */}
          <div role="group" aria-label={t("language_group", locale)} className="flex items-center gap-1 bg-stone-200/70 p-1 rounded-full border border-stone-300/60">
            {LANGUAGES.map((lang) => {
              const active = locale === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  aria-label={`Show in ${lang.name}`}
                  aria-pressed={active}
                  onClick={() => setLocale(lang.code)}
                  className={`min-h-[34px] px-3.5 rounded-full text-xs font-bold transition-all ${
                    active
                      ? "bg-[#132A1D] text-white shadow-xs"
                      : "text-stone-700 hover:text-stone-900 hover:bg-stone-300/50"
                  }`}
                >
                  {lang.label}
                </button>
              );
            })}
          </div>

          {/* Saved Schemes Link */}
          <Link
            href="/tracker"
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-[#132A1D] px-5 text-xs font-bold text-white shadow-xs hover:bg-[#1E3A2B] transition-all"
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>{t("nav_saved", locale)}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
