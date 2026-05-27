"use client";

import { useState } from "react";
import { Check } from "lucide-react";

type CookiePrefs = {
  analytics: boolean;
  marketing: boolean;
};

const DEFAULT_PREFS: CookiePrefs = {
  analytics: false,
  marketing: false,
};

export function CookiePreferences() {
  const [prefs, setPrefs] = useState<CookiePrefs>(() => {
    if (typeof window === "undefined") return DEFAULT_PREFS;
    try {
      const stored = window.localStorage.getItem("bv.cookiePrefs");
      return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });
  const [saved, setSaved] = useState(false);

  function save(next: CookiePrefs) {
    setPrefs(next);
    try {
      window.localStorage.setItem("bv.cookiePrefs", JSON.stringify(next));
      window.localStorage.setItem("bv.cookieDecisionAt", new Date().toISOString());
    } catch {
      // Preferences still update visually for this session.
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 3000);
  }

  return (
    <section
      id="prefs"
      className="mt-12 rounded-2xl border border-line-cream bg-surface-card shadow-sm"
    >
      <div className="border-b border-line-cream p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          Your preferences
        </p>
        <h2 className="mt-1 text-[22px] font-bold tracking-[-0.02em]">
          Cookie settings
        </h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Strictly necessary cookies are always on. Non-essential categories are
          off by default and only turn on if Bookvella adds those tools and you
          choose to allow them.
        </p>
      </div>

      <PreferenceRow
        title="Strictly necessary"
        text="Authentication, session security, and booking flow protection."
        locked
        enabled
        badge="Always on"
      />
      <PreferenceRow
        title="Analytics"
        text="Anonymous aggregate stats to improve the product. Not currently in use."
        enabled={prefs.analytics}
        onToggle={() => save({ ...prefs, analytics: !prefs.analytics })}
      />
      <PreferenceRow
        title="Marketing"
        text="Ad or referral measurement. Not currently in use."
        enabled={prefs.marketing}
        onToggle={() => save({ ...prefs, marketing: !prefs.marketing })}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-cream p-5">
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-soft bg-surface-card px-4 text-[13px] font-bold hover:bg-surface-soft"
          onClick={() => save(DEFAULT_PREFS)}
        >
          Reject all non-essential
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange px-4 text-[13px] font-bold text-white shadow-sm"
          onClick={() => save(prefs)}
        >
          <Check className="size-4" /> Save preferences
        </button>
      </div>

      {saved ? (
        <div className="border-t border-success-border bg-success-tint px-5 py-3 text-[12.5px] font-bold text-success-deep">
          Saved. Your preferences will apply on future page loads.
        </div>
      ) : null}
    </section>
  );
}

function PreferenceRow({
  title,
  text,
  enabled,
  locked,
  badge,
  onToggle,
}: {
  title: string;
  text: string;
  enabled: boolean;
  locked?: boolean;
  badge?: string;
  onToggle?: () => void;
}) {
  return (
    <div className="flex items-start gap-3.5 border-t border-line-cream px-5 py-4 first:border-t-0">
      <button
        type="button"
        disabled={locked}
        onClick={onToggle}
        className={`relative mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full transition ${
          enabled
            ? "bg-gradient-to-r from-brand-coral to-brand-orange"
            : "bg-line-soft"
        } ${locked ? "cursor-not-allowed opacity-60" : ""}`}
        aria-pressed={enabled}
      >
        <span
          className={`absolute top-0.5 size-[18px] rounded-full bg-surface-card shadow transition ${
            enabled ? "left-[18px]" : "left-0.5"
          }`}
        />
      </button>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[14px] font-bold">{title}</p>
          {badge ? (
            <span className="rounded-full bg-success-mint px-2 py-0.5 text-[10px] font-bold text-success">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-[13px] leading-snug text-ink-soft">{text}</p>
      </div>
    </div>
  );
}
