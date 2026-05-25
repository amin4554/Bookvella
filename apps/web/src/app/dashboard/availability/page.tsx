"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  Globe,
  Lock,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import {
  authedApiRequest,
  type AvailabilityOverride,
  type AvailabilityOverrideBlock,
  type AvailabilityOverrideType,
  type AvailabilityRule,
  type AvailabilitySettings,
  type ConnectedCalendar,
  type EventTypeAvailability,
  type EventTypeAvailabilityMode,
  type EventType,
  type HostBooking,
  type PublicUser,
} from "@/lib/api";
import { formatOffset } from "@/lib/timezones";

// ── data shapes used inside the page (kept local; API shapes live in api.ts) ──

type DayStatus = "available" | "dayoff" | "blocked";

type WeeklyDay = {
  dayIndex: number;
  label: string;
  enabled: boolean;
  blocks: Block[];
};

type Block = { start: number; end: number };

type WeeklyRuleLike = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

type DayDraft = {
  // Identity of the date this draft refers to (YYYY-MM-DD in host-local tz).
  dateKey: string;
  status: DayStatus;
  blocks: Block[];
  note: string;
  // Original override row this draft came from (null when the date had no
  // override — i.e. the draft just inherits the weekly default).
  originalOverrideId: string | null;
  dirty: boolean;
};

const SUNDAY_FIRST_INDEXES = [1, 2, 3, 4, 5, 6, 0];

const WEEK_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const SHORT_DAYS_MON_FIRST = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SLOT_INTERVAL_OPTIONS = [5, 10, 15, 20, 30, 60] as const;

const HORIZON_OPTIONS = [
  { days: 14, label: "2 weeks" },
  { days: 28, label: "4 weeks" },
  { days: 56, label: "8 weeks" },
  { days: 84, label: "12 weeks" },
];

const NOTICE_OPTIONS = [
  { minutes: 0, label: "No minimum" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 240, label: "4 hours" },
  { minutes: 1440, label: "1 day" },
];

const LIMIT_OPTIONS = [
  { value: null, label: "No limit" },
  { value: 2, label: "2 per day" },
  { value: 4, label: "4 per day" },
  { value: 6, label: "6 per day" },
  { value: 8, label: "8 per day" },
  { value: 10, label: "10 per day" },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtMin(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function parseMin(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (h < 0 || h > 24 || mm < 0 || mm > 59) return null;
  if (h === 24 && mm !== 0) return null;
  return h * 60 + mm;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// Stable YYYY-MM-DD key for a local Date.
function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

// ISO date strings from the API arrive as "YYYY-MM-DDT00:00:00.000Z". We treat
// the date portion as the host's intended calendar date regardless of viewer
// timezone — same convention as the existing API.
function overrideKey(override: AvailabilityOverride) {
  return override.date.slice(0, 10);
}

function parseISODateOnly(isoOrYmd: string): Date {
  const ymd = isoOrYmd.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return new Date(isoOrYmd);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function rulesForDay(rules: WeeklyRuleLike[], dayIndex: number): Block[] {
  return rules
    .filter((r) => r.dayOfWeek === dayIndex)
    .map((r) => ({ start: r.startMinute, end: r.endMinute }))
    .sort((a, b) => a.start - b.start);
}

function totalHours(blocks: Block[]): number {
  return blocks.reduce((sum, b) => sum + (b.end - b.start) / 60, 0);
}

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function blocksFromOverride(override: AvailabilityOverride): Block[] {
  if (!Array.isArray(override.blocks)) return [];
  return override.blocks
    .map((b) => ({ start: b.startMinute, end: b.endMinute }))
    .sort((a, b) => a.start - b.start);
}

function blockToWire(block: Block): AvailabilityOverrideBlock {
  return { startMinute: block.start, endMinute: block.end };
}

function formatDateShort(date: Date) {
  return `${WEEK_LABELS[date.getDay()].slice(0, 3)} ${date.getDate()} ${MONTH_NAMES[date.getMonth()].slice(0, 3)}`;
}

function formatRangeLabel(start: Date, end: Date) {
  const sameMonth =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth();
  const startStr = `${start.getDate()} ${MONTH_NAMES[start.getMonth()].slice(0, 3)}`;
  if (isSameDate(start, end)) {
    return `${WEEK_LABELS[start.getDay()].slice(0, 3)} ${startStr} ${start.getFullYear()}`;
  }
  if (sameMonth) {
    return `${start.getDate()}–${end.getDate()} ${MONTH_NAMES[start.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
  }
  return `${startStr} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
}

function formatRelativeCalendarTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Build a list of exception "groups" for the Exceptions tab. Multi-day ranges
// stored as repeated rows with the same groupId collapse into a single entry.
type ExceptionGroup = {
  representativeId: string;
  groupKey: string;
  start: Date;
  end: Date;
  type: AvailabilityOverrideType;
  note: string | null;
  blocks: Block[];
};

function groupOverrides(overrides: AvailabilityOverride[]): ExceptionGroup[] {
  const sorted = [...overrides].sort((a, b) =>
    overrideKey(a).localeCompare(overrideKey(b)),
  );
  const groups: ExceptionGroup[] = [];
  const seenGroupIds = new Set<string>();

  for (const override of sorted) {
    if (override.groupId && seenGroupIds.has(override.groupId)) continue;
    if (override.groupId) seenGroupIds.add(override.groupId);

    const members = override.groupId
      ? sorted.filter((o) => o.groupId === override.groupId)
      : [override];
    const start = parseISODateOnly(overrideKey(members[0]));
    const end = parseISODateOnly(overrideKey(members[members.length - 1]));

    groups.push({
      representativeId: members[0].id,
      groupKey: override.groupId ?? override.id,
      start,
      end,
      type: members[0].type,
      note: members[0].note,
      blocks: blocksFromOverride(members[0]),
    });
  }

  return groups;
}

// Month grid: 6 weeks starting on Monday so the layout is stable.
function buildMonthGrid(viewYear: number, viewMonth: number) {
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  // JS getDay: 0=Sun..6=Sat. We want Mon-first, so map Mon->0, Sun->6.
  const leadingDays = (firstOfMonth.getDay() + 6) % 7;
  const startDate = new Date(viewYear, viewMonth, 1 - leadingDays);
  const cells: { date: Date; outside: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    cells.push({ date: d, outside: d.getMonth() !== viewMonth });
  }
  // Trim trailing all-outside rows so the calendar feels right (5 or 6 weeks).
  // Keep 5 weeks if the last row is all-outside.
  if (cells.slice(35).every((c) => c.outside)) {
    return cells.slice(0, 35);
  }
  return cells;
}

// ── component ─────────────────────────────────────────────────────────────────

type DayEdits = {
  status?: DayStatus;
  blocks?: Block[];
  note?: string;
};

export default function AvailabilityPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [serviceAvailabilityById, setServiceAvailabilityById] = useState<
    Record<string, EventTypeAvailability>
  >({});
  const [calendars, setCalendars] = useState<ConnectedCalendar[]>([]);
  // null = "All services". Otherwise the EventType.id we want to filter by.
  const [activeServiceId, setActiveServiceId] = useState<string | null>(null);
  const [serviceModeDraft, setServiceModeDraft] =
    useState<EventTypeAvailabilityMode>("HOST_DEFAULT");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const today = useMemo(() => startOfDay(new Date()), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // Range selection: while `rangeMode` is on, calendar clicks set the start
  // and end of a date range instead of picking a single day. Once both
  // endpoints exist, the right-side editor switches to the range editor.
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [rangeDraft, setRangeDraft] = useState<ExceptionDraft | null>(null);
  const [savingRange, setSavingRange] = useState(false);

  // Tabs.
  const [tab, setTab] = useState<"weekly" | "exceptions" | "rules">("weekly");

  // Weekly editor draft (separate from saved `rules` so the user can fiddle).
  const [weekDraft, setWeekDraft] = useState<WeeklyDay[]>([]);
  const [weekDirty, setWeekDirty] = useState(false);

  // Day-editor overlay: in-progress edits on top of the derived base draft.
  // `null` means "no edits pending for this date — show the base".
  const [dayEdits, setDayEdits] = useState<DayEdits | null>(null);

  // Settings editor draft.
  const [settingsDraft, setSettingsDraft] = useState<AvailabilitySettings | null>(null);
  const [settingsDirty, setSettingsDirty] = useState(false);

  // ── data loading ────────────────────────────────────────────────────────

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const [
          me,
          ruleList,
          overrideList,
          settingsData,
          hostBookings,
          services,
          connectedCalendars,
        ] =
          await Promise.all([
            authedApiRequest<PublicUser>("/auth/me"),
            authedApiRequest<AvailabilityRule[]>("/availability/rules"),
            authedApiRequest<AvailabilityOverride[]>("/availability/overrides"),
            authedApiRequest<AvailabilitySettings>("/availability/settings"),
            authedApiRequest<HostBooking[]>("/bookings"),
            authedApiRequest<EventType[]>("/event-types"),
            authedApiRequest<ConnectedCalendar[]>("/auth/calendars"),
          ]);
        const serviceAvailabilityEntries = await Promise.all(
          services
            .filter((service) => service.isActive)
            .map((service) =>
              authedApiRequest<EventTypeAvailability>(
                `/availability/event-types/${service.id}`,
              ),
            ),
        );

        if (!alive) return;
        setUser(me);
        setRules(ruleList);
        setOverrides(overrideList);
        setSettingsDraft(settingsData);
        setBookings(hostBookings);
        setEventTypes(services);
        setServiceAvailabilityById(
          Object.fromEntries(
            serviceAvailabilityEntries.map((entry) => [
              entry.eventTypeId,
              entry,
            ]),
          ),
        );
        setCalendars(connectedCalendars);
        setWeekDraft(buildWeekDraft(ruleList));
      } catch (caught) {
        if (!alive) return;
        setError(
          caught instanceof Error ? caught.message : "Could not load availability",
        );
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  const activeService = useMemo(
    () =>
      activeServiceId
        ? eventTypes.find((service) => service.id === activeServiceId) ?? null
        : null,
    [activeServiceId, eventTypes],
  );

  const savedActiveServiceAvailability = activeServiceId
    ? serviceAvailabilityById[activeServiceId] ?? null
    : null;

  const savedActiveRules = useMemo<WeeklyRuleLike[]>(() => {
    if (
      activeServiceId &&
      savedActiveServiceAvailability?.mode === "CUSTOM"
    ) {
      return savedActiveServiceAvailability.rules;
    }

    return rules;
  }, [activeServiceId, savedActiveServiceAvailability, rules]);

  const previewRules = useMemo<WeeklyRuleLike[]>(() => {
    if (weekDirty) {
      return rulesFromWeekDraft(weekDraft);
    }

    return savedActiveRules;
  }, [savedActiveRules, weekDirty, weekDraft]);

  // Base draft is derived from the selected date plus saved rules/overrides.
  // User edits sit in `dayEdits` and overlay this base.
  const baseDayDraft = useMemo<DayDraft>(
    () => buildBaseDayDraft(selectedDate, previewRules, overrides),
    [selectedDate, previewRules, overrides],
  );
  const dayDraft: DayDraft = useMemo(() => {
    if (!dayEdits) return baseDayDraft;
    return {
      ...baseDayDraft,
      ...dayEdits,
      blocks: dayEdits.blocks ?? baseDayDraft.blocks,
      dirty: true,
    };
  }, [baseDayDraft, dayEdits]);

  // ── derived data ────────────────────────────────────────────────────────

  const overridesByKey = useMemo(() => {
    const m = new Map<string, AvailabilityOverride>();
    for (const o of overrides) m.set(overrideKey(o), o);
    return m;
  }, [overrides]);

  const filteredBookings = useMemo(() => {
    if (!activeServiceId) return bookings;
    return bookings.filter((b) => b.eventTypeId === activeServiceId);
  }, [bookings, activeServiceId]);

  const bookingsByDateKey = useMemo(() => {
    const m = new Map<string, HostBooking[]>();
    for (const b of filteredBookings) {
      if (b.status !== "CONFIRMED") continue;
      const k = dateKey(new Date(b.startTimeUtc));
      const list = m.get(k) ?? [];
      list.push(b);
      m.set(k, list);
    }
    for (const list of m.values()) {
      list.sort(
        (a, b) =>
          new Date(a.startTimeUtc).getTime() - new Date(b.startTimeUtc).getTime(),
      );
    }
    return m;
  }, [filteredBookings]);

  const monthGrid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const exceptionGroups = useMemo(() => groupOverrides(overrides), [overrides]);

  const dirty = weekDirty || settingsDirty || dayDraft.dirty;

  // ── handlers: navigation ────────────────────────────────────────────────

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  function confirmDiscardDayEdits() {
    if (!dayEdits) return true;
    return window.confirm(
      "You have unsaved changes on the current day. Discard them?",
    );
  }

  function pickAvailabilityScope(nextId: string | null) {
    if (nextId === activeServiceId) return;
    if (weekDirty || dayDraft.dirty) {
      const shouldDiscard = window.confirm(
        "You have unsaved availability changes. Discard them?",
      );
      if (!shouldDiscard) return;
    }

    const nextAvailability = nextId ? serviceAvailabilityById[nextId] ?? null : null;
    const nextMode = nextAvailability?.mode ?? "HOST_DEFAULT";
    const nextRules =
      nextId && nextMode === "CUSTOM" && nextAvailability
        ? nextAvailability.rules
        : rules;

    setActiveServiceId(nextId);
    setServiceModeDraft(nextMode);
    setWeekDraft(buildWeekDraft(nextRules));
    setWeekDirty(false);
    setDayEdits(null);
  }

  function pickToday() {
    if (isSameDate(today, selectedDate)) return;
    if (!confirmDiscardDayEdits()) return;
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(today);
    setDayEdits(null);
  }

  function pickDate(date: Date) {
    if (date < today && !isSameDate(date, today)) return;

    if (rangeMode) {
      handleRangeClick(date);
      return;
    }

    if (isSameDate(date, selectedDate)) return;
    if (!confirmDiscardDayEdits()) return;
    if (date.getMonth() !== viewMonth || date.getFullYear() !== viewYear) {
      setViewYear(date.getFullYear());
      setViewMonth(date.getMonth());
    }
    setSelectedDate(date);
    setDayEdits(null);
  }

  function handleRangeClick(date: Date) {
    // First endpoint, no endpoints yet, or a completed range exists → start over.
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(date);
      setRangeEnd(null);
      setRangeDraft(null);
      return;
    }

    // Second endpoint: normalize and open the range editor.
    const [start, end] =
      rangeStart <= date ? [rangeStart, date] : [date, rangeStart];
    setRangeStart(start);
    setRangeEnd(end);
    setRangeDraft({
      startDate: dateKey(start),
      endDate: dateKey(end),
      type: "BLOCKED",
      note: "",
      blocks: [{ start: 9 * 60, end: 17 * 60 }],
    });
    // Auto-exit range mode after the second click so accidental clicks don't
    // reset the selection.
    setRangeMode(false);
  }

  function toggleRangeMode() {
    if (rangeMode) {
      // Cancel range selection
      setRangeMode(false);
      setRangeStart(null);
      setRangeEnd(null);
      setRangeDraft(null);
      return;
    }
    if (!confirmDiscardDayEdits()) return;
    setRangeMode(true);
    setRangeStart(null);
    setRangeEnd(null);
    setRangeDraft(null);
  }

  function clearRangeSelection() {
    setRangeMode(false);
    setRangeStart(null);
    setRangeEnd(null);
    setRangeDraft(null);
  }

  async function saveRangeDraft() {
    if (!rangeDraft) return;
    setSavingRange(true);
    const ok = await saveExceptionDraft(rangeDraft);
    setSavingRange(false);
    if (ok) clearRangeSelection();
  }

  // ── handlers: day editor ────────────────────────────────────────────────
  //
  // Each handler merges into the `dayEdits` overlay, which is layered on top
  // of the derived base draft. The overlay is cleared whenever the user picks
  // a different date or successfully saves.

  function patchDayEdits(patch: DayEdits) {
    setDayEdits((current) => ({ ...(current ?? {}), ...patch }));
  }

  function setDayStatus(status: DayStatus) {
    if (status === "available" && dayDraft.blocks.length === 0) {
      const weeklyBlocks = rulesForDay(previewRules, selectedDate.getDay());
      patchDayEdits({
        status,
        blocks: weeklyBlocks.length ? weeklyBlocks : [{ start: 9 * 60, end: 17 * 60 }],
      });
      return;
    }
    patchDayEdits({ status });
  }

  function setDayBlock(index: number, next: Block) {
    const blocks = dayDraft.blocks.map((b, i) => (i === index ? next : b));
    patchDayEdits({ blocks });
  }

  function removeDayBlock(index: number) {
    const blocks = dayDraft.blocks.filter((_, i) => i !== index);
    patchDayEdits({ blocks });
  }

  function addDayBlock() {
    const lastEnd = dayDraft.blocks.length
      ? dayDraft.blocks[dayDraft.blocks.length - 1].end
      : 9 * 60;
    const nextStart = Math.min(lastEnd + 30, 22 * 60);
    patchDayEdits({
      blocks: [
        ...dayDraft.blocks,
        { start: nextStart, end: Math.min(nextStart + 120, 24 * 60) },
      ],
    });
  }

  function resetDayToWeekly() {
    const weeklyBlocks = rulesForDay(previewRules, selectedDate.getDay());
    patchDayEdits({
      status: weeklyBlocks.length > 0 ? "available" : "dayoff",
      blocks: weeklyBlocks,
      note: "",
    });
  }

  function setDayNote(value: string) {
    patchDayEdits({ note: value });
  }

  async function saveDayDraft(draft: DayDraft) {
    const key = draft.dateKey;
    if (draft.status === "blocked" || draft.status === "dayoff") {
      // Delete any CUSTOM_HOURS override and create/update a BLOCKED one.
      if (draft.originalOverrideId) {
        await authedApiRequest(`/availability/overrides/${draft.originalOverrideId}`, {
          method: "PATCH",
          body: JSON.stringify({
            type: "BLOCKED",
            note: draft.status === "blocked" ? draft.note.trim() || null : null,
            blocks: [],
          }),
        });
      } else {
        await authedApiRequest<AvailabilityOverride[]>("/availability/overrides", {
          method: "POST",
          body: JSON.stringify({
            date: key,
            type: "BLOCKED",
            note: draft.status === "blocked" ? draft.note.trim() || null : null,
          }),
        });
      }
    } else {
      // Available: if blocks match the weekly default for this weekday, we
      // delete any existing override to keep the data tidy. Otherwise we
      // create/update a CUSTOM_HOURS override.
      const weeklyBlocks = rulesForDay(previewRules, selectedDate.getDay());
      const matchesWeekly = blocksEqual(draft.blocks, weeklyBlocks);

      if (matchesWeekly) {
        if (draft.originalOverrideId) {
          await authedApiRequest(`/availability/overrides/${draft.originalOverrideId}`, {
            method: "DELETE",
          });
        }
      } else if (draft.originalOverrideId) {
        await authedApiRequest(`/availability/overrides/${draft.originalOverrideId}`, {
          method: "PATCH",
          body: JSON.stringify({
            type: "CUSTOM_HOURS",
            note: draft.note.trim() || null,
            blocks: draft.blocks.map(blockToWire),
          }),
        });
      } else {
        await authedApiRequest<AvailabilityOverride[]>("/availability/overrides", {
          method: "POST",
          body: JSON.stringify({
            date: key,
            type: "CUSTOM_HOURS",
            note: draft.note.trim() || null,
            blocks: draft.blocks.map(blockToWire),
          }),
        });
      }
    }
  }

  // ── handlers: weekly tab ────────────────────────────────────────────────

  function markWeekDirty() {
    if (activeServiceId && serviceModeDraft === "HOST_DEFAULT") {
      setServiceModeDraft("CUSTOM");
    }
    setWeekDirty(true);
  }

  function changeServiceAvailabilityMode(mode: EventTypeAvailabilityMode) {
    if (!activeServiceId || serviceModeDraft === mode) return;

    const nextRules =
      mode === "CUSTOM" && savedActiveServiceAvailability?.mode === "CUSTOM"
        ? savedActiveServiceAvailability.rules
        : rules;

    setServiceModeDraft(mode);
    setWeekDraft(buildWeekDraft(nextRules));
    setWeekDirty(true);
    setDayEdits(null);
  }

  function toggleWeekDay(idx: number) {
    setWeekDraft((current) =>
      current.map((day) => {
        if (day.dayIndex !== idx) return day;
        if (day.enabled) return { ...day, enabled: false };
        return {
          ...day,
          enabled: true,
          blocks: day.blocks.length ? day.blocks : [{ start: 9 * 60, end: 17 * 60 }],
        };
      }),
    );
    markWeekDirty();
  }

  function updateWeekBlock(idx: number, blockIndex: number, next: Block) {
    setWeekDraft((current) =>
      current.map((day) =>
        day.dayIndex !== idx
          ? day
          : {
              ...day,
              blocks: day.blocks.map((b, i) => (i === blockIndex ? next : b)),
            },
      ),
    );
    markWeekDirty();
  }

  function addWeekBlock(idx: number) {
    setWeekDraft((current) =>
      current.map((day) => {
        if (day.dayIndex !== idx) return day;
        const lastEnd = day.blocks.length
          ? day.blocks[day.blocks.length - 1].end
          : 9 * 60;
        const start = Math.min(lastEnd + 30, 22 * 60);
        return {
          ...day,
          blocks: [...day.blocks, { start, end: Math.min(start + 120, 24 * 60) }],
        };
      }),
    );
    markWeekDirty();
  }

  function removeWeekBlock(idx: number, blockIndex: number) {
    setWeekDraft((current) =>
      current.map((day) =>
        day.dayIndex !== idx
          ? day
          : { ...day, blocks: day.blocks.filter((_, i) => i !== blockIndex) },
      ),
    );
    markWeekDirty();
  }

  function copyMondayToWeekdays() {
    setWeekDraft((current) => {
      const monday = current.find((d) => d.dayIndex === 1);
      if (!monday) return current;
      return current.map((day) =>
        day.dayIndex >= 1 && day.dayIndex <= 5
          ? {
              ...day,
              enabled: monday.enabled,
              blocks: monday.blocks.map((b) => ({ ...b })),
            }
          : day,
      );
    });
    markWeekDirty();
  }

  // ── handlers: settings tab ──────────────────────────────────────────────

  function updateSetting<K extends keyof AvailabilitySettings>(
    key: K,
    value: AvailabilitySettings[K],
  ) {
    setSettingsDraft((current) =>
      current ? { ...current, [key]: value } : current,
    );
    setSettingsDirty(true);
  }

  // ── handlers: exceptions tab ────────────────────────────────────────────

  const [exceptionEditor, setExceptionEditor] = useState<ExceptionDraft | null>(null);

  async function deleteExceptionGroup(group: ExceptionGroup) {
    try {
      await authedApiRequest(`/availability/overrides/${group.representativeId}`, {
        method: "DELETE",
      });
      const fresh = await authedApiRequest<AvailabilityOverride[]>(
        "/availability/overrides",
      );
      setOverrides(fresh);
      toast.success("Exception removed");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not remove exception",
      );
    }
  }

  async function saveExceptionDraft(draft: ExceptionDraft): Promise<boolean> {
    const startStr = draft.startDate;
    const endStr = draft.endDate || draft.startDate;

    if (!startStr || !endStr) {
      toast.error("Pick a start date");
      return false;
    }

    // Validate blocks if EXTRA_OPENING
    const cleanBlocks: AvailabilityOverrideBlock[] = [];
    if (draft.type === "CUSTOM_HOURS") {
      for (const b of draft.blocks) {
        if (b.start >= b.end) {
          toast.error("Each time block must end after it starts");
          return false;
        }
        cleanBlocks.push(blockToWire(b));
      }
      if (cleanBlocks.length === 0) {
        toast.error("Add at least one time block for an extra opening");
        return false;
      }
    }

    try {
      await authedApiRequest<AvailabilityOverride[]>("/availability/overrides", {
        method: "POST",
        body: JSON.stringify({
          date: startStr,
          endDate: endStr,
          type: draft.type,
          note: draft.note.trim() || null,
          blocks: cleanBlocks,
        }),
      });
      const fresh = await authedApiRequest<AvailabilityOverride[]>(
        "/availability/overrides",
      );
      setOverrides(fresh);
      setExceptionEditor(null);
      toast.success(
        draft.type === "BLOCKED" ? "Dates blocked" : "Extra opening added",
      );
      return true;
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not save exception",
      );
      return false;
    }
  }

  // ── global save ─────────────────────────────────────────────────────────

  function startRangeFromSelectedDate() {
    const fallbackBlocks =
      dayDraft.blocks.length > 0
        ? dayDraft.blocks.map((block) => ({ ...block }))
        : [{ start: 9 * 60, end: 17 * 60 }];

    setTab("exceptions");
    setExceptionEditor({
      startDate: selectedKey,
      endDate: "",
      type: dayDraft.status === "available" ? "CUSTOM_HOURS" : "BLOCKED",
      note: dayDraft.note,
      blocks: fallbackBlocks,
    });
  }

  async function saveAll() {
    if (!dirty) return;
    setSaving(true);
    try {
      if (weekDirty) {
        const wireRules = rulesFromWeekDraft(weekDraft);
        const wirePayload = {
          rules: wireRules,
        };

        if (activeServiceId) {
          const next = await authedApiRequest<EventTypeAvailability>(
            `/availability/event-types/${activeServiceId}`,
            {
              method: "PUT",
              body: JSON.stringify({
                mode: serviceModeDraft,
                rules: serviceModeDraft === "CUSTOM" ? wireRules : [],
              }),
            },
          );
          setServiceAvailabilityById((current) => ({
            ...current,
            [next.eventTypeId]: next,
          }));
          setServiceModeDraft(next.mode);
          setWeekDraft(
            buildWeekDraft(next.mode === "CUSTOM" ? next.rules : rules),
          );
        } else {
          const next = await authedApiRequest<AvailabilityRule[]>(
            "/availability/rules",
            { method: "PUT", body: JSON.stringify(wirePayload) },
          );
          setRules(next);
          setWeekDraft(buildWeekDraft(next));
        }

        setWeekDirty(false);
      }

      if (settingsDirty && settingsDraft) {
        const next = await authedApiRequest<AvailabilitySettings>(
          "/availability/settings",
          {
            method: "PATCH",
            body: JSON.stringify({
              minNoticeMinutes: settingsDraft.minNoticeMinutes,
              bookingHorizonDays: settingsDraft.bookingHorizonDays,
              slotIntervalMinutes: settingsDraft.slotIntervalMinutes,
              dailyBookingLimit: settingsDraft.dailyBookingLimit,
              showBufferTime: settingsDraft.showBufferTime,
            }),
          },
        );
        setSettingsDraft(next);
        setSettingsDirty(false);
      }

      if (dayDraft.dirty) {
        await saveDayDraft(dayDraft);
        const freshOverrides = await authedApiRequest<AvailabilityOverride[]>(
          "/availability/overrides",
        );
        setOverrides(freshOverrides);
        setDayEdits(null);
      }

      toast.success("Availability saved");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not save availability",
      );
    } finally {
      setSaving(false);
    }
  }

  // ── derived: current day display info ───────────────────────────────────

  const selectedKey = dateKey(selectedDate);
  const selectedDayBookings = bookingsByDateKey.get(selectedKey) ?? [];
  const totalWeekHours = useMemo(
    () =>
      weekDraft.reduce(
        (sum, day) => (day.enabled ? sum + totalHours(day.blocks) : sum),
        0,
      ),
    [weekDraft],
  );

  const tzLabel = useMemo(() => {
    if (!user?.timezone) return "UTC";
    try {
      return `${user.timezone} (${formatOffset(user.timezone, new Date())})`;
    } catch {
      return user.timezone;
    }
  }, [user]);

  const calendarSyncPill = useMemo(() => {
    if (calendars.length === 0) {
      return {
        text: "Calendar sync not connected",
        className: "border-[#EEE7DF] bg-white text-[#6B7280]",
        dotClassName: "bg-[#D1D5DB]",
      };
    }

    const hasError = calendars.some(
      (calendar) =>
        calendar.state === "SYNC_ERROR" || calendar.state === "TOKEN_EXPIRED",
    );
    const activeCount = calendars.filter(
      (calendar) => calendar.state === "ACTIVE",
    ).length;
    const latestSync = calendars
      .map((calendar) =>
        calendar.lastSyncedAt ? new Date(calendar.lastSyncedAt).getTime() : 0,
      )
      .reduce((latest, value) => Math.max(latest, value), 0);

    if (hasError) {
      return {
        text: "Calendar sync needs attention",
        className: "border-amber-200 bg-amber-50 text-amber-800",
        dotClassName: "bg-amber-500",
      };
    }

    if (activeCount === 0) {
      return {
        text: "Calendar sync paused",
        className: "border-[#EEE7DF] bg-white text-[#6B7280]",
        dotClassName: "bg-[#9CA3AF]",
      };
    }

    return {
      text: latestSync
        ? `Calendar synced ${formatRelativeCalendarTime(new Date(latestSync))}`
        : `Calendar connected (${activeCount})`,
      className: "border-[#A7F3D0] bg-[#ECFDF5] text-[#065F46]",
      dotClassName: "bg-[#10B981]",
    };
  }, [calendars]);

  // ── render ──────────────────────────────────────────────────────────────

  return (
    <AppShell
      active="Availability"
      title="Availability"
      userInitial={user?.name.charAt(0).toUpperCase() ?? "B"}
    >
      {/* Title row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1
            className="text-[34px] font-extrabold md:text-[38px]"
            style={{ letterSpacing: "-0.03em", lineHeight: "1.02" }}
          >
            Availability
          </h1>
          <p className="mt-1.5 text-[13px] text-[#6B7280]">
            Pick a day on the calendar to edit, or set defaults below.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <span className="inline-flex h-9 items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 text-[12px] font-bold text-amber-800">
              <span className="size-1.5 rounded-full bg-amber-500" /> Unsaved
              changes
            </span>
          ) : null}
          {user ? (
            <a
              href={`/${user.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
            >
              <Eye className="size-4" /> Preview as guest
            </a>
          ) : null}
          <button
            type="button"
            disabled={saving || loading || !dirty}
            onClick={saveAll}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-4 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Compact toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <ServiceFilterSegmented
          eventTypes={eventTypes}
          activeServiceId={activeServiceId}
          onPick={pickAvailabilityScope}
        />
        <span className="text-[12px] text-[#D1D5DB]">·</span>
        <p className="inline-flex items-center gap-1.5 text-[12px] text-[#6B7280]">
          <Globe className="size-3.5 text-[#9CA3AF]" />
          {tzLabel}
        </p>
        <span className="text-[12px] text-[#D1D5DB]">·</span>
        <span className="text-[12px] text-[#6B7280]">
          <span className="font-semibold tabular-nums text-[#0B1220]">
            {totalWeekHours.toFixed(0)}h
          </span>{" "}
          bookable per week
        </span>
        <span
          className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-bold ${calendarSyncPill.className}`}
        >
          <RefreshCw className="size-3.5" />
          <span className={`size-1.5 rounded-full ${calendarSyncPill.dotClassName}`} />
          {calendarSyncPill.text}
        </span>
      </div>

      {/* Block-reason legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-[#EEE7DF] bg-white px-4 py-2.5 text-[11.5px]">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
          Why a time may be blocked
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#374151]">
          <span className="size-2 rounded-sm bg-[#FF5F63]" /> Outside availability
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#374151]">
          <span className="size-2 rounded-sm bg-[#A855F7]" /> Already booked
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#374151]">
          <span className="size-2 rounded-sm bg-[#9CA3AF]" /> Blocked date
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[#6B7280]">
          <Lock className="size-3" /> Private event details aren&apos;t shown.
        </span>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-[#EEE7DF] bg-white p-6 shadow-sm">
          <p className="font-semibold">Availability unavailable</p>
          <p className="mt-1 text-sm text-[#6B7280]">{error}</p>
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          {/* Calendar + day editor */}
          <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)]">
            <CalendarCard
              viewYear={viewYear}
              viewMonth={viewMonth}
              today={today}
              selectedDate={selectedDate}
              monthGrid={monthGrid}
              rules={previewRules}
              overridesByKey={overridesByKey}
              bookingsByDateKey={bookingsByDateKey}
              rangeMode={rangeMode}
              rangeStart={rangeStart}
              rangeEnd={rangeEnd}
              onShiftMonth={shiftMonth}
              onPickToday={pickToday}
              onPickDate={pickDate}
              onApplyRange={startRangeFromSelectedDate}
              onToggleRangeMode={toggleRangeMode}
            />

            {rangeDraft ? (
              <RangeEditor
                start={rangeStart}
                end={rangeEnd}
                draft={rangeDraft}
                saving={savingRange}
                onChange={setRangeDraft}
                onCancel={clearRangeSelection}
                onSave={saveRangeDraft}
              />
            ) : (
              <DayEditor
                selectedDate={selectedDate}
                today={today}
                draft={dayDraft}
                bookings={selectedDayBookings}
                onStatus={setDayStatus}
                onBlockChange={setDayBlock}
                onRemoveBlock={removeDayBlock}
                onAddBlock={addDayBlock}
                onReset={resetDayToWeekly}
                onNote={setDayNote}
              />
            )}
          </section>

          {/* Tabs */}
          <section className="mt-8 rounded-2xl border border-[#EEE7DF] bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-5 border-b border-[#EEE7DF] px-5">
              <TabButton on={tab === "weekly"} onClick={() => setTab("weekly")}>
                {activeService ? "Service weekly hours" : "Default weekly hours"}
              </TabButton>
              <TabButton
                on={tab === "exceptions"}
                onClick={() => setTab("exceptions")}
              >
                Date exceptions
              </TabButton>
              <TabButton on={tab === "rules"} onClick={() => setTab("rules")}>
                Booking rules
              </TabButton>
            </div>

            {tab === "weekly" ? (
              <WeeklyTab
                days={weekDraft}
                totalHours={totalWeekHours}
                serviceTitle={activeService?.title ?? null}
                serviceMode={activeServiceId ? serviceModeDraft : null}
                onServiceModeChange={changeServiceAvailabilityMode}
                onToggle={toggleWeekDay}
                onUpdateBlock={updateWeekBlock}
                onAddBlock={addWeekBlock}
                onRemoveBlock={removeWeekBlock}
                onCopyMonday={copyMondayToWeekdays}
              />
            ) : null}

            {tab === "exceptions" ? (
              <ExceptionsTab
                groups={exceptionGroups}
                editor={exceptionEditor}
                onStartAdd={() => setExceptionEditor(emptyExceptionDraft())}
                onCancel={() => setExceptionEditor(null)}
                onSave={saveExceptionDraft}
                onChange={(next) => setExceptionEditor(next)}
                onDelete={deleteExceptionGroup}
              />
            ) : null}

            {tab === "rules" && settingsDraft ? (
              <RulesTab
                settings={settingsDraft}
                onChange={updateSetting}
              />
            ) : null}
          </section>
        </>
      ) : null}

      {loading && !error ? (
        <div className="mt-8 rounded-2xl border border-[#EEE7DF] bg-white p-10 text-center text-[13px] text-[#9CA3AF]">
          Loading availability…
        </div>
      ) : null}
    </AppShell>
  );
}

// ── child components ──────────────────────────────────────────────────────────

function CalendarCard({
  viewYear,
  viewMonth,
  today,
  selectedDate,
  monthGrid,
  rules,
  overridesByKey,
  bookingsByDateKey,
  rangeMode,
  rangeStart,
  rangeEnd,
  onShiftMonth,
  onPickToday,
  onPickDate,
  onApplyRange,
  onToggleRangeMode,
}: {
  viewYear: number;
  viewMonth: number;
  today: Date;
  selectedDate: Date;
  monthGrid: { date: Date; outside: boolean }[];
  rules: WeeklyRuleLike[];
  overridesByKey: Map<string, AvailabilityOverride>;
  bookingsByDateKey: Map<string, HostBooking[]>;
  rangeMode: boolean;
  rangeStart: Date | null;
  rangeEnd: Date | null;
  onShiftMonth: (delta: number) => void;
  onPickToday: () => void;
  onPickDate: (date: Date) => void;
  onApplyRange: () => void;
  onToggleRangeMode: () => void;
}) {
  const rangeStartKey = rangeStart ? dateKey(rangeStart) : null;
  const rangeEndKey = rangeEnd ? dateKey(rangeEnd) : null;
  function isInRange(date: Date) {
    if (!rangeStart) return false;
    const end = rangeEnd ?? rangeStart;
    const [lo, hi] = rangeStart <= end ? [rangeStart, end] : [end, rangeStart];
    return date >= lo && date <= hi;
  }
  return (
    <div className="rounded-2xl border border-[#EEE7DF] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onShiftMonth(-1)}
            className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-[#FFFBF7]"
          >
            <ChevronLeft className="size-4 text-[#6B7280]" />
          </button>
          <h2 className="text-[16px] font-bold tabular-nums">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onShiftMonth(1)}
            className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-[#FFFBF7]"
          >
            <ChevronRight className="size-4 text-[#6B7280]" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleRangeMode}
            className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-bold transition ${
              rangeMode
                ? "border-[#FF5F63] bg-[#FFF0EF] text-[#FF5F63]"
                : "border-[#E5E7EB] bg-white text-[#0B1220] hover:bg-[#FFFBF7]"
            }`}
            title={
              rangeMode
                ? "Cancel range selection"
                : "Select a range of dates"
            }
          >
            <CalendarRange className="size-3.5" />
            {rangeMode ? "Selecting…" : "Select range"}
          </button>
          <button
            type="button"
            onClick={onPickToday}
            className="text-[12px] font-bold text-[#FF5F63] hover:underline"
          >
            Today
          </button>
        </div>
      </div>

      {rangeMode || rangeStart ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-[#FCC9C5] bg-[#FFF5F4] px-3 py-2 text-[11.5px] font-semibold text-[#7c2222]">
          <CalendarRange className="size-3.5 text-[#FF5F63]" />
          {rangeStart && !rangeEnd
            ? `Start: ${formatDateShort(rangeStart)} — click another day to pick the end`
            : rangeStart && rangeEnd
              ? `Range selected: ${formatDateShort(rangeStart)} → ${formatDateShort(rangeEnd)}`
              : "Click a day to start the range"}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {SHORT_DAYS_MON_FIRST.map((d) => (
          <div
            key={d}
            className="pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-[#9CA3AF]"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {monthGrid.map(({ date, outside }, idx) => {
          const k = dateKey(date);
          const isPast = date < today && !isSameDate(date, today);
          const isToday = isSameDate(date, today);
          const isSelected = isSameDate(date, selectedDate);
          const override = overridesByKey.get(k);

          const dayRules = rulesForDay(rules, date.getDay());
          const bookingsHere = bookingsByDateKey.get(k) ?? [];

          let state: "outside" | "past" | "bookable" | "dayoff" | "blocked" | "fully";
          if (outside) {
            state = "outside";
          } else if (isPast) {
            state = "past";
          } else if (override?.type === "BLOCKED") {
            state = "blocked";
          } else if (override?.type === "CUSTOM_HOURS") {
            state = "bookable";
          } else if (dayRules.length === 0) {
            state = "dayoff";
          } else {
            state = "bookable";
          }

          const used = bookingsHere.length;
          // "Has bookings" lights the purple dot — actual fully-booked status
          // would need the slot generator's output, which isn't on this page.
          if (state === "bookable" && used > 0) state = "fully";

          const inRange = isInRange(date);
          const isRangeEdge =
            (rangeStartKey != null && k === rangeStartKey) ||
            (rangeEndKey != null && k === rangeEndKey);

          return (
            <CalendarCell
              key={`${k}-${idx}`}
              date={date}
              state={state}
              today={isToday}
              selected={isSelected}
              bookingsCount={used}
              note={override?.note ?? null}
              inRange={inRange}
              isRangeEdge={isRangeEdge}
              onClick={() => onPickDate(date)}
            />
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#EEE7DF] pt-3">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#6B7280]">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#16A34A]" /> Bookable
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#A855F7]" /> Has bookings
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#DC2626]" /> Blocked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-[#9CA3AF]" /> Day off
          </span>
        </div>
        <button
          type="button"
          onClick={onApplyRange}
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#0B1220] hover:underline"
        >
          <CalendarRange className="size-3.5 text-[#9CA3AF]" /> Apply to date
          range
        </button>
      </div>
    </div>
  );
}

function CalendarCell({
  date,
  state,
  today,
  selected,
  bookingsCount,
  note,
  inRange = false,
  isRangeEdge = false,
  onClick,
}: {
  date: Date;
  state: "outside" | "past" | "bookable" | "dayoff" | "blocked" | "fully";
  today: boolean;
  selected: boolean;
  bookingsCount: number;
  note: string | null;
  inRange?: boolean;
  isRangeEdge?: boolean;
  onClick: () => void;
}) {
  if (state === "outside") {
    return (
      <div className="relative aspect-square rounded-[10px] p-2">
        <span className="text-[14px] font-bold leading-none text-[#D1D5DB]">
          {date.getDate()}
        </span>
      </div>
    );
  }

  const baseClasses =
    "relative aspect-square rounded-[10px] border border-transparent p-2 text-left transition";
  const stateClasses: Record<
    "past" | "bookable" | "dayoff" | "blocked" | "fully",
    string
  > = {
    past: "text-[#9CA3AF] cursor-default",
    bookable: "bg-white hover:bg-[#FFFBF7] hover:border-[#FCC9C5]",
    dayoff: "bg-[#FAFAF8] text-[#9CA3AF]",
    blocked: "bg-[#FEF2F2]",
    fully: "bg-[#F4EAFF]",
  };

  const selectedClasses =
    selected || isRangeEdge
      ? "!bg-gradient-to-br from-[#FF6267] to-[#FF8A4C] !border-transparent shadow-md text-white"
      : inRange
        ? "!bg-[#FFE7E1] !border-[#FCC9C5]"
        : "";

  const todayClasses =
    today && !selected && !isRangeEdge ? "ring-2 ring-inset ring-[#FF5F63]" : "";

  const dotColor =
    state === "blocked"
      ? "bg-[#DC2626]"
      : state === "fully"
        ? "bg-[#A855F7]"
        : state === "dayoff"
          ? "bg-[#9CA3AF]"
          : "bg-[#16A34A]";

  const indicator =
    state === "blocked"
      ? "Blocked"
      : state === "dayoff"
        ? "Off"
        : state === "fully"
          ? "Booked"
          : bookingsCount > 0
            ? `${bookingsCount} bk`
            : "Open";

  return (
    <button
      type="button"
      onClick={state === "past" ? undefined : onClick}
      disabled={state === "past"}
      title={note ?? undefined}
      className={[baseClasses, stateClasses[state], selectedClasses, todayClasses]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        className={`text-[14px] font-bold leading-none ${
          selected || isRangeEdge
            ? "text-white"
            : state === "blocked"
              ? "text-[#B91C1C]"
              : state === "fully"
                ? "text-[#7C3AED]"
                : state === "dayoff"
                  ? "text-[#9CA3AF]"
                  : state === "past"
                    ? "text-[#9CA3AF]"
                    : "text-[#0B1220]"
        }`}
      >
        {date.getDate()}
      </span>

      {state !== "past" && indicator ? (
        <span className="absolute bottom-1.5 left-2 flex items-center gap-1">
          <span
            className={`size-1.5 rounded-full ${
              selected ? "bg-white" : dotColor
            }`}
          />
          <span
            className={`text-[10px] font-bold tabular-nums ${
              selected ? "text-white" : "text-[#6B7280]"
            }`}
          >
            {indicator}
          </span>
        </span>
      ) : null}
    </button>
  );
}

function DayEditor({
  selectedDate,
  today,
  draft,
  bookings,
  onStatus,
  onBlockChange,
  onRemoveBlock,
  onAddBlock,
  onReset,
  onNote,
}: {
  selectedDate: Date;
  today: Date;
  draft: DayDraft;
  bookings: HostBooking[];
  onStatus: (status: DayStatus) => void;
  onBlockChange: (index: number, next: Block) => void;
  onRemoveBlock: (index: number) => void;
  onAddBlock: () => void;
  onReset: () => void;
  onNote: (value: string) => void;
}) {
  const dow = WEEK_LABELS[selectedDate.getDay()].slice(0, 3);
  const dateLabel = `${dow}, ${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()].slice(0, 3)}`;
  const isPast = selectedDate < today && !isSameDate(selectedDate, today);

  let sub = "";
  if (draft.status === "blocked") {
    sub = "Blocked";
  } else if (draft.status === "dayoff") {
    sub = "Day off";
  } else {
    const open =
      draft.blocks.length > 0
        ? Math.max(0, totalHours(draft.blocks))
        : 0;
    sub = `${bookings.length} booked · ${open.toFixed(1).replace(/\.0$/, "")}h open`;
  }

  return (
    <div className="rounded-2xl border border-[#EEE7DF] bg-white p-5 shadow-sm">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9CA3AF]">
        Selected day
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <h2 className="text-[20px] font-bold tabular-nums">{dateLabel}</h2>
        <span className="text-[12px] text-[#6B7280] tabular-nums">{sub}</span>
      </div>

      {isPast ? (
        <p className="mt-3 rounded-lg border border-[#EEE7DF] bg-[#FAFAF8] px-3 py-2 text-[12px] text-[#9CA3AF]">
          You can&apos;t edit availability in the past.
        </p>
      ) : (
        <>
          <div className="mt-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9CA3AF]">
              Status
            </p>
            <div className="mt-1.5 inline-flex w-full rounded-[10px] border border-[#E5E7EB] bg-[#FFFBF7] p-[3px] gap-[2px]">
              <SegButton on={draft.status === "available"} onClick={() => onStatus("available")}>
                Available
              </SegButton>
              <SegButton on={draft.status === "dayoff"} onClick={() => onStatus("dayoff")}>
                Day off
              </SegButton>
              <SegButton on={draft.status === "blocked"} onClick={() => onStatus("blocked")}>
                Blocked
              </SegButton>
            </div>
          </div>

          {draft.status === "available" ? (
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9CA3AF]">
                  Bookable hours
                </p>
                <button
                  type="button"
                  onClick={onReset}
                  className="text-[11px] font-bold text-[#FF5F63] hover:underline"
                >
                  Reset to default
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {draft.blocks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#EEE7DF] bg-[#FFFBF7] px-3 py-3 text-center text-[12px] text-[#9CA3AF]">
                    No bookable hours yet.
                  </p>
                ) : null}
                {draft.blocks.map((block, idx) => (
                  <BlockRow
                    key={idx}
                    block={block}
                    onChange={(next) => onBlockChange(idx, next)}
                    onRemove={() => onRemoveBlock(idx)}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={onAddBlock}
                className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#FCC9C5] bg-[#FFF7F5] px-3 text-[12px] font-bold text-[#FF5F63] hover:bg-[#FFF0EF]"
              >
                <Plus className="size-3.5" /> Add time block
              </button>
            </div>
          ) : null}

          {draft.status === "dayoff" ? (
            <div className="mt-4 rounded-xl border border-[#EEE7DF] bg-[#FAFAF8] p-4 text-center">
              <p className="text-[13px] font-bold text-[#6B7280]">
                No bookings on this day
              </p>
              <p className="mt-1 text-[11px] text-[#9CA3AF]">
                Guests will see this date as unavailable.
              </p>
            </div>
          ) : null}

          {draft.status === "blocked" ? (
            <div className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4">
              <p className="text-center text-[13px] font-bold text-[#B91C1C]">
                Blocked
              </p>
              <p className="mt-1 text-center text-[11px] text-[#7F1D1D]">
                Hidden from your public booking page.
              </p>
              <label className="mt-3 block text-left">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7F1D1D]">
                  Reason (optional)
                </span>
                <input
                  type="text"
                  value={draft.note}
                  onChange={(e) => onNote(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. Annual leave"
                  className="mt-1.5 block h-9 w-full rounded-lg border border-[#FECACA] bg-white px-3 text-[12px] outline-none focus:border-[#B91C1C] focus:shadow-[0_0_0_4px_rgba(220,38,38,0.15)]"
                />
              </label>
            </div>
          ) : null}
        </>
      )}

      {/* Existing bookings on this day */}
      <div className="mt-5 border-t border-[#EEE7DF] pt-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9CA3AF]">
          Booked on this day
        </p>
        <div className="mt-2 space-y-2">
          {bookings.length === 0 ? (
            <p className="rounded-lg border border-[#EEE7DF] bg-[#FFFBF7] px-3 py-3 text-center text-[12px] text-[#9CA3AF]">
              No bookings yet on this date.
            </p>
          ) : (
            bookings.map((booking) => (
              <BookingRow key={booking.id} booking={booking} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function RangeEditor({
  start,
  end,
  draft,
  saving,
  onChange,
  onCancel,
  onSave,
}: {
  start: Date | null;
  end: Date | null;
  draft: ExceptionDraft;
  saving: boolean;
  onChange: (next: ExceptionDraft) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  if (!start || !end) return null;

  const dayCount =
    Math.round(
      (startOfDay(end).getTime() - startOfDay(start).getTime()) /
        (1000 * 60 * 60 * 24),
    ) + 1;
  const isBlocked = draft.type === "BLOCKED";

  function setStatus(type: AvailabilityOverrideType) {
    if (type === "CUSTOM_HOURS" && draft.blocks.length === 0) {
      onChange({
        ...draft,
        type,
        blocks: [{ start: 9 * 60, end: 17 * 60 }],
      });
      return;
    }
    onChange({ ...draft, type });
  }

  function setBlock(index: number, next: Block) {
    onChange({
      ...draft,
      blocks: draft.blocks.map((b, i) => (i === index ? next : b)),
    });
  }

  function removeBlock(index: number) {
    onChange({
      ...draft,
      blocks: draft.blocks.filter((_, i) => i !== index),
    });
  }

  function addBlock() {
    const last = draft.blocks[draft.blocks.length - 1];
    const nextStart = last ? Math.min(last.end + 30, 22 * 60) : 9 * 60;
    onChange({
      ...draft,
      blocks: [...draft.blocks, { start: nextStart, end: Math.min(nextStart + 60, 23 * 60) }],
    });
  }

  return (
    <div className="rounded-2xl border border-[#FCC9C5] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#FF5F63]">
          Selected range
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-[#9CA3AF] hover:bg-[#FFF6F0] hover:text-[#0B1220]"
          aria-label="Cancel range selection"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <h2 className="text-[18px] font-bold tabular-nums">
          {formatRangeLabel(start, end)}
        </h2>
        <span className="text-[12px] text-[#6B7280] tabular-nums">
          {dayCount} day{dayCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9CA3AF]">
          What should happen on these dates?
        </p>
        <div className="mt-1.5 inline-flex w-full rounded-[10px] border border-[#E5E7EB] bg-[#FFFBF7] p-[3px] gap-[2px]">
          <SegButton
            on={draft.type === "BLOCKED"}
            onClick={() => setStatus("BLOCKED")}
          >
            Block off
          </SegButton>
          <SegButton
            on={draft.type === "CUSTOM_HOURS"}
            onClick={() => setStatus("CUSTOM_HOURS")}
          >
            Custom hours
          </SegButton>
        </div>
        <p className="mt-2 text-[11.5px] text-[#6B7280]">
          {isBlocked
            ? "Guests can't book any of these dates."
            : "Replace the weekly schedule with these time blocks on every day in the range."}
        </p>
      </div>

      {!isBlocked ? (
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9CA3AF]">
              Bookable hours
            </p>
            <button
              type="button"
              onClick={addBlock}
              className="text-[11px] font-bold text-[#FF5F63] hover:underline"
            >
              + Add block
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {draft.blocks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#EEE7DF] bg-[#FFFBF7] px-3 py-3 text-center text-[12px] text-[#9CA3AF]">
                Add at least one time block.
              </p>
            ) : null}
            {draft.blocks.map((block, idx) => (
              <BlockRow
                key={idx}
                block={block}
                onChange={(next) => setBlock(idx, next)}
                onRemove={() => removeBlock(idx)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <label className="block">
          <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9CA3AF]">
            Reason {isBlocked ? "(optional)" : "(optional, shown to you only)"}
          </span>
          <input
            value={draft.note}
            onChange={(event) => onChange({ ...draft, note: event.target.value })}
            placeholder={isBlocked ? "Vacation, holiday, sick day…" : "Extended summer hours…"}
            className="mt-1.5 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
          />
        </label>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-4 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
        >
          {saving
            ? "Saving…"
            : isBlocked
              ? `Block ${dayCount} day${dayCount === 1 ? "" : "s"}`
              : `Apply hours to ${dayCount} day${dayCount === 1 ? "" : "s"}`}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-bold text-[#0B1220] hover:bg-[#FFFBF7] disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function BlockRow({
  block,
  onChange,
  onRemove,
}: {
  block: Block;
  onChange: (next: Block) => void;
  onRemove: () => void;
}) {
  // Uncontrolled inputs keyed on the block value so they reset cleanly when the
  // parent replaces the block (e.g. reset-to-default), but don't fight the user
  // mid-typing. Validation runs on blur — invalid input simply doesn't fire
  // onChange, leaving the parent value (and the next render's defaultValue)
  // unchanged.
  const startKey = `s-${block.start}-${block.end}`;
  const endKey = `e-${block.start}-${block.end}`;

  function commitStart(value: string) {
    const next = parseMin(value);
    if (next === null || next >= block.end) {
      if (next !== null) toast.error("Start must be before end");
      onChange({ ...block });
      return;
    }
    onChange({ start: next, end: block.end });
  }

  function commitEnd(value: string) {
    const next = parseMin(value);
    if (next === null || next <= block.start) {
      if (next !== null) toast.error("End must be after start");
      onChange({ ...block });
      return;
    }
    onChange({ start: block.start, end: next });
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#EEE7DF] bg-[#FFFBF7] px-2.5 py-2">
      <input
        key={startKey}
        defaultValue={fmtMin(block.start)}
        onBlur={(e) => commitStart(e.target.value)}
        className="h-9 w-[88px] rounded-md border border-[#E5E7EB] bg-white px-2 text-center text-[13px] font-semibold tabular-nums outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
      />
      <span className="text-[#9CA3AF]">—</span>
      <input
        key={endKey}
        defaultValue={fmtMin(block.end)}
        onBlur={(e) => commitEnd(e.target.value)}
        className="h-9 w-[88px] rounded-md border border-[#E5E7EB] bg-white px-2 text-center text-[13px] font-semibold tabular-nums outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove time block"
        className="ml-auto rounded-md p-1.5 text-[#9CA3AF] hover:bg-white hover:text-[#B91C1C]"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function BookingRow({ booking }: { booking: HostBooking }) {
  const start = new Date(booking.startTimeUtc);
  const timeLabel = start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#EEE7DF] bg-[#FFFBF7] p-2.5">
      <span className="w-12 text-[11px] font-bold tabular-nums text-[#A855F7]">
        {timeLabel}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[12px] font-bold">{booking.guestName}</p>
        <p className="text-[10px] text-[#6B7280]">
          {booking.eventType.title} · {booking.eventType.durationMinutes} min
        </p>
      </div>
      <span className="rounded-full bg-[#E6F4EA] px-1.5 py-0.5 text-[9px] font-bold text-[#16A34A]">
        Confirmed
      </span>
    </div>
  );
}

function ServiceFilterSegmented({
  eventTypes,
  activeServiceId,
  onPick,
}: {
  eventTypes: EventType[];
  activeServiceId: string | null;
  onPick: (id: string | null) => void;
}) {
  // No services yet — show a quiet placeholder instead of an empty seg control.
  if (eventTypes.length === 0) {
    return (
      <span className="inline-flex h-9 items-center rounded-[10px] border border-dashed border-[#EEE7DF] bg-white px-3 text-[12px] font-bold text-[#9CA3AF]">
        No services yet
      </span>
    );
  }

  // Visible services come from the host's active list. Inactive services are
  // dropped to keep the toolbar focused on what the host is actually selling.
  const visibleServices = eventTypes.filter((service) => service.isActive);

  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-[10px] border border-[#E5E7EB] bg-[#FFFBF7] p-[3px] gap-[2px]">
      <ServiceSegmentedButton
        on={activeServiceId === null}
        onClick={() => onPick(null)}
      >
        All services
      </ServiceSegmentedButton>
      {visibleServices.map((service) => (
        <ServiceSegmentedButton
          key={service.id}
          on={activeServiceId === service.id}
          onClick={() => onPick(service.id)}
        >
          {service.title}
        </ServiceSegmentedButton>
      ))}
    </div>
  );
}

function ServiceSegmentedButton({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] font-bold transition",
        on
          ? "bg-white text-[#0B1220] shadow-[0_1px_2px_rgba(17,24,39,0.08)]"
          : "text-[#6B7280] hover:text-[#0B1220]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SegButton({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 rounded-md px-3 py-1.5 text-[12px] font-bold transition",
        on
          ? "bg-white text-[#0B1220] shadow-[0_1px_2px_rgba(17,24,39,0.08)]"
          : "text-[#6B7280] hover:text-[#0B1220]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function TabButton({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "py-2.5 text-[13px] font-bold border-b-2",
        on
          ? "text-[#FF5F63] border-[#FF5F63]"
          : "text-[#9CA3AF] border-transparent hover:text-[#0B1220]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// ── tabs ──────────────────────────────────────────────────────────────────────

function WeeklyTab({
  days,
  totalHours: weekTotal,
  serviceTitle,
  serviceMode,
  onServiceModeChange,
  onToggle,
  onUpdateBlock,
  onAddBlock,
  onRemoveBlock,
  onCopyMonday,
}: {
  days: WeeklyDay[];
  totalHours: number;
  serviceTitle: string | null;
  serviceMode: EventTypeAvailabilityMode | null;
  onServiceModeChange: (mode: EventTypeAvailabilityMode) => void;
  onToggle: (idx: number) => void;
  onUpdateBlock: (idx: number, blockIndex: number, next: Block) => void;
  onAddBlock: (idx: number) => void;
  onRemoveBlock: (idx: number, blockIndex: number) => void;
  onCopyMonday: () => void;
}) {
  // Reorder days for display: Monday first.
  const ordered = SUNDAY_FIRST_INDEXES.map(
    (idx) => days.find((d) => d.dayIndex === idx)!,
  );

  return (
    <div className="p-5">
      {serviceTitle && serviceMode ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-3.5">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-[#0B1220]">
              {serviceTitle}
            </p>
            <p className="mt-0.5 text-[11px] text-[#6B7280]">
              {serviceMode === "HOST_DEFAULT"
                ? "Inherits your default weekly hours."
                : "Uses custom weekly hours for this service."}
            </p>
          </div>
          <div className="inline-flex rounded-[10px] border border-[#E5E7EB] bg-white p-[3px] gap-[2px]">
            <button
              type="button"
              onClick={() => onServiceModeChange("HOST_DEFAULT")}
              className={[
                "whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] font-bold transition",
                serviceMode === "HOST_DEFAULT"
                  ? "bg-[#FFFBF7] text-[#0B1220] shadow-[0_1px_2px_rgba(17,24,39,0.08)]"
                  : "text-[#6B7280] hover:text-[#0B1220]",
              ].join(" ")}
            >
              Use default
            </button>
            <button
              type="button"
              onClick={() => onServiceModeChange("CUSTOM")}
              className={[
                "whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] font-bold transition",
                serviceMode === "CUSTOM"
                  ? "bg-[#FFFBF7] text-[#0B1220] shadow-[0_1px_2px_rgba(17,24,39,0.08)]"
                  : "text-[#6B7280] hover:text-[#0B1220]",
              ].join(" ")}
            >
              Custom hours
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-[#6B7280]">
          Used as the starting point for every new date. Changes don&apos;t affect
          dates you&apos;ve already edited.
        </p>
      )}
      <div className="mt-4 divide-y divide-[#EEE7DF] rounded-xl border border-[#EEE7DF]">
        {ordered.map((day) => (
          <WeeklyDayRow
            key={day.dayIndex}
            day={day}
            onToggle={() => onToggle(day.dayIndex)}
            onUpdateBlock={(bi, next) => onUpdateBlock(day.dayIndex, bi, next)}
            onAddBlock={() => onAddBlock(day.dayIndex)}
            onRemoveBlock={(bi) => onRemoveBlock(day.dayIndex, bi)}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px] text-[#9CA3AF]">
        <span>
          <span className="font-bold tabular-nums text-[#0B1220]">
            {weekTotal.toFixed(1).replace(/\.0$/, "")}
          </span>{" "}
          hours bookable per week
        </span>
        <button
          type="button"
          onClick={onCopyMonday}
          className="inline-flex items-center gap-1 text-[12px] font-bold text-[#0B1220] hover:underline"
        >
          <Copy className="size-3 text-[#9CA3AF]" /> Copy Monday to all weekdays
        </button>
      </div>
    </div>
  );
}

function WeeklyDayRow({
  day,
  onToggle,
  onUpdateBlock,
  onAddBlock,
  onRemoveBlock,
}: {
  day: WeeklyDay;
  onToggle: () => void;
  onUpdateBlock: (blockIndex: number, next: Block) => void;
  onAddBlock: () => void;
  onRemoveBlock: (blockIndex: number) => void;
}) {
  return (
    <div className="grid grid-cols-[120px_1fr] items-center gap-3 px-4 py-3">
      <div className="flex items-center gap-2.5">
        <Switch on={day.enabled} onClick={onToggle} />
        <span
          className={`text-[13px] font-bold ${day.enabled ? "text-[#0B1220]" : "text-[#9CA3AF]"}`}
        >
          {day.label}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {day.enabled ? (
          <>
            {day.blocks.map((block, idx) => (
              <WeeklyBlockChip
                key={idx}
                block={block}
                onChange={(next) => onUpdateBlock(idx, next)}
                onRemove={() => onRemoveBlock(idx)}
              />
            ))}
            <button
              type="button"
              onClick={onAddBlock}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-[#FCC9C5] bg-[#FFF7F5] px-2 text-[11px] font-bold text-[#FF5F63] hover:bg-[#FFF0EF]"
            >
              <Plus className="size-3" /> Add range
            </button>
          </>
        ) : (
          <span className="text-[12px] italic text-[#9CA3AF]">Day off</span>
        )}
      </div>
    </div>
  );
}

function WeeklyBlockChip({
  block,
  onChange,
  onRemove,
}: {
  block: Block;
  onChange: (next: Block) => void;
  onRemove: () => void;
}) {
  const startKey = `s-${block.start}-${block.end}`;
  const endKey = `e-${block.start}-${block.end}`;

  function commitStart(value: string) {
    const next = parseMin(value);
    if (next === null || next >= block.end) {
      if (next !== null) toast.error("Start must be before end");
      onChange({ ...block });
      return;
    }
    onChange({ start: next, end: block.end });
  }

  function commitEnd(value: string) {
    const next = parseMin(value);
    if (next === null || next <= block.start) {
      if (next !== null) toast.error("End must be after start");
      onChange({ ...block });
      return;
    }
    onChange({ start: block.start, end: next });
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-[#EEE7DF] bg-[#FFFBF7] px-2 py-1">
      <input
        key={startKey}
        defaultValue={fmtMin(block.start)}
        onBlur={(e) => commitStart(e.target.value)}
        className="h-6 w-[58px] rounded border border-transparent bg-transparent px-1 text-center text-[12px] font-bold tabular-nums outline-none focus:border-[#FF5F63]"
      />
      <span className="text-[#9CA3AF]">–</span>
      <input
        key={endKey}
        defaultValue={fmtMin(block.end)}
        onBlur={(e) => commitEnd(e.target.value)}
        className="h-6 w-[58px] rounded border border-transparent bg-transparent px-1 text-center text-[12px] font-bold tabular-nums outline-none focus:border-[#FF5F63]"
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove range"
        className="rounded-md p-1 text-[#9CA3AF] hover:text-[#B91C1C]"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}

function Switch({
  on,
  onClick,
  sm,
}: {
  on: boolean;
  onClick: () => void;
  sm?: boolean;
}) {
  const w = sm ? "w-7" : "w-9";
  const h = sm ? "h-4" : "h-5";
  const knob = sm ? "size-3" : "size-4";
  const off = sm ? "left-[2px]" : "left-[2px]";
  const onPos = sm ? "left-[14px]" : "left-[18px]";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`relative ${w} ${h} shrink-0 rounded-full transition ${
        on ? "bg-gradient-to-r from-[#FF6267] to-[#FF8A4C]" : "bg-[#E5E7EB]"
      }`}
    >
      <span
        className={`absolute top-[2px] ${knob} rounded-full bg-white shadow-sm transition-all ${
          on ? onPos : off
        }`}
      />
    </button>
  );
}

// ── exceptions tab ────────────────────────────────────────────────────────────

type ExceptionDraft = {
  startDate: string;
  endDate: string;
  type: AvailabilityOverrideType;
  note: string;
  blocks: Block[];
};

function emptyExceptionDraft(): ExceptionDraft {
  return {
    startDate: dateKey(new Date()),
    endDate: "",
    type: "BLOCKED",
    note: "",
    blocks: [{ start: 9 * 60, end: 17 * 60 }],
  };
}

function ExceptionsTab({
  groups,
  editor,
  onStartAdd,
  onCancel,
  onSave,
  onChange,
  onDelete,
}: {
  groups: ExceptionGroup[];
  editor: ExceptionDraft | null;
  onStartAdd: () => void;
  onCancel: () => void;
  onSave: (draft: ExceptionDraft) => void;
  onChange: (next: ExceptionDraft) => void;
  onDelete: (group: ExceptionGroup) => void;
}) {
  return (
    <div className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12px] text-[#6B7280]">
          Block off vacations or open extra days outside your normal schedule.
        </p>
        {!editor ? (
          <button
            type="button"
            onClick={onStartAdd}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[12px] font-bold text-[#0B1220] hover:bg-[#FFFBF7]"
          >
            <Plus className="size-3.5" /> Add
          </button>
        ) : null}
      </div>

      {editor ? (
        <ExceptionEditor
          draft={editor}
          onCancel={onCancel}
          onChange={onChange}
          onSave={() => onSave(editor)}
        />
      ) : null}

      <div className="mt-4 space-y-2">
        {groups.length === 0 && !editor ? (
          <p className="rounded-xl border border-dashed border-[#EEE7DF] bg-[#FFFBF7] px-4 py-6 text-center text-[12px] text-[#9CA3AF]">
            No exceptions yet.
          </p>
        ) : null}

        {groups.map((group) => (
          <ExceptionRow key={group.groupKey} group={group} onDelete={() => onDelete(group)} />
        ))}
      </div>
    </div>
  );
}

function ExceptionEditor({
  draft,
  onCancel,
  onChange,
  onSave,
}: {
  draft: ExceptionDraft;
  onCancel: () => void;
  onChange: (next: ExceptionDraft) => void;
  onSave: () => void;
}) {
  const isBlocked = draft.type === "BLOCKED";

  return (
    <div className="mt-3 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
            Type
          </span>
          <select
            value={draft.type}
            onChange={(e) =>
              onChange({
                ...draft,
                type: e.target.value as AvailabilityOverrideType,
              })
            }
            className="mt-1.5 h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-2 text-[13px] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
          >
            <option value="BLOCKED">Blocked (vacation, holiday)</option>
            <option value="CUSTOM_HOURS">Extra opening / custom hours</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
            Start date
          </span>
          <input
            type="date"
            value={draft.startDate}
            min={dateKey(new Date())}
            onChange={(e) => onChange({ ...draft, startDate: e.target.value })}
            className="mt-1.5 h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-2 text-[13px] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
            End date (optional)
          </span>
          <input
            type="date"
            value={draft.endDate}
            min={draft.startDate || dateKey(new Date())}
            onChange={(e) => onChange({ ...draft, endDate: e.target.value })}
            className="mt-1.5 h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-2 text-[13px] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
          Note (optional)
        </span>
        <input
          type="text"
          value={draft.note}
          maxLength={120}
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
          placeholder={isBlocked ? "e.g. Annual leave" : "e.g. Pop-up market"}
          className="mt-1.5 h-9 w-full rounded-lg border border-[#E5E7EB] bg-white px-2 text-[13px] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
        />
      </label>

      {!isBlocked ? (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
            Time blocks
          </p>
          <div className="mt-1.5 space-y-2">
            {draft.blocks.map((block, idx) => (
              <BlockRow
                key={idx}
                block={block}
                onChange={(next) =>
                  onChange({
                    ...draft,
                    blocks: draft.blocks.map((b, i) => (i === idx ? next : b)),
                  })
                }
                onRemove={() =>
                  onChange({
                    ...draft,
                    blocks: draft.blocks.filter((_, i) => i !== idx),
                  })
                }
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              const lastEnd = draft.blocks.length
                ? draft.blocks[draft.blocks.length - 1].end
                : 9 * 60;
              const start = Math.min(lastEnd + 30, 22 * 60);
              onChange({
                ...draft,
                blocks: [
                  ...draft.blocks,
                  { start, end: Math.min(start + 120, 24 * 60) },
                ],
              });
            }}
            className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-[#FCC9C5] bg-[#FFF7F5] px-3 text-[12px] font-bold text-[#FF5F63] hover:bg-[#FFF0EF]"
          >
            <Plus className="size-3.5" /> Add time block
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-lg border border-[#E5E7EB] bg-white px-3 text-[12px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className="inline-flex h-9 items-center rounded-lg bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-4 text-[12px] font-bold text-white shadow-sm hover:brightness-105"
        >
          Save exception
        </button>
      </div>
    </div>
  );
}

function ExceptionRow({
  group,
  onDelete,
}: {
  group: ExceptionGroup;
  onDelete: () => void;
}) {
  if (group.type === "BLOCKED") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#B91C1C]">
          <span className="size-1.5 rounded-full bg-[#DC2626]" /> Blocked
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold tabular-nums">
            {formatRangeLabel(group.start, group.end)}
          </p>
          {group.note ? (
            <p className="text-[11px] text-[#6B7280]">{group.note}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Remove exception"
          className="rounded-md p-1.5 text-[#9CA3AF] hover:bg-white hover:text-[#B91C1C]"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  const blocksLabel = group.blocks
    .map((b) => `${fmtMin(b.start)} – ${fmtMin(b.end)}`)
    .join(", ");

  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-4 py-3">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-[#065F46]">
        <span className="size-1.5 rounded-full bg-[#10B981]" /> Extra opening
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold tabular-nums">
          {formatRangeLabel(group.start, group.end)}
          {blocksLabel ? ` · ${blocksLabel}` : ""}
        </p>
        {group.note ? (
          <p className="text-[11px] text-[#6B7280]">{group.note}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Remove exception"
        className="rounded-md p-1.5 text-[#9CA3AF] hover:bg-white hover:text-[#B91C1C]"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

// ── rules tab ─────────────────────────────────────────────────────────────────

function RulesTab({
  settings,
  onChange,
}: {
  settings: AvailabilitySettings;
  onChange: <K extends keyof AvailabilitySettings>(
    key: K,
    value: AvailabilitySettings[K],
  ) => void;
}) {
  return (
    <div className="p-5">
      <p className="text-[12px] text-[#6B7280]">
        Limits that apply to every service. Override per-service in the service
        editor.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Minimum notice"
          hint="Guests can't book closer than this."
          value={String(settings.minNoticeMinutes)}
          options={NOTICE_OPTIONS.map((o) => ({
            value: String(o.minutes),
            label: o.label,
          }))}
          onChange={(value) => onChange("minNoticeMinutes", Number(value))}
        />
        <SelectField
          label="Booking horizon"
          hint="How far in advance guests can book."
          value={String(settings.bookingHorizonDays)}
          options={HORIZON_OPTIONS.map((o) => ({
            value: String(o.days),
            label: o.label,
          }))}
          onChange={(value) => onChange("bookingHorizonDays", Number(value))}
        />
        <SelectField
          label="Start-time increment"
          hint="Slot intervals on your public page."
          value={String(settings.slotIntervalMinutes)}
          options={SLOT_INTERVAL_OPTIONS.map((m) => ({
            value: String(m),
            label: `${m} minutes`,
          }))}
          onChange={(value) =>
            onChange("slotIntervalMinutes", Number(value))
          }
        />
        <SelectField
          label="Daily booking limit"
          hint="Cap to protect your day."
          value={
            settings.dailyBookingLimit === null
              ? "null"
              : String(settings.dailyBookingLimit)
          }
          options={LIMIT_OPTIONS.map((o) => ({
            value: o.value === null ? "null" : String(o.value),
            label: o.label,
          }))}
          onChange={(value) =>
            onChange("dailyBookingLimit", value === "null" ? null : Number(value))
          }
        />
      </div>
      <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-3.5">
        <div className="min-w-0">
          <p className="text-[13px] font-bold">
            Show buffer time on the public page
          </p>
          <p className="mt-0.5 text-[11px] text-[#6B7280]">
            Off: slots stay tight. On: guests see your cleanup gaps as real time.
          </p>
        </div>
        <Switch
          sm
          on={settings.showBufferTime}
          onClick={() => onChange("showBufferTime", !settings.showBufferTime)}
        />
      </div>
    </div>
  );
}

function SelectField({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-10 w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-[11px] text-[#9CA3AF]">{hint}</p>
    </label>
  );
}

// ── pure helpers ──────────────────────────────────────────────────────────────

function buildBaseDayDraft(
  selectedDate: Date,
  rules: WeeklyRuleLike[],
  overrides: AvailabilityOverride[],
): DayDraft {
  const key = dateKey(selectedDate);
  const override = overrides.find((o) => overrideKey(o) === key);
  if (override) {
    if (override.type === "BLOCKED") {
      return {
        dateKey: key,
        status: "blocked",
        blocks: [],
        note: override.note ?? "",
        originalOverrideId: override.id,
        dirty: false,
      };
    }
    return {
      dateKey: key,
      status: "available",
      blocks: blocksFromOverride(override),
      note: override.note ?? "",
      originalOverrideId: override.id,
      dirty: false,
    };
  }
  const weeklyBlocks = rulesForDay(rules, selectedDate.getDay());
  return {
    dateKey: key,
    status: weeklyBlocks.length > 0 ? "available" : "dayoff",
    blocks: weeklyBlocks,
    note: "",
    originalOverrideId: null,
    dirty: false,
  };
}

function rulesFromWeekDraft(days: WeeklyDay[]): WeeklyRuleLike[] {
  return days
    .filter((day) => day.enabled)
    .flatMap((day) =>
      day.blocks.map((block) => ({
        dayOfWeek: day.dayIndex,
        startMinute: block.start,
        endMinute: block.end,
      })),
    );
}

function buildWeekDraft(rules: WeeklyRuleLike[]): WeeklyDay[] {
  return WEEK_LABELS.map((label, idx) => {
    const blocks = rulesForDay(rules, idx);
    return {
      dayIndex: idx,
      label,
      enabled: blocks.length > 0,
      blocks,
    };
  });
}

function blocksEqual(a: Block[], b: Block[]) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x.start - y.start);
  const sb = [...b].sort((x, y) => x.start - y.start);
  for (let i = 0; i < sa.length; i++) {
    if (sa[i].start !== sb[i].start || sa[i].end !== sb[i].end) return false;
  }
  return true;
}
