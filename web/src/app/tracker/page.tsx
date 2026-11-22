"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { t, type TranslationKey } from "@/lib/i18n";
import {
  SAVED_EVENT,
  daysUntilClose,
  readSaved,
  toggleSaved,
  type SavedScheme,
} from "@/lib/savedSchemes";

// Numbers are fixed; names are translated through t().
const HELPLINES: { number: string; href: string; nameKey: TranslationKey }[] = [
  { number: "108", href: "tel:108", nameKey: "helpline_ambulance" },
  { number: "104", href: "tel:104", nameKey: "helpline_telemedicine" },
  { number: "181", href: "tel:181", nameKey: "helpline_women_distress" },
  { number: "14417", href: "tel:14417", nameKey: "helpline_scholarship" },
  { number: "1800-425-3993", href: "tel:18004253993", nameKey: "helpline_cmchis" },
];

const LINK_CLASS =
  "inline-flex min-h-[48px] items-center font-semibold text-govtblue underline underline-offset-4 hover:text-navy";

export default function TrackerPage() {
  const { locale } = useLocale();
  const [saved, setSaved] = useState<SavedScheme[]>([]);

  useEffect(() => {
    const sync = () => setSaved(readSaved());
    sync();
    window.addEventListener(SAVED_EVENT, sync);
    return () => window.removeEventListener(SAVED_EVENT, sync);
  }, []);

  const closing = saved
    .map((item) => ({ item, days: daysUntilClose(item.scheme_close_date) }))
    .filter((row): row is { item: SavedScheme; days: number } =>
      row.days !== null && row.days >= 0 && row.days <= 30
    )
    .sort((a, b) => a.days - b.days);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-base text-slate-900">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
        <header className="space-y-3">
          <Link href="/" className={LINK_CLASS}>
            ← {t("back_to_search", locale)}
          </Link>
          <h1 className="text-3xl font-bold text-navy">{t("tracker_title", locale)}</h1>
        </header>

        <section
          aria-labelledby="tracker-saved"
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
        >
          <h2 id="tracker-saved" className="text-xl font-bold text-navy">
            {t("section_saved", locale)}
          </h2>
          {saved.length === 0 ? (
            <p className="text-base text-slate-800">
              {t("saved_empty", locale)}{" "}
              <Link href="/" className={LINK_CLASS}>
                {t("back_to_search", locale)}
              </Link>
            </p>
          ) : (
            <ul className="space-y-3">
              {saved.map((item) => (
                <li
                  key={item.slug}
                  className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="text-base font-bold text-navy">
                      {item.scheme_name}
                      {item.short_title ? ` (${item.short_title})` : ""}
                    </p>
                    {item.level && <p className="text-sm text-slate-700">{item.level}</p>}
                    <Link
                      href={`/schemes/${item.slug}`}
                      className="inline-flex min-h-[48px] items-center font-semibold text-govtblue underline underline-offset-4 hover:text-navy"
                    >
                      {t("view_details", locale)}
                    </Link>
                  </div>
                  <button
                    type="button"
                    aria-label={`${t("remove", locale)}: ${item.scheme_name}`}
                    onClick={() => toggleSaved(item)}
                    className="min-h-[48px] min-w-[48px] rounded-lg border border-slate-500 bg-white px-4 font-semibold text-slate-900 hover:bg-slate-100"
                  >
                    {t("remove", locale)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="tracker-closing"
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
        >
          <h2 id="tracker-closing" className="text-xl font-bold text-navy">
            {t("section_closing", locale)}
          </h2>
          {closing.length === 0 ? (
            <p className="text-base text-slate-800">{t("closing_empty", locale)}</p>
          ) : (
            <ul className="space-y-3">
              {closing.map(({ item, days }) => (
                <li
                  key={item.slug}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-4"
                >
                  <span className="text-base font-semibold text-navy">{item.scheme_name}</span>
                  <span className="rounded-full bg-saffron px-3 py-1 text-sm font-bold text-navy">
                    {days === 0
                      ? t("closes_today", locale)
                      : t("closes_in", locale, { n: days })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="tracker-helplines"
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6"
        >
          <h2 id="tracker-helplines" className="text-xl font-bold text-navy">
            {t("section_helplines", locale)}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {HELPLINES.map((line) => (
              <li key={line.number}>
                <a
                  href={line.href}
                  aria-label={`${t("call", locale)} ${line.number}: ${t(line.nameKey, locale)}`}
                  className="flex min-h-[48px] flex-col justify-center rounded-lg border border-govtblue bg-white px-4 py-2 hover:bg-slate-100"
                >
                  <span className="text-lg font-bold text-govtblue">{line.number}</span>
                  <span className="text-base text-slate-900">{t(line.nameKey, locale)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
