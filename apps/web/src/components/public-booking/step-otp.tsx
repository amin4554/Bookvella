"use client";

import {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatFullDateKey,
  formatGuestTime,
  formatLocationLabel,
} from "./helpers";
import type { PublicEvent } from "@/lib/api";

type Props = {
  email: string;
  devCode?: string;
  submitting: boolean;
  /** ms-since-epoch when the user last requested a code; resend unlocks 60s later. */
  lastSentAt: number;
  data: PublicEvent;
  timezone: string;
  selectedDateKey: string;
  selectedStartUtc: string;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onChangeEmail: () => void;
};

const RESEND_COOLDOWN_SECONDS = 60;

export function StepOtp({
  email,
  devCode,
  submitting,
  lastSentAt,
  data,
  timezone,
  selectedDateKey,
  selectedStartUtc,
  onSubmit,
  onResend,
  onChangeEmail,
}: Props) {
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus the first empty cell whenever the code is reset.
  useEffect(() => {
    if (digits.every((d) => d === "")) {
      inputsRef.current[0]?.focus();
    }
  }, [digits]);

  // Resend cooldown timer.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, []);
  const remaining = useMemo(
    () => Math.max(0, RESEND_COOLDOWN_SECONDS - Math.floor((now - lastSentAt) / 1000)),
    [now, lastSentAt],
  );
  const canResend = remaining === 0;
  const resendLabel = canResend
    ? "Resend code"
    : `Resend in ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

  function setAt(idx: number, value: string) {
    const next = [...digits];
    next[idx] = value;
    setDigits(next);
  }

  function handleInput(idx: number, raw: string) {
    const digit = raw.replace(/\D/g, "").slice(-1);
    if (!digit) {
      setAt(idx, "");
      return;
    }
    setAt(idx, digit);
    // Auto-advance to the next cell.
    if (idx < 5) inputsRef.current[idx + 1]?.focus();
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputsRef.current[focusIdx]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>, idx: number) {
    if (event.key === "Backspace" && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (event.key === "ArrowLeft" && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    } else if (event.key === "ArrowRight" && idx < 5) {
      inputsRef.current[idx + 1]?.focus();
    }
  }

  const code = digits.join("");
  const complete = code.length === 6;

  return (
    <section className="mx-auto max-w-[520px] py-6 text-center">
      <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-purple-tint">
        <Mail className="size-7 text-purple-strong" />
      </div>
      <h1
        className="mt-5 text-[36px] font-extrabold md:text-[44px]"
        style={{ letterSpacing: "-0.03em", lineHeight: "1.02" }}
      >
        Check your email
      </h1>
      <p className="mt-2 text-[14px] text-ink-soft">
        We sent a 6-digit code to{" "}
        <strong className="text-ink-strong">{email}</strong>
      </p>
      <p className="mt-1 text-[12px] text-ink-muted">
        Didn&apos;t get it? Check your spam folder or resend below.
      </p>

      {devCode ? (
        <div className="mt-4 rounded-lg border border-warning-border bg-warning-tint px-4 py-2.5 text-[12px] text-warning-strong">
          Development code: <strong className="tabular-nums">{devCode}</strong>
        </div>
      ) : null}

      <div className="mt-7 flex justify-center gap-2.5">
        {digits.map((digit, idx) => (
          <input
            key={idx}
            ref={(node) => {
              inputsRef.current[idx] = node;
            }}
            value={digit}
            onChange={(event) => handleInput(idx, event.target.value)}
            onKeyDown={(event) => handleKeyDown(event, idx)}
            onPaste={handlePaste}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            aria-label={`Digit ${idx + 1}`}
            className={cn(
              "grid size-[62px] place-items-center rounded-2xl border-2 text-center text-[32px] font-extrabold outline-none transition sm:size-[64px]",
              digit
                ? "border-brand bg-brand-tint-100 text-brand"
                : "border-line-cream bg-surface-card text-ink-faint",
              "focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]",
            )}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => onSubmit(code)}
        disabled={!complete || submitting}
        className="mt-7 inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-coral to-brand-orange px-5 py-3.5 text-[15px] font-bold text-white shadow-[0_12px_24px_-10px_rgba(255,95,99,0.5)] hover:brightness-105 disabled:opacity-60"
      >
        {submitting ? "Confirming…" : "Verify & confirm booking →"}
      </button>

      <p className="mt-4 text-[12.5px] text-ink-soft">
        Didn&apos;t receive it?{" "}
        <button
          type="button"
          disabled={!canResend}
          onClick={onResend}
          className={cn(
            "font-bold",
            canResend
              ? "text-brand hover:underline"
              : "cursor-not-allowed text-ink-muted",
          )}
        >
          {resendLabel}
        </button>
      </p>

      <div className="mt-8 rounded-2xl border border-line-cream bg-surface-card p-4 text-left">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          Your appointment
        </p>
        <p className="mt-1 text-[14px] font-bold">
          {formatFullDateKey(selectedDateKey)} —{" "}
          {formatGuestTime(selectedStartUtc, timezone)}
        </p>
        <p className="text-[12px] text-ink-soft">
          {data.eventType.title} · {data.eventType.durationMinutes} minutes ·{" "}
          {data.eventType.locationDetails ??
            formatLocationLabel(data.eventType.locationType)}
        </p>
      </div>

      <button
        type="button"
        onClick={onChangeEmail}
        className="mt-5 text-[12.5px] font-bold text-ink-muted hover:text-ink-strong"
      >
        ← Use a different email
      </button>
    </section>
  );
}
