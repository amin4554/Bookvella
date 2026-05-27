"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type BookingStep = "slots" | "details" | "code" | "success";

const STEPS: { id: BookingStep; label: string }[] = [
  { id: "slots", label: "Pick a time" },
  { id: "details", label: "Your details" },
  { id: "code", label: "Verify" },
];

export function Stepper({ step }: { step: BookingStep }) {
  // The stepper hides on the success screen for a cleaner finish.
  if (step === "success") return null;

  const currentIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="mb-8 flex items-center gap-2">
      {STEPS.map((entry, idx) => {
        const state =
          idx < currentIndex ? "done" : idx === currentIndex ? "active" : "todo";
        return (
          <div key={entry.id} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-2.5 text-[13px] font-bold",
                state === "active"
                  ? "text-brand"
                  : state === "done"
                    ? "text-success-strong"
                    : "text-ink-muted",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-extrabold",
                  state === "active"
                    ? "bg-gradient-to-br from-brand-coral to-brand-orange text-white shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
                    : state === "done"
                      ? "bg-success text-white"
                      : "bg-line-subtle text-ink-muted",
                )}
              >
                {state === "done" ? <Check className="size-4" /> : idx + 1}
              </span>
              <span className="hidden sm:inline">{entry.label}</span>
            </div>
            {idx < STEPS.length - 1 ? (
              <span
                className={cn(
                  "mx-1.5 h-0.5 flex-1 rounded-full",
                  state === "done"
                    ? "bg-success"
                    : state === "active"
                      ? "bg-gradient-to-r from-success to-brand"
                      : "bg-line-cream",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
