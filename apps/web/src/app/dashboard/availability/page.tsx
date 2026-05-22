"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { authedApiRequest, type AvailabilityOverride, type AvailabilityRule, type PublicUser } from "@/lib/api";

// Grid config: 6 AM – 10 PM in 30-min slots
const GRID_START_HOUR = 6;
const GRID_END_HOUR = 22;
const SLOT_MINUTES = 30;
const SLOTS_PER_DAY = ((GRID_END_HOUR - GRID_START_HOUR) * 60) / SLOT_MINUTES; // 32

const DISPLAY_DAYS = [
  { label: "Mon", dayIndex: 1 },
  { label: "Tue", dayIndex: 2 },
  { label: "Wed", dayIndex: 3 },
  { label: "Thu", dayIndex: 4 },
  { label: "Fri", dayIndex: 5 },
  { label: "Sat", dayIndex: 6 },
  { label: "Sun", dayIndex: 0 },
];

// ── helpers ────────────────────────────────────────────────────────────────

function slotToMinutes(slotIndex: number) {
  return GRID_START_HOUR * 60 + slotIndex * SLOT_MINUTES;
}

function rulesToGrid(rules: AvailabilityRule[]): boolean[][] {
  const grid: boolean[][] = Array.from({ length: 7 }, () =>
    Array(SLOTS_PER_DAY).fill(false),
  );
  for (const rule of rules) {
    for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
      const slotStart = slotToMinutes(slot);
      const slotEnd = slotStart + SLOT_MINUTES;
      if (slotStart >= rule.startMinute && slotEnd <= rule.endMinute) {
        grid[rule.dayOfWeek][slot] = true;
      }
    }
  }
  return grid;
}

function gridToRules(grid: boolean[][]): Omit<AvailabilityRule, "id" | "userId">[] {
  const rules: Omit<AvailabilityRule, "id" | "userId">[] = [];
  for (let day = 0; day < 7; day++) {
    let rangeStart: number | null = null;
    for (let slot = 0; slot <= SLOTS_PER_DAY; slot++) {
      const active = slot < SLOTS_PER_DAY && grid[day][slot];
      if (active && rangeStart === null) {
        rangeStart = slot;
      } else if (!active && rangeStart !== null) {
        rules.push({
          dayOfWeek: day,
          startMinute: slotToMinutes(rangeStart),
          endMinute: slotToMinutes(slot),
        });
        rangeStart = null;
      }
    }
  }
  return rules;
}

function formatHourLabel(slotIndex: number) {
  const totalMin = GRID_START_HOUR * 60 + slotIndex * SLOT_MINUTES;
  const hour = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (min !== 0) return "";
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  const suffix = hour < 12 ? "am" : "pm";
  return `${h}${suffix}`;
}

function hoursForDay(grid: boolean[][], dayIndex: number) {
  const active = grid[dayIndex].filter(Boolean).length;
  return ((active * SLOT_MINUTES) / 60).toFixed(1).replace(/\.0$/, "");
}

// ── component ──────────────────────────────────────────────────────────────

type DragState = {
  dayIndex: number;
  startSlot: number;
  endSlot: number;
  mode: "add" | "remove";
};

export default function AvailabilityPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [original, setOriginal] = useState<AvailabilityRule[]>([]);
  const [grid, setGrid] = useState<boolean[][]>(() =>
    Array.from({ length: 7 }, () => Array(SLOTS_PER_DAY).fill(false)),
  );
  const [drag, setDrag] = useState<DragState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDraggingRef = useRef(false);

  // Blackout dates
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [newBlockDate, setNewBlockDate] = useState("");
  const [addingBlock, setAddingBlock] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [me, rules, overrideList] = await Promise.all([
          authedApiRequest<PublicUser>("/auth/me"),
          authedApiRequest<AvailabilityRule[]>("/availability/rules"),
          authedApiRequest<AvailabilityOverride[]>("/availability/overrides"),
        ]);
        setUser(me);
        setOriginal(rules);
        setGrid(rulesToGrid(rules));
        setOverrides(overrideList);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not load availability",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function addBlockedDate() {
    if (!newBlockDate) return;
    setAddingBlock(true);
    try {
      const created = await authedApiRequest<AvailabilityOverride>(
        "/availability/overrides",
        { method: "POST", body: JSON.stringify({ date: newBlockDate }) },
      );
      setOverrides((prev) =>
        [...prev.filter((o) => o.id !== created?.id), ...(created ? [created] : [])].sort(
          (a, b) => a.date.localeCompare(b.date),
        ),
      );
      setNewBlockDate("");
      toast.success("Date blocked");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not block date");
    } finally {
      setAddingBlock(false);
    }
  }

  async function removeBlockedDate(id: string) {
    try {
      await authedApiRequest(`/availability/overrides/${id}`, { method: "DELETE" });
      setOverrides((prev) => prev.filter((o) => o.id !== id));
      toast.success("Date unblocked");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not unblock date");
    }
  }

  // Commit drag on global mouseup
  useEffect(() => {
    function onMouseUp() {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        setDrag((current) => {
          if (!current) return null;
          const start = Math.min(current.startSlot, current.endSlot);
          const end = Math.max(current.startSlot, current.endSlot);
          setGrid((g) => {
            const next = g.map((row) => [...row]);
            for (let slot = start; slot <= end; slot++) {
              next[current.dayIndex][slot] = current.mode === "add";
            }
            return next;
          });
          return null;
        });
      }
    }
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchend", onMouseUp);
    return () => {
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchend", onMouseUp);
    };
  }, []);

  const cellActive = useCallback(
    (dayIndex: number, slotIndex: number): boolean => {
      if (drag && drag.dayIndex === dayIndex) {
        const start = Math.min(drag.startSlot, drag.endSlot);
        const end = Math.max(drag.startSlot, drag.endSlot);
        if (slotIndex >= start && slotIndex <= end) {
          return drag.mode === "add";
        }
      }
      return grid[dayIndex][slotIndex];
    },
    [grid, drag],
  );

  function handleCellMouseDown(dayIndex: number, slotIndex: number) {
    isDraggingRef.current = true;
    const mode = grid[dayIndex][slotIndex] ? "remove" : "add";
    setDrag({ dayIndex, startSlot: slotIndex, endSlot: slotIndex, mode });
  }

  function handleCellMouseEnter(dayIndex: number, slotIndex: number) {
    if (!isDraggingRef.current) return;
    setDrag((current) => {
      if (!current || current.dayIndex !== dayIndex) return current;
      return { ...current, endSlot: slotIndex };
    });
  }

  async function save() {
    setSaving(true);
    try {
      // Delete all existing rules, then create new ones from grid
      await Promise.all(
        original.map((rule) =>
          authedApiRequest(`/availability/rules/${rule.id}`, { method: "DELETE" }),
        ),
      );

      const newRules = gridToRules(grid);
      const created = await Promise.all(
        newRules.map((rule) =>
          authedApiRequest<AvailabilityRule>("/availability/rules", {
            method: "POST",
            body: JSON.stringify(rule),
          }),
        ),
      );

      setOriginal(created);
      toast.success("Availability saved");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not save availability",
      );
    } finally {
      setSaving(false);
    }
  }

  const activeRules = gridToRules(grid);
  const activeDaySet = new Set(activeRules.map((r) => r.dayOfWeek));
  const totalHours = (
    (grid.flat().filter(Boolean).length * SLOT_MINUTES) /
    60
  ).toFixed(1).replace(/\.0$/, "");

  return (
    <AppShell
      active="Schedule"
      title="Booking schedule"
      userInitial={user?.name.charAt(0).toUpperCase() ?? "B"}
    >
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[34px] font-bold leading-tight">Booking schedule</h2>
          <p className="mt-1 text-base text-[#6B7280]">
            Click and drag to set when guests can book you.
          </p>
        </div>
        <Button
          className="h-12 rounded-2xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-7 font-bold text-white"
          disabled={saving || loading}
          onClick={save}
        >
          {saving ? "Saving..." : "Save schedule"}
        </Button>
      </section>

      {error ? (
        <div className="mt-6 rounded-xl border border-[#EEE7DF] bg-white p-6 shadow-sm">
          <p className="font-semibold">Availability unavailable</p>
          <p className="mt-1 text-sm text-[#6B7280]">{error}</p>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
          {/* ── Calendar grid ──────────────────────────────── */}
          <div
            className="overflow-hidden rounded-[24px] border border-[#EEE7DF] bg-white shadow-sm select-none"
            onMouseLeave={() => {
              /* allow drag to continue even when briefly leaving a cell */
            }}
          >
            {/* Day header */}
            <div className="flex border-b border-[#EEE7DF] bg-[#FFFBF7]">
              <div className="w-12 shrink-0" />
              {DISPLAY_DAYS.map(({ label, dayIndex }) => {
                const activeDay = activeDaySet.has(dayIndex);
                const hrs = hoursForDay(grid, dayIndex);
                return (
                  <div
                    key={dayIndex}
                    className="flex min-w-0 flex-1 flex-col items-center py-3"
                  >
                    <span
                      className={`text-xs font-bold uppercase tracking-wide ${
                        activeDay ? "text-[#FF6267]" : "text-[#9CA3AF]"
                      }`}
                    >
                      {label}
                    </span>
                    <span className="mt-0.5 text-[10px] text-[#B8C0CC]">
                      {activeDay ? `${hrs}h` : "off"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Scrollable time grid */}
            <div className="overflow-y-auto" style={{ maxHeight: 520 }}>
              {Array.from({ length: SLOTS_PER_DAY }, (_, slotIndex) => {
                const isHourBoundary = slotIndex % 2 === 0;
                const label = formatHourLabel(slotIndex);
                return (
                  <div
                    key={slotIndex}
                    className={`flex ${
                      isHourBoundary
                        ? "border-t border-[#E8E3DD]"
                        : "border-t border-[#F3EFE9]"
                    }`}
                  >
                    {/* Hour label */}
                    <div className="flex w-12 shrink-0 items-start justify-end pr-2">
                      {label ? (
                        <span className="-translate-y-2 text-[10px] text-[#B8C0CC]">
                          {label}
                        </span>
                      ) : null}
                    </div>

                    {/* Day cells */}
                    {DISPLAY_DAYS.map(({ dayIndex }, colIndex) => {
                      const active = cellActive(dayIndex, slotIndex);
                      const prevActive =
                        slotIndex > 0 && cellActive(dayIndex, slotIndex - 1);
                      const nextActive =
                        slotIndex < SLOTS_PER_DAY - 1 &&
                        cellActive(dayIndex, slotIndex + 1);
                      const isFirst = active && !prevActive;
                      const isLast = active && !nextActive;

                      return (
                        <div
                          key={dayIndex}
                          className={[
                            "relative flex-1 cursor-pointer transition-colors",
                            colIndex > 0 ? "border-l border-[#F3EFE9]" : "",
                            active
                              ? "bg-[#FF6267]"
                              : "hover:bg-[#FFF0EF]",
                            isFirst ? "rounded-t-md mt-px mx-px" : "",
                            isLast ? "rounded-b-md mb-px" : "",
                            active && !isFirst && !isLast ? "mx-px" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          style={{ height: 20 }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleCellMouseDown(dayIndex, slotIndex);
                          }}
                          onMouseEnter={() =>
                            handleCellMouseEnter(dayIndex, slotIndex)
                          }
                        />
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-[#EEE7DF] px-4 py-3 text-xs text-[#9CA3AF]">
              Click and drag on any day to add availability. Click an existing block to remove it.
            </div>
          </div>

          {/* ── Summary sidebar ───────────────────────────── */}
          <aside className="space-y-4 xl:sticky xl:top-8 xl:self-start">
            <div className="rounded-[24px] border border-[#EEE7DF] bg-white p-6 shadow-sm">
              <h3 className="text-lg font-bold">Summary</h3>
              <div className="mt-4 space-y-3">
                <SummaryRow
                  label="Available days"
                  value={
                    activeDaySet.size
                      ? DISPLAY_DAYS.filter((d) =>
                          activeDaySet.has(d.dayIndex),
                        )
                          .map((d) => d.label)
                          .join(", ")
                      : "None"
                  }
                  accent={activeDaySet.size > 0}
                />
                <SummaryRow
                  label="Weekly hours"
                  value={activeDaySet.size ? `${totalHours}h` : "0h"}
                  accent={activeDaySet.size > 0}
                />
                <SummaryRow
                  label="Timezone"
                  value={user?.timezone ?? "UTC"}
                  accent={false}
                />
              </div>
            </div>

            <div className="rounded-[24px] border border-[#EEE7DF] bg-gradient-to-br from-[#D7FBF7] to-[#EFE1FF] p-6">
              <h3 className="font-bold">Quick presets</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                <PresetButton
                  label="Weekdays 9–5"
                  onClick={() => applyPreset([1, 2, 3, 4, 5], 540, 1020)}
                />
                <PresetButton
                  label="Mon–Sat"
                  onClick={() => applyPreset([1, 2, 3, 4, 5, 6], 540, 1020)}
                />
                <PresetButton
                  label="Every day"
                  onClick={() =>
                    applyPreset([0, 1, 2, 3, 4, 5, 6], 540, 1020)
                  }
                />
                <PresetButton
                  label="Evenings"
                  onClick={() =>
                    applyPreset([1, 2, 3, 4, 5], 1020, 1320)
                  }
                />
                <PresetButton
                  label="Clear all"
                  onClick={() =>
                    setGrid(
                      Array.from({ length: 7 }, () =>
                        Array(SLOTS_PER_DAY).fill(false),
                      ),
                    )
                  }
                  danger
                />
              </div>
            </div>

            <div className="rounded-[24px] border border-[#EEE7DF] bg-white p-6 shadow-sm">
              <h3 className="font-bold">How it works</h3>
              <p className="mt-2 text-sm leading-6 text-[#6B7280]">
                Guests see only open slots that don&apos;t conflict with existing bookings.
                Buffer times between sessions are applied automatically.
              </p>
            </div>
          </aside>
          {/* ── Blackout dates ────────────────────────────── */}
          <div className="mt-2 rounded-[24px] border border-[#EEE7DF] bg-white p-6 shadow-sm xl:col-span-2">
            <h3 className="text-lg font-bold">Blocked dates</h3>
            <p className="mt-1 text-sm text-[#6B7280]">
              Block specific dates — holidays, vacations, or one-off closures. Guests
              won&apos;t see any slots on these days regardless of your weekly schedule.
            </p>

            <div className="mt-4 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="text-sm font-bold">Date to block</span>
                <input
                  type="date"
                  value={newBlockDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setNewBlockDate(e.target.value)}
                  className="mt-1 block h-11 rounded-xl border border-[#E8DED7] bg-[#FFFBF7] px-4 text-sm outline-none focus:border-[#FF6267] focus:ring-4 focus:ring-[#FF6267]/10"
                />
              </label>
              <Button
                type="button"
                className="h-11 rounded-xl bg-[#FF6267] px-5 font-bold text-white hover:bg-[#F05258] disabled:opacity-50"
                disabled={!newBlockDate || addingBlock}
                onClick={addBlockedDate}
              >
                {addingBlock ? "Blocking…" : "Block date"}
              </Button>
            </div>

            {overrides.length === 0 ? (
              <p className="mt-5 text-sm text-[#9CA3AF]">No dates blocked yet.</p>
            ) : (
              <div className="mt-5 flex flex-wrap gap-2">
                {overrides.map((override) => {
                  const label = new Intl.DateTimeFormat("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: "UTC",
                  }).format(new Date(override.date));
                  return (
                    <div
                      key={override.id}
                      className="flex items-center gap-2 rounded-full border border-[#EEE7DF] bg-[#FFFBF7] px-3 py-1.5 text-sm font-bold"
                    >
                      <span>{label}</span>
                      <button
                        type="button"
                        onClick={() => removeBlockedDate(override.id)}
                        className="text-[#9CA3AF] hover:text-red-500"
                        aria-label={`Unblock ${label}`}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </AppShell>
  );

  function applyPreset(days: number[], startMinute: number, endMinute: number) {
    const next = Array.from({ length: 7 }, () =>
      Array(SLOTS_PER_DAY).fill(false),
    );
    for (const day of days) {
      for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
        const start = slotToMinutes(slot);
        const end = start + SLOT_MINUTES;
        if (start >= startMinute && end <= endMinute) {
          next[day][slot] = true;
        }
      }
    }
    setGrid(next);
  }
}

function SummaryRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-sm">
      <span className="text-[#6B7280]">{label}</span>
      <span
        className={`font-bold text-right ${accent ? "text-[#FF6267]" : "text-[#111827]"}`}
      >
        {value}
      </span>
    </div>
  );
}

function PresetButton({
  label,
  onClick,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-8 rounded-xl px-3 text-xs font-bold transition-colors ${
        danger
          ? "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
          : "border border-[#E8DED7] bg-white text-[#6B7280] hover:border-[#FF6267] hover:text-[#FF6267]"
      }`}
    >
      {label}
    </button>
  );
}
