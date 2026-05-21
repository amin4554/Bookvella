"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { authedApiRequest, type AvailabilityRule, type PublicUser } from "@/lib/api";

type DraftRule = {
  id?: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
        setRules(availability.map(({ id, dayOfWeek, startMinute, endMinute }) => ({ id, dayOfWeek, startMinute, endMinute })));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load availability");
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
          authedApiRequest<{ success: boolean }>(`/availability/rules/${rule.id}`, {
            method: "DELETE",
          }),
        ),
        ...rules.map((rule) =>
          rule.id
            ? authedApiRequest<AvailabilityRule>(`/availability/rules/${rule.id}`, {
                method: "PATCH",
                body: JSON.stringify({
                  dayOfWeek: rule.dayOfWeek,
                  startMinute: rule.startMinute,
                  endMinute: rule.endMinute,
                }),
              })
            : authedApiRequest<AvailabilityRule>("/availability/rules", {
                method: "POST",
                body: JSON.stringify(rule),
              }),
        ),
      ]);

      const fresh = await authedApiRequest<AvailabilityRule[]>("/availability/rules");
      setOriginal(fresh);
      setRules(fresh.map(({ id, dayOfWeek, startMinute, endMinute }) => ({ id, dayOfWeek, startMinute, endMinute })));
      toast.success("Availability saved");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not save availability");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell
      active="Availability"
      title="Availability"
      userInitial={user?.name.charAt(0).toUpperCase() ?? "B"}
    >
      <section>
        <h2 className="text-2xl font-semibold">Weekly Availability</h2>
        <p className="mt-2 text-sm text-[#6B7280]">
          Set the hours you are open for bookings each week.
        </p>
      </section>

      {error ? <InlineState title="Availability unavailable" text={error} /> : null}
      {loading ? <InlineState title="Loading availability" text="Fetching your weekly schedule." /> : null}

      {!loading && !error ? (
        <>
          {invalid ? (
            <div className="mt-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600">
              Please fix highlighted time ranges before saving.
            </div>
          ) : null}

          <label className="mt-5 block max-w-[300px]">
            <span className="text-sm font-medium">Timezone</span>
            <input
              value={user?.timezone ?? "UTC"}
              readOnly
              className="mt-1 h-10 w-full rounded-lg border border-[#D1D5DB] bg-[#FFFBF7] px-3 text-sm text-[#6B7280]"
            />
          </label>

          <div className="mt-7 max-w-[960px] overflow-hidden rounded-xl border border-[#EEE7DF] bg-white shadow-[0_14px_30px_rgba(17,24,39,0.08)]">
            <div className="hidden grid-cols-[220px_1fr] bg-[#FFFBF7] px-6 py-3 text-xs font-medium text-[#6B7280] md:grid">
              <span>Day</span>
              <span>Hours</span>
            </div>
            {days.map((day, dayOfWeek) => {
              const dayRules = rules.filter((rule) => rule.dayOfWeek === dayOfWeek);
              return (
                <div
                  key={day}
                  className="grid gap-4 border-t border-[#EEE7DF] px-6 py-3 first:border-t-0 md:grid-cols-[220px_1fr]"
                >
                  <div className="flex items-center gap-3">
                    <Toggle
                      enabled={dayRules.length > 0}
                      onClick={() => {
                        setRules((current) =>
                          dayRules.length
                            ? current.filter((rule) => rule.dayOfWeek !== dayOfWeek)
                            : [...current, { dayOfWeek, startMinute: 540, endMinute: 1020 }],
                        );
                      }}
                    />
                    <span className={dayRules.length ? "" : "text-[#B8C0CC]"}>{day}</span>
                  </div>
                  {dayRules.length ? (
                    <div className="space-y-2">
                      {dayRules.map((rule) => {
                        const isInvalid = rule.startMinute >= rule.endMinute;
                        return (
                          <div key={rule.id ?? `${rule.dayOfWeek}-${rule.startMinute}-${rule.endMinute}`} className="flex flex-wrap items-center gap-3">
                            <TimeInput
                              value={minuteToTime(rule.startMinute)}
                              invalid={isInvalid}
                              onChange={(value) => updateRule(rule, { startMinute: timeToMinute(value) })}
                            />
                            <span className="text-[#6B7280]">-</span>
                            <TimeInput
                              value={minuteToTime(rule.endMinute)}
                              invalid={isInvalid}
                              onChange={(value) => updateRule(rule, { endMinute: timeToMinute(value) })}
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
                        onClick={() => setRules((current) => [...current, { dayOfWeek, startMinute: 780, endMinute: 1020 }])}
                      >
                        <Plus className="size-4" />
                        Add range
                      </button>
                    </div>
                  ) : (
                    <p className="self-center text-sm text-[#B8C0CC]">Unavailable</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex max-w-[960px] justify-end">
            <Button
              className="h-11 rounded-lg bg-[#FF5F63] px-10 font-semibold text-white hover:bg-[#F05258]"
              disabled={saving}
              onClick={save}
            >
              {saving ? "Saving..." : "Save availability"}
            </Button>
          </div>
        </>
      ) : null}
    </AppShell>
  );

  function updateRule(target: DraftRule, patch: Partial<DraftRule>) {
    setRules((current) =>
      current.map((rule) => (sameRule(rule, target) ? { ...rule, ...patch } : rule)),
    );
  }

  function removeRule(target: DraftRule) {
    setRules((current) => current.filter((rule) => !sameRule(rule, target)));
  }
}

function Toggle({ enabled, onClick }: { enabled: boolean; onClick: () => void }) {
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

function sameRule(left: DraftRule, right: DraftRule) {
  if (left.id || right.id) {
    return left.id === right.id;
  }

  return left === right;
}
