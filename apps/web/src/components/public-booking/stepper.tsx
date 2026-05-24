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
                  ? "text-[#FF5F63]"
                  : state === "done"
                    ? "text-[#15803D]"
                    : "text-[#9CA3AF]",
              )}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-extrabold",
                  state === "active"
                    ? "bg-gradient-to-br from-[#FF6267] to-[#FF8A4C] text-white shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
                    : state === "done"
                      ? "bg-[#16A34A] text-white"
                      : "bg-[#F3F4F6] text-[#9CA3AF]",
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
                    ? "bg-[#16A34A]"
                    : state === "active"
                      ? "bg-gradient-to-r from-[#16A34A] to-[#FF5F63]"
                      : "bg-[#EEE7DF]",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
