"use client";

import { useEffect, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import {
  SAVED_EVENT,
  isSaved,
  toggleSaved,
  type SavedSchemeInput,
} from "@/lib/savedSchemes";

type Props = {
  scheme: SavedSchemeInput;
};

export default function SaveSchemeButton({ scheme }: Props) {
  const { locale } = useLocale();
  // Starts false on both server and client, then syncs after mount.
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(isSaved(scheme.slug));
    sync();
    window.addEventListener(SAVED_EVENT, sync);
    return () => window.removeEventListener(SAVED_EVENT, sync);
  }, [scheme.slug]);

  const Icon = saved ? BookmarkCheck : Bookmark;

  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => toggleSaved(scheme)}
      className={`inline-flex min-h-[48px] min-w-[48px] items-center gap-2 rounded-lg border px-4 text-base font-semibold ${
        saved
          ? "border-navy bg-navy text-white hover:bg-govtblue"
          : "border-govtblue bg-white text-govtblue hover:bg-slate-100"
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {saved ? t("saved", locale) : t("save_scheme", locale)}
    </button>
  );
}
