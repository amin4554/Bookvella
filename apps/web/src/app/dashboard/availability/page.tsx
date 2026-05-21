"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CircleDot,
  Clock3,
  Plus,
  Sun,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  authedApiRequest,
  type AvailabilityRule,
  type PublicUser,
} from "@/lib/api";

type DraftRule = {
  id?: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function AvailabilityPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [original, setOriginal] = useState<AvailabilityRule[]>([]);
  const [rules, setRules] = useState<DraftRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [me, availability] = await Promise.all([
          authedApiRequest<PublicUser>("/auth/me"),
          authedApiRequest<AvailabilityRule[]>("/availability/rules"),
        ]);
        setUser(me);
        setOriginal(availability);
        setRules(
          availability.map(({ id, dayOfWeek, startMinute, endMinute }) => ({
            id,
            dayOfWeek,
            startMinute,
            endMinute,
          })),
        );
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load availability",
        );
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const invalid = useMemo(
    () => rules.some((rule) => rule.startMinute >= rule.endMinute),
    [rules],
  );

  async function save() {
    if (invalid) {
      toast.error("End time must be after start time");
      return;
    }

    setSaving(true);
    try {
      const currentIds = new Set(rules.map((rule) => rule.id).filter(Boolean));
      const removed = original.filter((rule) => !currentIds.has(rule.id));

      await Promise.all([
        ...removed.map((rule) =>
          authedApiRequest<{ success: boolean }>(
            `/availability/rules/${rule.id}`,
            {
              method: "DELETE",
            },
          ),
        ),
        ...rules.map((rule) =>
          rule.id
            ? authedApiRequest<AvailabilityRule>(
                `/availability/rules/${rule.id}`,
                {
                  method: "PATCH",
                  body: JSON.stringify({
                    dayOfWeek: rule.dayOfWeek,
                    startMinute: rule.startMinute,
                    endMinute: rule.endMinute,
                  }),
                },
              )
            : authedApiRequest<AvailabilityRule>("/availability/rules", {
                method: "POST",
                body: JSON.stringify(rule),
              }),
        ),
      ]);

      const fresh = await authedApiRequest<AvailabilityRule[]>(
        "/availability/rules",
      );
      setOriginal(fresh);
      setRules(
        fresh.map(({ id, dayOfWeek, startMinute, endMinute }) => ({
          id,
          dayOfWeek,
          startMinute,
          endMinute,
        })),
      );
      toast.success("Availability saved");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not save availability",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      active="Schedule"
      title="Booking schedule"
      userInitial={user?.name.charAt(0).toUpperCase() ?? "B"}
    >
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[34px] font-bold leading-tight">
            Booking schedule
          </h2>
          <p className="mt-1 text-base text-[#6B7280]">
            Choose when guests can book your services.
          </p>
        </div>
        <Button
          className="h-12 rounded-2xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-7 font-bold text-white"
          disabled={saving || loading || invalid}
          onClick={save}
        >
          {saving ? "Saving..." : "Save schedule"}
        </Button>
      </section>

      {error ? (
        <InlineState title="Availability unavailable" text={error} />
      ) : null}
      {loading ? (
        <InlineState
          title="Loading availability"
          text="Fetching your weekly schedule."
        />
      ) : null}

      {!loading && !error ? (
        <>
          {invalid ? (
            <div className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
              Please fix highlighted time ranges before saving.
            </div>
          ) : null}

          <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="rounded-[24px] border border-[#EEE7DF] bg-white p-6 shadow-sm md:p-8">
              <h3 className="text-2xl font-bold">
                When are you usually available?
              </h3>
              <p className="mt-2 text-[#6B7280]">
                Start with a preset, then fine-tune. Most hosts are set up in
                under a minute.
              </p>

              <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
                Quick presets
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Preset
                  icon={CalendarDays}
                  title="Any day"
                  text="7 days a week"
                  onClick={() => applyPreset([0, 1, 2, 3, 4, 5, 6])}
                />
                <Preset
                  icon={Clock3}
                  title="Weekdays"
                  text="Mon - Fri"
                  onClick={() => applyPreset([1, 2, 3, 4, 5])}
                />
                <Preset
                  icon={Sun}
                  title="Weekends"
                  text="Sat & Sun"
                  onClick={() => applyPreset([0, 6])}
                />
                <Preset
                  icon={CircleDot}
                  title="Specific days"
                  text="You choose"
                  onClick={() => applyPreset([])}
                />
                <Preset
                  icon={Plus}
                  title="Custom"
                  text="Full control"
                  onClick={() => setRules((current) => current)}
                />
              </div>

              <p className="mt-8 text-xs font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
                Days available
              </p>
              <div className="mt-4 overflow-hidden rounded-2xl border border-[#EEE7DF] bg-white">
                {days.map((day, dayOfWeek) => {
                  const dayRules = rules.filter(
                    (rule) => rule.dayOfWeek === dayOfWeek,
                  );
                  return (
                    <div
                      key={day}
                      className="grid gap-4 border-t border-[#EEE7DF] px-5 py-4 first:border-t-0 md:grid-cols-[160px_1fr]"
                    >
                      <div className="flex items-center gap-3">
                        <Toggle
                          enabled={dayRules.length > 0}
                          onClick={() => {
                            setRules((current) =>
                              dayRules.length
                                ? current.filter(
                                    (rule) => rule.dayOfWeek !== dayOfWeek,
                                  )
                                : [
                                    ...current,
                                    {
                                      dayOfWeek,
                                      startMinute: 540,
                                      endMinute: 1020,
                                    },
                                  ],
                            );
                          }}
                        />
                        <span
                          className={dayRules.length ? "" : "text-[#B8C0CC]"}
                        >
                          {day}
                        </span>
                      </div>
                      {dayRules.length ? (
                        <div className="space-y-2">
                          {dayRules.map((rule) => {
                            const isInvalid =
                              rule.startMinute >= rule.endMinute;
                            return (
                              <div
                                key={
                                  rule.id ??
                                  `${rule.dayOfWeek}-${rule.startMinute}-${rule.endMinute}`
                                }
                                className="flex flex-wrap items-center gap-3"
                              >
                                <TimeInput
                                  value={minuteToTime(rule.startMinute)}
                                  invalid={isInvalid}
                                  onChange={(value) =>
                                    updateRule(rule, {
                                      startMinute: timeToMinute(value),
                                    })
                                  }
                                />
                                <span className="text-[#6B7280]">-</span>
                                <TimeInput
                                  value={minuteToTime(rule.endMinute)}
                                  invalid={isInvalid}
                                  onChange={(value) =>
                                    updateRule(rule, {
                                      endMinute: timeToMinute(value),
                                    })
                                  }
                                />
                                <button
                                  className="flex size-8 items-center justify-center rounded-lg bg-[#FFFBF7] text-[#6B7280]"
                                  onClick={() => removeRule(rule)}
                                  aria-label={`Delete ${day} range`}
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </div>
                            );
                          })}
                          <button
                            className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#FFF0EF] px-3 text-sm font-medium text-[#FF5F63]"
                            onClick={() =>
                              setRules((current) => [
                                ...current,
                                {
                                  dayOfWeek,
                                  startMinute: 780,
                                  endMinute: 1020,
                                },
                              ])
                            }
                          >
                            <Plus className="size-4" />
                            Add range
                          </button>
                        </div>
                      ) : (
                        <p className="self-center text-sm text-[#B8C0CC]">
                          Unavailable
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <aside className="space-y-5 xl:sticky xl:top-8 xl:self-start">
              <div className="rounded-[24px] border border-[#EEE7DF] bg-white p-6 shadow-sm">
                <h3 className="text-xl font-bold">Schedule summary</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <SummaryDot
                    color="bg-[#FF6267]"
                    title={`${rules.length ? activeDayNames(rules).join(", ") : "No days"}`}
                    text={
                      rules.length
                        ? "Bookable days selected"
                        : "Guests cannot book yet"
                    }
                  />
                  <SummaryDot
                    color="bg-[#F59E0B]"
                    title={rangeSummary(rules)}
                    text="Bookable hours"
                  />
                  <SummaryDot
                    color="bg-[#16A34A]"
                    title={user?.timezone ?? "UTC"}
                    text="Timezone"
                  />
                </div>
              </div>
              <div className="rounded-[24px] border border-[#EEE7DF] bg-gradient-to-br from-[#D7FBF7] to-[#EFE1FF] p-6">
                <h3 className="text-lg font-bold">How schedules work</h3>
                <p className="mt-3 leading-7 text-[#6B7280]">
                  Guests only see available slots based on your schedule,
                  existing bookings, and cleanup time.
                </p>
              </div>
              <div className="rounded-[24px] border border-[#EEE7DF] bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold">Timezone</h3>
                <p className="mt-3 font-bold">{user?.timezone ?? "UTC"}</p>
                <p className="mt-1 text-sm text-[#6B7280]">
                  All slots are shown in this timezone to guests.
                </p>
              </div>
            </aside>
          </div>
        </>
      ) : null}
    </AppShell>
  );

  function updateRule(target: DraftRule, patch: Partial<DraftRule>) {
    setRules((current) =>
      current.map((rule) =>
        sameRule(rule, target) ? { ...rule, ...patch } : rule,
      ),
    );
  }

  function removeRule(target: DraftRule) {
    setRules((current) => current.filter((rule) => !sameRule(rule, target)));
  }

  function applyPreset(dayIndexes: number[]) {
    setRules(
      dayIndexes.map((dayOfWeek) => ({
        dayOfWeek,
        startMinute: 540,
        endMinute: 1020,
      })),
    );
  }
}

function Preset({
  icon: Icon,
  title,
  text,
  onClick,
}: {
  icon: React.ElementType;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      className="flex min-h-[112px] flex-col items-center justify-center rounded-2xl border border-[#E8DED7] bg-[#FFFBF7] p-4 text-center hover:border-[#FF6267] hover:bg-[#FFF0EF]"
      onClick={onClick}
    >
      <span className="flex size-10 items-center justify-center rounded-xl bg-white text-[#FF6267]">
        <Icon className="size-4" />
      </span>
      <span className="mt-3 font-bold">{title}</span>
      <span className="mt-1 text-xs text-[#9CA3AF]">{text}</span>
    </button>
  );
}

function SummaryDot({
  color,
  title,
  text,
}: {
  color: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3">
      <span className={`mt-1 size-2.5 rounded-full ${color}`} />
      <div>
        <p className="font-bold">{title}</p>
        <p className="text-[#6B7280]">{text}</p>
      </div>
    </div>
  );
}

function Toggle({
  enabled,
  onClick,
}: {
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex h-6 w-11 items-center rounded-full p-1 ${
        enabled ? "justify-end bg-[#FF5F63]" : "justify-start bg-[#CBD5E1]"
      }`}
      onClick={onClick}
      aria-label={enabled ? "Mark unavailable" : "Mark available"}
    >
      <span className="size-4 rounded-full bg-white" />
    </button>
  );
}

function TimeInput({
  value,
  invalid,
  onChange,
}: {
  value: string;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`h-9 w-[118px] rounded-lg border bg-white px-3 text-sm outline-none ${
        invalid
          ? "border-red-400 text-red-600 focus:ring-red-200"
          : "border-[#D1D5DB] focus:border-[#FF5F63] focus:ring-[#FF5F63]/15"
      } focus:ring-2`}
    />
  );
}

function InlineState({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-6 rounded-xl border border-[#EEE7DF] bg-white p-6 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-[#6B7280]">{text}</p>
    </div>
  );
}

function minuteToTime(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function timeToMinute(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function activeDayNames(rules: DraftRule[]) {
  return Array.from(
    new Set(rules.map((rule) => days[rule.dayOfWeek].slice(0, 3))),
  );
}

function rangeSummary(rules: DraftRule[]) {
  if (rules.length === 0) {
    return "No hours set";
  }

  const first = rules[0];
  return `${minuteToTime(first.startMinute)}-${minuteToTime(first.endMinute)}`;
}

function sameRule(left: DraftRule, right: DraftRule) {
  if (left.id || right.id) {
    return left.id === right.id;
  }

  return left === right;
}
