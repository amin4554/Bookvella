"use client";

import {
  ClipboardEvent,
  KeyboardEvent,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";

export type OtpInputHandle = {
  focus: () => void;
  clear: () => void;
};

type OtpInputProps = {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  // Tints used by every site that embeds this. Sign-up uses teal/purple;
  // settings uses the brand pink. Keeping it themeable avoids per-site CSS.
  accent?: "brand" | "register";
  // Aria-label for the group as a whole.
  ariaLabel?: string;
};

// Segmented 6-box OTP entry. Each cell is its own input so the browser
// (especially mobile) shows the numeric keypad and surfaces one-time-code
// autofill suggestions individually. Paste of the full code splits across
// cells, backspace at an empty cell walks back, and we fire `onComplete`
// exactly once when the field reaches `length` digits — that's the hook for
// auto-submit at the call site.
export const OtpInput = forwardRef<OtpInputHandle, OtpInputProps>(function OtpInput(
  {
    value,
    onChange,
    onComplete,
    length = 6,
    disabled,
    autoFocus,
    accent = "brand",
    ariaLabel = "One-time code",
  },
  forwardedRef,
) {
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const lastFiredCompleteRef = useRef<string | null>(null);

  useImperativeHandle(
    forwardedRef,
    () => ({
      focus: () => {
        const target = inputsRef.current.find((input) => input && !input.value);
        (target ?? inputsRef.current[0])?.focus();
      },
      clear: () => {
        onChange("");
        lastFiredCompleteRef.current = null;
        inputsRef.current[0]?.focus();
      },
    }),
    [onChange],
  );

  const cells = useMemo(() => {
    const padded = value.padEnd(length, " ");
    return Array.from({ length }, (_, index) => padded[index]?.trim() ?? "");
  }, [value, length]);

  useEffect(() => {
    if (!autoFocus) return;
    inputsRef.current[0]?.focus();
  }, [autoFocus]);

  useEffect(() => {
    // Auto-submit hook: only fire once per distinct complete code so that
    // re-renders with the same value don't repeat the network call.
    if (!onComplete) return;
    if (value.length !== length) {
      lastFiredCompleteRef.current = null;
      return;
    }
    if (lastFiredCompleteRef.current === value) return;
    lastFiredCompleteRef.current = value;
    onComplete(value);
  }, [value, length, onComplete]);

  function setDigit(index: number, digit: string) {
    const sanitized = digit.replace(/\D/g, "").slice(0, 1);
    const next =
      value.slice(0, index) + sanitized + value.slice(index + 1, length);
    onChange(next.slice(0, length));
  }

  function handleChange(index: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 0) {
      setDigit(index, "");
      return;
    }
    if (digits.length === 1) {
      setDigit(index, digits);
      if (index < length - 1) {
        inputsRef.current[index + 1]?.focus();
      }
      return;
    }
    // Mobile autofill often dumps the whole code into one cell. Spread it.
    const spread = digits.slice(0, length - index);
    const next =
      value.slice(0, index) + spread + value.slice(index + spread.length);
    onChange(next.slice(0, length));
    const focusIndex = Math.min(index + spread.length, length - 1);
    inputsRef.current[focusIndex]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      if (cells[index]) {
        setDigit(index, "");
        return;
      }
      if (index > 0) {
        event.preventDefault();
        setDigit(index - 1, "");
        inputsRef.current[index - 1]?.focus();
      }
      return;
    }
    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputsRef.current[index - 1]?.focus();
      return;
    }
    if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      inputsRef.current[index + 1]?.focus();
    }
  }

  function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length - index);
    if (!pasted) return;
    event.preventDefault();
    const next =
      value.slice(0, index) + pasted + value.slice(index + pasted.length);
    onChange(next.slice(0, length));
    const focusIndex = Math.min(index + pasted.length, length - 1);
    inputsRef.current[focusIndex]?.focus();
  }

  const cellFocusClass =
    accent === "register"
      ? "focus:border-success-teal-bright focus:shadow-[0_0_0_4px_rgba(20,184,166,0.18)]"
      : "focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.18)]";

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex items-center justify-between gap-2 sm:gap-2.5"
    >
      {cells.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            inputsRef.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          // Each cell advertises one-time-code so password managers and
          // platform autofill can populate the whole field at once.
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${length}`}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          onFocus={(event) => event.currentTarget.select()}
          className={`h-14 w-full min-w-0 flex-1 rounded-2xl border bg-surface-card text-center text-[22px] font-bold tabular-nums outline-none transition ${
            digit
              ? "border-ink-strong text-ink-strong"
              : "border-line-soft text-ink-strong"
          } ${cellFocusClass} disabled:cursor-not-allowed disabled:opacity-60`}
        />
      ))}
    </div>
  );
});
