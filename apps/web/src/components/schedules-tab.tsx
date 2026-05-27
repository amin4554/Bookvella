"use client";

import { useMemo, useState } from "react";
import { Check, Layers, Plus, Trash2 } from "lucide-react";
import type {
  AvailabilitySchedule,
  AvailabilityScheduleRule,
} from "@/lib/api";

const SHORT_DAYS_MON_FIRST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtMin(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function rulesPerDay(rules: AvailabilityScheduleRule[]) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((dayOfWeek) => ({
    label: SHORT_DAYS_MON_FIRST[order.indexOf(dayOfWeek)],
    dayOfWeek,
    blocks: rules
      .filter((rule) => rule.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startMinute - b.startMinute),
  }));
}

export function SchedulesTab({
  schedules,
  applyingId,
  saving,
  scopeLabel,
  canSaveFromDraft,
  onApply,
  onCreateFromDraft,
  onRename,
  onDelete,
}: {
  schedules: AvailabilitySchedule[];
  applyingId: string | null;
  saving: boolean;
  scopeLabel: string;
  canSaveFromDraft: boolean;
  onApply: (scheduleId: string) => void;
  onCreateFromDraft: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}) {
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const sorted = useMemo(
    () => [...schedules].sort((a, b) => a.name.localeCompare(b.name)),
    [schedules],
  );

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[12px] text-ink-soft">
          Save reusable weekly templates (Summer hours, Holiday hours…) and apply
          them to {scopeLabel}.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-dashed border-brand-tint-300 bg-brand-tint-50 p-4">
        <p className="text-[12px] font-bold text-danger-brown">
          Save the current weekly hours as a template
        </p>
        <p className="mt-1 text-[11.5px] text-danger-muted">
          The current weekly editor (above the tabs) becomes a new template you
          can apply later.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            maxLength={60}
            placeholder="e.g. Summer hours"
            className="h-9 flex-1 min-w-[180px] rounded-lg border border-line-soft bg-surface-card px-3 text-[13px] outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
          />
          <button
            type="button"
            disabled={!newName.trim() || saving || !canSaveFromDraft}
            onClick={() => {
              if (!newName.trim()) return;
              onCreateFromDraft(newName.trim());
              setNewName("");
            }}
            title={
              canSaveFromDraft
                ? undefined
                : "Save your weekly changes first, then create the template"
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-coral to-brand-orange px-3 text-[12px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
          >
            <Plus className="size-3.5" /> Save template
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {sorted.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-cream bg-surface-page px-4 py-6 text-center text-[12px] text-ink-muted">
            No saved templates yet.
          </p>
        ) : (
          sorted.map((schedule) => {
            const isRenaming = renamingId === schedule.id;
            const days = rulesPerDay(schedule.rules);
            const totalHours = schedule.rules.reduce(
              (sum, rule) => sum + (rule.endMinute - rule.startMinute) / 60,
              0,
            );

            return (
              <div
                key={schedule.id}
                className="rounded-xl border border-line-cream bg-surface-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Layers className="size-3.5 text-brand" />
                      {isRenaming ? (
                        <input
                          autoFocus
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          onBlur={() => {
                            const next = renameDraft.trim();
                            if (next && next !== schedule.name) {
                              onRename(schedule.id, next);
                            }
                            setRenamingId(null);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.currentTarget.blur();
                            } else if (event.key === "Escape") {
                              setRenamingId(null);
                            }
                          }}
                          maxLength={60}
                          className="h-7 flex-1 rounded border border-line-soft bg-surface-card px-2 text-[13px] font-bold outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(schedule.id);
                            setRenameDraft(schedule.name);
                          }}
                          className="truncate text-[13px] font-bold text-ink-strong hover:underline"
                          title="Rename"
                        >
                          {schedule.name}
                        </button>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-ink-muted tabular-nums">
                      {totalHours.toFixed(1).replace(/\.0$/, "")}h per week
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onApply(schedule.id)}
                      disabled={applyingId !== null}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-brand-coral to-brand-orange px-3 text-[12px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
                    >
                      {applyingId === schedule.id ? (
                        "Applying…"
                      ) : (
                        <>
                          <Check className="size-3.5" /> Apply
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          window.confirm(
                            `Delete template "${schedule.name}"? This won't affect availability already set.`,
                          )
                        ) {
                          onDelete(schedule.id);
                        }
                      }}
                      title="Delete template"
                      className="inline-flex size-8 items-center justify-center rounded-lg border border-line-soft text-ink-muted hover:border-danger-border hover:bg-danger-tint hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-7 gap-1.5">
                  {days.map((day) => (
                    <div
                      key={day.dayOfWeek}
                      className={[
                        "rounded-lg border px-1.5 py-1 text-center",
                        day.blocks.length === 0
                          ? "border-line-cream-soft bg-surface-cream text-ink-muted"
                          : "border-line-cream bg-surface-page text-ink-strong",
                      ].join(" ")}
                    >
                      <p className="text-[9.5px] font-bold uppercase tracking-[0.1em]">
                        {day.label}
                      </p>
                      <div className="mt-1 space-y-0.5">
                        {day.blocks.length === 0 ? (
                          <p className="text-[9.5px] italic">Off</p>
                        ) : (
                          day.blocks.map((block) => (
                            <p
                              key={block.id}
                              className="text-[9.5px] font-bold tabular-nums"
                            >
                              {fmtMin(block.startMinute)}–{fmtMin(block.endMinute)}
                            </p>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
