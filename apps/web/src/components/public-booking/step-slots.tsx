"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import type { AvailableSlot } from "@/lib/api";
import {
  detectBrowserTimezone,
  formatOffset,
  timezoneCity,
} from "@/lib/timezones";
import { TimezoneCombobox } from "@/components/timezone-combobox";
import { cn } from "@/lib/utils";
import {
  bucketSlots,
  formatFullDateKey,
  formatGuestTime,
  slotGuestDateKey,
} from "./helpers";

type Props = {
  timezone: string;
  loading: boolean;
  slotsByDate: Map<string, AvailableSlot[]>;
  availableDates: string[];
  selectedDate: string;
  selectedSlot: AvailableSlot | null;
  /** Set when a previously-selected slot just disappeared (race during confirm). */
  slotGoneWarning: boolean;
  onDismissSlotGoneWarning: () => void;
  onTimezoneChange: (timezone: string) => void;
  onDateChange: (date: string) => void;
  onSelectSlot: (slot: AvailableSlot) => void;
  onContinue: () => void;
  durationMinutes: number;
};

export function StepSlots({
  timezone,
  loading,
  slotsByDate,
  availableDates,
  selectedDate,
  selectedSlot,
  slotGoneWarning,
  onDismissSlotGoneWarning,
  onTimezoneChange,
  onDateChange,
  onSelectSlot,
  onContinue,
  durationMinutes,
}: Props) {
  const detectedTz = useMemo(() => detectBrowserTimezone(), []);
  const [editingTimezone, setEditingTimezone] = useState(false);

  // Anchor the visible calendar month on whichever month the selected
  // (or first-available) date sits in, so the user sees the dot markers
  // immediately. When the available-dates set changes (e.g. timezone
  // switch), the underlying anchor refreshes automatically — the user can
  // still hit prev/next, which records an override that takes precedence.
  const anchorMonth = useMemo(() => {
    const seed = selectedDate || availableDates[0];
    if (seed) {
      const [y, m] = seed.split("-").map(Number);
      return { year: y, month: m - 1 };
    }
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }, [selectedDate, availableDates]);
  const [override, setOverride] = useState<{ year: number; month: number } | null>(
    null,
  );
  const view = override ?? anchorMonth;

  const cells = buildCalendarGrid(view.year, view.month);
  const todayKey = useMemo(() => slotGuestDateKey(new Date().toISOString(), timezone), [timezone]);

  function nextAvailableDate() {
    if (availableDates.length === 0) return;
    const sorted = [...availableDates].sort();
    const next = sorted.find((d) => d >= todayKey) ?? sorted[0];
    onDateChange(next);
    const [y, m] = next.split("-").map(Number);
    setOverride({ year: y, month: m - 1 });
  }

  function shiftMonth(delta: number) {
    const date = new Date(view.year, view.month + delta, 1);
    setOverride({ year: date.getFullYear(), month: date.getMonth() });
  }

  const slots = slotsByDate.get(selectedDate) ?? [];
  const buckets = bucketSlots(slots, timezone);

  const selectedEndIso = useMemo(() => {
    if (!selectedSlot) return null;
    return selectedSlot.endTimeUtc;
  }, [selectedSlot]);

  return (
    <section>
      <h1
        className="text-[36px] font-extrabold md:text-[44px]"
        style={{ letterSpacing: "-0.03em", lineHeight: "1.02" }}
      >
        Select a date &amp; time
      </h1>
      <p className="mt-2 text-[14px] text-[#6B7280]">
        All times shown in your local timezone.
      </p>

      {/* timezone strip */}
      <div className="mt-6 space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-[#EEE7DF] bg-white px-4 py-3">
          <span className="size-2 rounded-full bg-[#10B981]" />
          <p className="text-[13px] font-semibold">
            Timezone: {timezoneCity(timezone)}{" "}
            <span className="tabular-nums text-[#6B7280]">
              ({formatOffset(timezone)})
            </span>
          </p>
          <button
            type="button"
            className="ml-auto inline-flex items-center gap-1 text-[12px] font-bold text-[#FF5F63]"
            onClick={() => setEditingTimezone((value) => !value)}
          >
            {editingTimezone ? "Done" : "Change"}
          </button>
        </div>
        {editingTimezone ? (
          <div className="max-w-[420px]">
            <TimezoneCombobox
              value={timezone}
              onChange={(tz) => {
                onTimezoneChange(tz);
                setEditingTimezone(false);
              }}
              detectedTimezone={detectedTz}
              tone="compact"
            />
          </div>
        ) : null}
      </div>

      {slotGoneWarning ? (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-[#FCC9C5] bg-[#FFF5F4] p-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#DC2626]">
            <AlertTriangle className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-bold text-[#B91C1C]">
              That time is no longer available
            </p>
            <p className="mt-0.5 text-[12.5px] text-[#7c2222]">
              Someone just booked it. Please choose another time below.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismissSlotGoneWarning}
            aria-label="Dismiss"
            className="text-[#9CA3AF] hover:text-[#0B1220]"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-10 flex items-center gap-3 text-sm text-[#6B7280]">
          <span className="inline-block size-4 animate-spin rounded-full border-2 border-[#FF5F63] border-t-transparent" />
          Checking availability…
        </div>
      ) : availableDates.length === 0 ? (
        <div className="mt-10 max-w-[520px] rounded-2xl border border-[#EEE7DF] bg-white p-8 text-center shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
          <p className="text-[16px] font-bold text-[#111827]">
            No availability in the next 3 weeks
          </p>
          <p className="mt-2 text-[13px] text-[#6B7280]">
            The host hasn&apos;t set open slots yet. Try checking back soon.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.25fr]">
          {/* calendar */}
          <div className="rounded-2xl border border-[#EEE7DF] bg-white p-5 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="grid size-9 place-items-center rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]"
              >
                <ChevronLeft className="size-4" />
              </button>
              <p className="text-[15px] font-bold">
                {new Intl.DateTimeFormat("en-US", {
                  month: "long",
                  year: "numeric",
                }).format(new Date(view.year, view.month, 1))}
              </p>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="grid size-9 place-items-center rounded-lg border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-1.5">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => (
                <div
                  key={label}
                  className="py-1.5 text-center text-[11px] font-bold text-[#9CA3AF]"
                >
                  {label}
                </div>
              ))}
              {cells.map((cell, idx) => {
                if (!cell) {
                  return <div key={`gap-${idx}`} className="h-10" />;
                }
                const hasSlots = slotsByDate.has(cell.key);
                const isSelected = selectedDate === cell.key;
                const isToday = cell.key === todayKey;
                const inPast = cell.key < todayKey;
                const isMuted = !cell.inMonth || inPast;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => {
                      if (hasSlots) onDateChange(cell.key);
                    }}
                    disabled={!hasSlots}
                    className={cn(
                      "relative grid h-10 place-items-center rounded-lg text-[13px] font-semibold transition",
                      isSelected
                        ? "bg-[#FF5F63] text-white"
                        : hasSlots
                          ? "text-[#374151] hover:bg-[#FFF6F0]"
                          : "cursor-default text-[#D1D5DB]",
                      isMuted && !isSelected && "text-[#D1D5DB]",
                      isToday && !isSelected && "ring-1 ring-[#FF5F63]",
                    )}
                  >
                    {cell.day}
                    {hasSlots ? (
                      <span
                        className={cn(
                          "absolute bottom-1 size-1 rounded-full",
                          isSelected ? "bg-white" : "bg-[#FF5F63]",
                        )}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[#EEE7DF] pt-3 text-[11.5px] text-[#6B7280]">
              <p className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-[#FF5F63]" />
                Slots available
              </p>
              <button
                type="button"
                onClick={nextAvailableDate}
                className="font-bold text-[#FF5F63] hover:underline"
              >
                Next available →
              </button>
            </div>
          </div>

          {/* slots */}
          <div>
            <div className="flex items-baseline justify-between">
              <p className="text-[18px] font-bold">
                {selectedDate
                  ? formatFullDateKey(selectedDate)
                  : "Pick a date"}
              </p>
              <p className="text-[12px] text-[#6B7280]">
                <span className="font-bold tabular-nums text-[#0B1220]">
                  {slots.length}
                </span>{" "}
                {slots.length === 1 ? "slot" : "slots"} available
              </p>
            </div>

            <BucketBlock
              label="Morning"
              slots={buckets.morning}
              timezone={timezone}
              selected={selectedSlot}
              onPick={onSelectSlot}
            />
            <BucketBlock
              label="Afternoon"
              slots={buckets.afternoon}
              timezone={timezone}
              selected={selectedSlot}
              onPick={onSelectSlot}
            />
            <BucketBlock
              label="Evening"
              slots={buckets.evening}
              timezone={timezone}
              selected={selectedSlot}
              onPick={onSelectSlot}
            />

            {slots.length === 0 && selectedDate ? (
              <div className="mt-4 rounded-2xl border border-dashed border-[#EEE7DF] bg-[#FFFBF7] p-6 text-center text-[13px] text-[#6B7280]">
                No times left for this date — try another day on the calendar.
              </div>
            ) : null}

            {selectedSlot && selectedEndIso ? (
              <div className="mt-6 rounded-2xl border border-[#EEE7DF] bg-white p-5 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
                  Selected appointment
                </p>
                <p className="mt-1.5 text-[19px] font-bold">
                  {formatFullDateKey(selectedDate)} —{" "}
                  {formatGuestTime(selectedSlot.startTimeUtc, timezone)}
                </p>
                <p className="text-[12.5px] text-[#6B7280]">
                  {durationMinutes} minutes · Ends at{" "}
                  {formatGuestTime(selectedEndIso, timezone)}
                </p>
                <button
                  type="button"
                  onClick={onContinue}
                  className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-5 text-[15px] font-bold text-white shadow-[0_12px_24px_-10px_rgba(255,95,99,0.5)] hover:brightness-105"
                >
                  Continue to your details →
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
}

function BucketBlock({
  label,
  slots,
  timezone,
  selected,
  onPick,
}: {
  label: string;
  slots: AvailableSlot[];
  timezone: string;
  selected: AvailableSlot | null;
  onPick: (slot: AvailableSlot) => void;
}) {
  if (slots.length === 0) return null;
  return (
    <>
      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
        {label}
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2.5">
        {slots.map((slot) => {
          const isSelected = selected?.startTimeUtc === slot.startTimeUtc;
          return (
            <button
              key={slot.startTimeUtc}
              type="button"
              onClick={() => onPick(slot)}
              className={cn(
                "grid h-12 place-items-center rounded-xl border text-[14px] font-bold transition",
                isSelected
                  ? "border-transparent bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] text-white shadow-[0_6px_16px_-8px_rgba(255,95,99,0.55)]"
                  : "border-[#EEE7DF] bg-white text-[#0B1220] hover:border-[#FF5F63] hover:text-[#FF5F63]",
              )}
            >
              {formatGuestTime(slot.startTimeUtc, timezone)}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Build a 6-row grid of 42 cells aligning the 1st of `month` under Su–Sa. */
function buildCalendarGrid(
  year: number,
  month: number,
): ({ day: number; key: string; inMonth: boolean } | null)[] {
  const cells: ({ day: number; key: string; inMonth: boolean } | null)[] = [];
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Leading cells from the previous month (muted).
  const prevDays = new Date(year, month, 0).getDate();
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = prevDays - i;
    const date = new Date(year, month - 1, d);
    cells.push({
      day: d,
      key: toKey(date),
      inMonth: false,
    });
  }
  // Current month.
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    cells.push({ day: d, key: toKey(date), inMonth: true });
  }
  // Trailing cells to fill the 42-cell grid.
  let trail = 1;
  while (cells.length < 42) {
    const date = new Date(year, month + 1, trail);
    cells.push({ day: trail, key: toKey(date), inMonth: false });
    trail++;
  }
  return cells;
}

function toKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
