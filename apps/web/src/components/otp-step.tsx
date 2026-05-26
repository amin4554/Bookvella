"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { OtpInput, type OtpInputHandle } from "@/components/otp-input";

type Theme = "card" | "modal";

type OtpStepProps = {
  // Short bold lead. e.g. "Confirm your email".
  title: string;
  // The contact address the code was sent to. Rendered emphasised inside the
  // info banner — keeps copy honest about *which* mailbox the user should be
  // checking.
  recipient: string;
  // Optional ISO timestamp. When present the info banner shows the wall-clock
  // expiry; combined with the resend countdown this is enough urgency signal
  // without a full ticking timer (which would re-render every second).
  expiresAt?: string | null;
  value: string;
  onChange: (next: string) => void;
  // Fires on form submit AND when the input auto-completes at length 6. The
  // call-site doesn't need to know which trigger fired.
  onSubmit: (code: string) => void | Promise<void>;
  // Resend handler. When provided the resend button is rendered with a
  // cooldown after each click.
  onResend?: () => void | Promise<void>;
  // Back / cancel handler. When provided we render a left-side text button.
  onBack?: () => void;
  backLabel?: string;
  submitLabel: string;
  submittingLabel?: string;
  submitting?: boolean;
  error?: string | null;
  // Optional override; sign-up wants its gradient, settings wants the brand
  // pink. Defaults match the surrounding card.
  accent?: "brand" | "register";
  // Lets the call-site stack extra hints below the input ("Check spam", etc).
  helper?: ReactNode;
  // Cooldown applied to the resend button after each click, in seconds.
  // Defaults to 30s — short enough to be useful, long enough to absorb double
  // clicks and SMTP delivery jitter.
  resendCooldownSeconds?: number;
  theme?: Theme;
};

export function OtpStep({
  title,
  recipient,
  expiresAt,
  value,
  onChange,
  onSubmit,
  onResend,
  onBack,
  backLabel = "← Back",
  submitLabel,
  submittingLabel,
  submitting = false,
  error,
  accent = "brand",
  helper,
  resendCooldownSeconds = 30,
  theme = "modal",
}: OtpStepProps) {
  const inputRef = useRef<OtpInputHandle | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    // Visible countdown for the resend button. Re-renders once a second only
    // while the button is disabled — drops back to no-op when it hits zero so
    // we don't keep ticking in the background.
    const handle = window.setInterval(() => {
      setCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);
    return () => window.clearInterval(handle);
  }, [cooldown]);

  // Whenever the call-site clears the code (e.g. after a bad-code error) make
  // sure focus snaps back to the first empty cell so the user can retype
  // without grabbing the mouse.
  useEffect(() => {
    if (value.length === 0) {
      inputRef.current?.focus();
    }
  }, [value]);

  async function handleSubmit() {
    if (submitting) return;
    await onSubmit(value);
  }

  async function handleResend() {
    if (!onResend || cooldown > 0 || resending || submitting) return;
    setResending(true);
    try {
      await onResend();
      setCooldown(resendCooldownSeconds);
      inputRef.current?.clear();
    } finally {
      setResending(false);
    }
  }

  const submitButtonClass =
    accent === "register"
      ? "bg-gradient-to-r from-[#14B8A6] via-[#7C4DFF] to-[#C026D3]"
      : "bg-gradient-to-r from-[#FF6267] to-[#FF8A4C]";

  const infoBannerClass =
    theme === "card"
      ? "rounded-2xl border border-[#EEE7DF] bg-[#FFFBF7] p-4 text-[13px] text-[#374151]"
      : "rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-3.5 text-[13px] text-[#374151]";

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <div className={infoBannerClass}>
        <p className="font-bold text-[#0B1220]">{title}</p>
        <p className="mt-1">
          Enter the 6-digit code we sent to{" "}
          <span className="font-semibold text-[#0B1220]">{recipient}</span>.
          {expiresAt ? (
            <>
              {" "}
              The code expires at{" "}
              <span className="font-semibold text-[#0B1220]">
                {formatExpiresClock(expiresAt)}
              </span>
              .
            </>
          ) : null}
        </p>
      </div>

      <OtpInput
        ref={inputRef}
        value={value}
        onChange={onChange}
        onComplete={(code) => {
          // Auto-submit the moment the field fills. The submitting guard
          // inside handleSubmit covers the double-fire case where the user
          // also clicks the button.
          void onSubmit(code);
        }}
        disabled={submitting}
        autoFocus
        accent={accent}
      />

      {helper ? (
        <p className="text-[12px] text-[#6B7280]">{helper}</p>
      ) : null}

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3.5 text-[13px] text-red-800">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
          <p>{error}</p>
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitting || value.length !== 6}
        className={`flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60 ${submitButtonClass}`}
      >
        {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
        {submitting ? submittingLabel ?? "Verifying…" : submitLabel}
      </button>

      <div className="flex items-center justify-between text-[13px] font-semibold">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="text-[#6B7280] hover:text-[#0B1220] disabled:opacity-60"
          >
            {backLabel}
          </button>
        ) : (
          <span />
        )}
        {onResend ? (
          <button
            type="button"
            onClick={() => void handleResend()}
            disabled={cooldown > 0 || resending || submitting}
            className={
              accent === "register"
                ? "text-[#14B8A6] hover:underline disabled:text-[#9CA3AF] disabled:no-underline"
                : "text-[#FF5F63] hover:underline disabled:text-[#9CA3AF] disabled:no-underline"
            }
          >
            {resending
              ? "Sending…"
              : cooldown > 0
                ? `Resend in 0:${cooldown.toString().padStart(2, "0")}`
                : "Resend code"}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function formatExpiresClock(value: string) {
  try {
    return new Date(value).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}
