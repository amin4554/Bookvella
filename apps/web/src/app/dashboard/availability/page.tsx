"use client";

import { useEffect, useId, useMemo, useState } from "react";
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
  type AvailabilitySchedule,
  type AvailabilitySettings,
  type ConnectedCalendar,
  type EventTypeAvailability,
  type EventTypeAvailabilityMode,
  type EventType,
  type HostBooking,
  type HostBusyEvent,
  type PublicUser,
} from "@/lib/api";
import { SchedulesTab } from "@/components/schedules-tab";
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

const HOUR_OPTIONS = Array.from({ length: 25 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);

const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) =>
  String(minute).padStart(2, "0"),
);

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtMin(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function timeParts(minutes: number) {
  return {
    hour: pad2(Math.floor(minutes / 60)),
    minute: pad2(minutes % 60),
  };
}

function parseTimeParts(hourText: string, minuteText: string): number | null {
  if (hourText.trim() === "") return null;
  const hour = Number(hourText.trim());
  const minute = Number(minuteText.trim() || "0");
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 24 || minute < 0 || minute > 59) return null;
  if (hour === 24 && minute !== 0) return null;
  return hour * 60 + minute;
}

// Mirrors the API-side clampBufferMinutes so the local draft never holds a
// value that the server would reject. Max 4h matches the backend cap.
function clampLocalBuffer(value: number) {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  if (rounded < 0) return 0;
  if (rounded > 240) return 240;
  return rounded;
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
  const [busyEvents, setBusyEvents] = useState<HostBusyEvent[]>([]);
  const [busyEventsLoading, setBusyEventsLoading] = useState(false);
  // Local per-event buffer drafts so the inputs feel responsive while the
  // PATCH is in flight. Keyed by HostBusyEvent.id.
  const [bufferDrafts, setBufferDrafts] = useState<
    Record<string, { before: number; after: number; saving: boolean }>
  >({});
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
  const [tab, setTab] = useState<
    "weekly" | "exceptions" | "rules" | "schedules"
  >("weekly");

  // Named schedules (templates).
  const [schedules, setSchedules] = useState<AvailabilitySchedule[]>([]);
  const [applyingScheduleId, setApplyingScheduleId] = useState<string | null>(
    null,
  );

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
          scheduleList,
        ] =
          await Promise.all([
            authedApiRequest<PublicUser>("/auth/me"),
            authedApiRequest<AvailabilityRule[]>("/availability/rules"),
            authedApiRequest<AvailabilityOverride[]>("/availability/overrides"),
            authedApiRequest<AvailabilitySettings>("/availability/settings"),
            authedApiRequest<HostBooking[]>("/bookings"),
            authedApiRequest<EventType[]>("/event-types"),
            authedApiRequest<ConnectedCalendar[]>("/auth/calendars"),
            authedApiRequest<AvailabilitySchedule[]>("/availability/schedules"),
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
        setSchedules(scheduleList);
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

  // Whether any connected calendar is currently producing busy intervals.
  // Derived so the fetch effect can short-circuit without setting state
  // synchronously on every calendar update.
  const hasActiveBlockingCalendar = useMemo(
    () =>
      calendars.some(
        (calendar) =>
          calendar.state === "ACTIVE" &&
          calendar.conflictsOn &&
          calendar.conflictCalendars.some((conflict) => conflict.enabled),
      ),
    [calendars],
  );

  // Fetch external calendar events for the visible month + one week padding
  // either side, so dragging the selection across month boundaries doesn't
  // momentarily lose context. Refreshes whenever the month view shifts or
  // any connected calendar becomes ACTIVE (e.g. after a reconnect).
  useEffect(() => {
    if (!hasActiveBlockingCalendar) {
      return;
    }

    const start = new Date(viewYear, viewMonth, 1);
    start.setDate(start.getDate() - 7);
    const end = new Date(viewYear, viewMonth + 1, 1);
    end.setDate(end.getDate() + 7);

    let alive = true;
    // Defer the loading flag to a microtask so it doesn't run synchronously
    // inside the effect body (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      if (alive) setBusyEventsLoading(true);
    });
    authedApiRequest<HostBusyEvent[]>(
      `/auth/calendars/busy?start=${encodeURIComponent(
        start.toISOString(),
      )}&end=${encodeURIComponent(end.toISOString())}`,
    )
      .then((events) => {
        if (!alive) return;
        setBusyEvents(events);
      })
      .catch(() => {
        // Calendar sync failures are surfaced through the pill already; don't
        // spam toasts. Just drop the list.
        if (!alive) return;
        setBusyEvents([]);
      })
      .finally(() => {
        if (alive) setBusyEventsLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [viewYear, viewMonth, hasActiveBlockingCalendar]);

  // Hide already-loaded events when no calendar is active (e.g. after the host
  // disconnects every account). Pure derivation — no setState in an effect.
  const visibleBusyEvents = useMemo(
    () => (hasActiveBlockingCalendar ? busyEvents : []),
    [hasActiveBlockingCalendar, busyEvents],
  );

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

  // Overrides scoped to the current view. In host scope, only host-wide rows
  // (eventTypeId === null) apply. In service scope, host-wide rows show in the
  // calendar background and the service's own overrides take precedence.
  const scopedOverrides = useMemo(() => {
    if (activeServiceId) {
      return overrides.filter(
        (override) =>
          override.eventTypeId === null ||
          override.eventTypeId === activeServiceId,
      );
    }
    return overrides.filter((override) => override.eventTypeId === null);
  }, [overrides, activeServiceId]);

  const overridesByKey = useMemo(() => {
    const m = new Map<string, AvailabilityOverride>();
    // Seed with host-wide rows first so service-specific rows can clobber them.
    const sorted = [...scopedOverrides].sort((a, b) => {
      const aHost = a.eventTypeId === null ? 0 : 1;
      const bHost = b.eventTypeId === null ? 0 : 1;
      return aHost - bHost;
    });
    for (const override of sorted) m.set(overrideKey(override), override);
    return m;
  }, [scopedOverrides]);

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

  // External calendar events bucketed by host-local date so the calendar and
  // day editor can render them next to Bookvella bookings.
  const busyEventsByDateKey = useMemo(() => {
    const m = new Map<string, HostBusyEvent[]>();
    for (const event of visibleBusyEvents) {
      const k = dateKey(new Date(event.startTimeUtc));
      const list = m.get(k) ?? [];
      list.push(event);
      m.set(k, list);
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.startTimeUtc.localeCompare(b.startTimeUtc));
    }
    return m;
  }, [visibleBusyEvents]);

  const monthGrid = useMemo(
    () => buildMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  // Exceptions tab shows only the active scope's exceptions so hosts don't see
  // unrelated service blocks while editing host defaults and vice versa.
  const exceptionScopeOverrides = useMemo(() => {
    if (activeServiceId) {
      return overrides.filter(
        (override) => override.eventTypeId === activeServiceId,
      );
    }
    return overrides.filter((override) => override.eventTypeId === null);
  }, [overrides, activeServiceId]);

  const exceptionGroups = useMemo(
    () => groupOverrides(exceptionScopeOverrides),
    [exceptionScopeOverrides],
  );

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
      eventTypeId: activeServiceId ?? null,
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
    // Day edits target the active scope: when a service is selected, the
    // override is scoped to that service. Otherwise it is host-wide.
    const scope = activeServiceId ?? null;
    // We only PATCH/DELETE the base override row if it matches the current
    // scope. Otherwise (e.g. the base draft was a host-wide row but the user
    // is editing inside a service scope) we create a fresh service-scoped row
    // on top of it so the host-wide row stays intact.
    const baseOverride = draft.originalOverrideId
      ? overrides.find((override) => override.id === draft.originalOverrideId)
      : null;
    const editableOverrideId =
      baseOverride && (baseOverride.eventTypeId ?? null) === scope
        ? baseOverride.id
        : null;

    if (draft.status === "blocked" || draft.status === "dayoff") {
      // Delete any CUSTOM_HOURS override and create/update a BLOCKED one.
      if (editableOverrideId) {
        await authedApiRequest(`/availability/overrides/${editableOverrideId}`, {
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
            eventTypeId: scope,
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
        if (editableOverrideId) {
          await authedApiRequest(`/availability/overrides/${editableOverrideId}`, {
            method: "DELETE",
          });
        }
      } else if (editableOverrideId) {
        await authedApiRequest(`/availability/overrides/${editableOverrideId}`, {
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
            eventTypeId: scope,
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

  // ── handlers: schedules tab ─────────────────────────────────────────────

  async function createScheduleFromDraft(name: string) {
    const rules = rulesFromWeekDraft(weekDraft);
    try {
      const created = await authedApiRequest<AvailabilitySchedule>(
        "/availability/schedules",
        {
          method: "POST",
          body: JSON.stringify({ name, rules }),
        },
      );
      setSchedules((current) => [...current, created]);
      toast.success(`Template "${created.name}" saved`);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not save template",
      );
    }
  }

  async function renameSchedule(id: string, name: string) {
    try {
      const updated = await authedApiRequest<AvailabilitySchedule>(
        `/availability/schedules/${id}`,
        { method: "PATCH", body: JSON.stringify({ name }) },
      );
      setSchedules((current) =>
        current.map((schedule) => (schedule.id === id ? updated : schedule)),
      );
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not rename template",
      );
    }
  }

  async function deleteSchedule(id: string) {
    try {
      await authedApiRequest(`/availability/schedules/${id}`, {
        method: "DELETE",
      });
      setSchedules((current) =>
        current.filter((schedule) => schedule.id !== id),
      );
      toast.success("Template removed");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not delete template",
      );
    }
  }

  async function applySchedule(scheduleId: string) {
    if (weekDirty || dayDraft.dirty) {
      const shouldDiscard = window.confirm(
        "You have unsaved weekly/day edits that will be discarded. Apply the template anyway?",
      );
      if (!shouldDiscard) return;
    }
    setApplyingScheduleId(scheduleId);
    try {
      await authedApiRequest("/availability/schedules/apply", {
        method: "POST",
        body: JSON.stringify({
          scheduleId,
          eventTypeId: activeServiceId ?? null,
        }),
      });

      if (activeServiceId) {
        const next = await authedApiRequest<EventTypeAvailability>(
          `/availability/event-types/${activeServiceId}`,
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
        const freshRules = await authedApiRequest<AvailabilityRule[]>(
          "/availability/rules",
        );
        setRules(freshRules);
        setWeekDraft(buildWeekDraft(freshRules));
      }

      setWeekDirty(false);
      setDayEdits(null);
      toast.success("Template applied");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not apply template",
      );
    } finally {
      setApplyingScheduleId(null);
    }
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
          eventTypeId: draft.eventTypeId ?? null,
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
      eventTypeId: activeServiceId ?? null,
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
  const selectedDayBusyEvents =
    busyEventsByDateKey.get(selectedKey) ?? [];

  // Local-only update of a buffer input — the network call happens on blur via
  // onBufferCommit so we don't fire a PATCH per keystroke.
  function updateBufferDraft(
    eventId: string,
    next: { before?: number; after?: number },
  ) {
    setBufferDrafts((prev) => {
      const existing = prev[eventId];
      const fallback = visibleBusyEvents.find((event) => event.id === eventId);
      const base = existing ?? {
        before: fallback?.bufferBeforeMinutes ?? 0,
        after: fallback?.bufferAfterMinutes ?? 0,
        saving: false,
      };
      return {
        ...prev,
        [eventId]: {
          before:
            next.before !== undefined ? clampLocalBuffer(next.before) : base.before,
          after:
            next.after !== undefined ? clampLocalBuffer(next.after) : base.after,
          saving: base.saving,
        },
      };
    });
  }

  async function toggleEventIgnored(event: HostBusyEvent) {
    const nextIgnored = !event.ignored;
    // Optimistic: flip the flag locally so the row shows the new state
    // immediately. We'll revert on error.
    setBusyEvents((prev) =>
      prev.map((e) =>
        e.id === event.id ? { ...e, ignored: nextIgnored } : e,
      ),
    );

    try {
      const updated = await authedApiRequest<{
        bufferBeforeMinutes: number;
        bufferAfterMinutes: number;
        ignored: boolean;
      }>(
        `/auth/calendars/${event.connectedCalendarId}/events/${encodeURIComponent(
          event.providerEventId,
        )}/ignored`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ignored: nextIgnored,
            providerCalendarId: event.providerCalendarId,
          }),
        },
      );
      setBusyEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? {
                ...e,
                bufferBeforeMinutes: updated.bufferBeforeMinutes,
                bufferAfterMinutes: updated.bufferAfterMinutes,
                ignored: updated.ignored,
              }
            : e,
        ),
      );
      toast.success(
        nextIgnored
          ? "Event won’t block bookings"
          : "Event will block bookings again",
      );
    } catch (caught) {
      // Revert the optimistic flip.
      setBusyEvents((prev) =>
        prev.map((e) =>
          e.id === event.id ? { ...e, ignored: event.ignored } : e,
        ),
      );
      toast.error(
        caught instanceof Error ? caught.message : "Could not update event",
      );
    }
  }

  async function commitEventBuffer(event: HostBusyEvent) {
    const draft = bufferDrafts[event.id];
    const before = draft?.before ?? event.bufferBeforeMinutes;
    const after = draft?.after ?? event.bufferAfterMinutes;
    if (
      before === event.bufferBeforeMinutes &&
      after === event.bufferAfterMinutes
    ) {
      return;
    }

    setBufferDrafts((prev) => ({
      ...prev,
      [event.id]: { before, after, saving: true },
    }));

    try {
      const updated = await authedApiRequest<{
        bufferBeforeMinutes: number;
        bufferAfterMinutes: number;
      }>(
        `/auth/calendars/${event.connectedCalendarId}/events/${encodeURIComponent(
          event.providerEventId,
        )}/buffer`,
        {
          method: "PATCH",
          body: JSON.stringify({
            bufferBeforeMinutes: before,
            bufferAfterMinutes: after,
            providerCalendarId: event.providerCalendarId,
          }),
        },
      );
      setBusyEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? {
                ...e,
                bufferBeforeMinutes: updated.bufferBeforeMinutes,
                bufferAfterMinutes: updated.bufferAfterMinutes,
              }
            : e,
        ),
      );
      setBufferDrafts((prev) => {
        const next = { ...prev };
        delete next[event.id];
        return next;
      });
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not update event buffer",
      );
      setBufferDrafts((prev) => ({
        ...prev,
        [event.id]: { before, after, saving: false },
      }));
    }
  }
  const totalWeekHours = useMemo(
    () =>
      weekDraft.reduce(
        (sum, day) => (day.enabled ? sum + totalHours(day.blocks) : sum),
        0,
      ),
    [weekDraft],
  );

  const [syncRefreshing, setSyncRefreshing] = useState(false);

  // Re-fetch the list of connected calendars and the current busy-event window.
  // Used by the inline "Calendar synced X" pill so the host can pull updates on
  // demand without opening Settings. We also re-fetch the connected calendar
  // list (no per-calendar refresh call) so any state change (paused, errored,
  // newly active) shows up in the pill.
  async function refreshCalendarsAndBusy() {
    if (syncRefreshing) return;
    setSyncRefreshing(true);
    setBusyEventsLoading(true);
    try {
      const start = new Date(viewYear, viewMonth, 1);
      start.setDate(start.getDate() - 7);
      const end = new Date(viewYear, viewMonth + 1, 1);
      end.setDate(end.getDate() + 7);

      // Trigger a remote refresh on each connected calendar first so the
      // subsequent busy fetch reflects whatever has changed on the provider
      // side since the last sync.
      const refreshed = await Promise.all(
        calendars
          .filter(
            (calendar) =>
              calendar.state === "ACTIVE" || calendar.state === "PAUSED",
          )
          .map((calendar) =>
            authedApiRequest<ConnectedCalendar>(
              `/auth/calendars/${calendar.id}/refresh`,
              { method: "PATCH" },
            ).catch(() => null),
          ),
      );

      const freshList = await authedApiRequest<ConnectedCalendar[]>(
        "/auth/calendars",
      );
      setCalendars(freshList);

      if (
        freshList.some(
          (calendar) =>
            calendar.state === "ACTIVE" &&
            calendar.conflictsOn &&
            calendar.conflictCalendars.some((conflict) => conflict.enabled),
        )
      ) {
        const events = await authedApiRequest<HostBusyEvent[]>(
          `/auth/calendars/busy?start=${encodeURIComponent(
            start.toISOString(),
          )}&end=${encodeURIComponent(end.toISOString())}`,
        );
        setBusyEvents(events);
      } else {
        setBusyEvents([]);
      }

      const succeeded = refreshed.filter(Boolean).length;
      if (succeeded > 0) {
        toast.success("Calendar synced");
      } else if (calendars.length === 0) {
        toast.error("No calendar connected");
      } else {
        toast.error("Could not sync calendar");
      }
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not sync calendar",
      );
    } finally {
      setSyncRefreshing(false);
      setBusyEventsLoading(false);
    }
  }

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
        className: "border-line-cream bg-surface-card text-ink-soft",
        dotClassName: "bg-line-strong",
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
        className: "border-warning-border bg-warning-tint text-warning-strong",
        dotClassName: "bg-warning-amber",
      };
    }

    if (activeCount === 0) {
      return {
        text: "Calendar sync paused",
        className: "border-line-cream bg-surface-card text-ink-soft",
        dotClassName: "bg-ink-muted",
      };
    }

    return {
      text: latestSync
        ? `Calendar synced ${formatRelativeCalendarTime(new Date(latestSync))}`
        : `Calendar connected (${activeCount})`,
      className: "border-success-border bg-success-tint text-success-deep",
      dotClassName: "bg-success-bright",
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
          <p className="mt-1.5 text-[13px] text-ink-soft">
            Pick a day on the calendar to edit, or set defaults below.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {dirty ? (
            <span className="inline-flex h-9 items-center gap-2 rounded-full border border-warning-border bg-warning-tint px-3 text-[12px] font-bold text-warning-strong">
              <span className="size-1.5 rounded-full bg-warning-amber" /> Unsaved
              changes
            </span>
          ) : null}
          {user ? (
            <a
              href={`/${user.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-soft bg-surface-card px-3.5 text-[13px] font-bold text-ink-strong hover:bg-surface-soft"
            >
              <Eye className="size-4" /> Preview as guest
            </a>
          ) : null}
          <button
            type="button"
            disabled={saving || loading || !dirty}
            onClick={saveAll}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-r from-brand-coral to-brand-orange px-4 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
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
        <span className="text-[12px] text-ink-faint">·</span>
        <p className="inline-flex items-center gap-1.5 text-[12px] text-ink-soft">
          <Globe className="size-3.5 text-ink-muted" />
          {tzLabel}
        </p>
        <span className="text-[12px] text-ink-faint">·</span>
        <span className="text-[12px] text-ink-soft">
          <span className="font-semibold tabular-nums text-ink-strong">
            {totalWeekHours.toFixed(0)}h
          </span>{" "}
          bookable per week
        </span>
        <button
          type="button"
          onClick={refreshCalendarsAndBusy}
          disabled={syncRefreshing || calendars.length === 0}
          aria-label="Refresh calendar sync"
          title={
            calendars.length === 0
              ? "Connect a calendar in Settings to sync"
              : "Click to refresh calendar"
          }
          className={`group inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] font-bold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70 ${calendarSyncPill.className}`}
        >
          <RefreshCw
            className={`size-3.5 transition-transform ${
              syncRefreshing
                ? "animate-spin"
                : "group-hover:rotate-90"
            }`}
          />
          <span className={`size-1.5 rounded-full ${calendarSyncPill.dotClassName}`} />
          {syncRefreshing ? "Syncing…" : calendarSyncPill.text}
        </button>
      </div>

      {/* Block-reason legend */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line-cream bg-surface-card px-4 py-2.5 text-[11.5px]">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Why a time may be blocked
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-body">
          <span className="size-2 rounded-sm bg-brand" /> Outside availability
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-body">
          <span className="size-2 rounded-sm bg-purple" /> Already booked
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-body">
          <span className="size-2 rounded-sm bg-ink-muted" /> Blocked date
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink-body">
          <span className="size-2 rounded-sm bg-info-bright" /> External calendar event
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-ink-soft">
          <Lock className="size-3" /> Private event details aren&apos;t shown.
        </span>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-line-cream bg-surface-card p-6 shadow-sm">
          <p className="font-semibold">Availability unavailable</p>
          <p className="mt-1 text-sm text-ink-soft">{error}</p>
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
              busyEventsByDateKey={busyEventsByDateKey}
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
                busyEvents={selectedDayBusyEvents}
                bufferDrafts={bufferDrafts}
                busyEventsLoading={busyEventsLoading}
                onStatus={setDayStatus}
                onBlockChange={setDayBlock}
                onRemoveBlock={removeDayBlock}
                onAddBlock={addDayBlock}
                onReset={resetDayToWeekly}
                onNote={setDayNote}
                onBufferDraftChange={updateBufferDraft}
                onBufferCommit={commitEventBuffer}
                onToggleIgnored={toggleEventIgnored}
              />
            )}
          </section>

          {/* Tabs */}
          <section className="mt-8 rounded-2xl border border-line-cream bg-surface-card shadow-sm">
            <div className="flex flex-wrap items-center gap-5 border-b border-line-cream px-5">
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
              <TabButton
                on={tab === "schedules"}
                onClick={() => setTab("schedules")}
              >
                Schedules
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
                scopeLabel={
                  activeService
                    ? `for "${activeService.title}"`
                    : "across every service"
                }
                onStartAdd={() =>
                  setExceptionEditor(
                    emptyExceptionDraft(activeServiceId ?? null),
                  )
                }
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

            {tab === "schedules" ? (
              <SchedulesTab
                schedules={schedules}
                applyingId={applyingScheduleId}
                saving={saving}
                scopeLabel={
                  activeService
                    ? `the "${activeService.title}" service`
                    : "your default weekly hours"
                }
                canSaveFromDraft={weekDraft.length > 0}
                onApply={applySchedule}
                onCreateFromDraft={createScheduleFromDraft}
                onRename={renameSchedule}
                onDelete={deleteSchedule}
              />
            ) : null}
          </section>
        </>
      ) : null}

      {loading && !error ? (
        <div className="mt-8 rounded-2xl border border-line-cream bg-surface-card p-10 text-center text-[13px] text-ink-muted">
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
  busyEventsByDateKey,
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
  busyEventsByDateKey: Map<string, HostBusyEvent[]>;
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
    <div className="rounded-2xl border border-line-cream bg-surface-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => onShiftMonth(-1)}
            className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-surface-page"
          >
            <ChevronLeft className="size-4 text-ink-soft" />
          </button>
          <h2 className="text-[16px] font-bold tabular-nums">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => onShiftMonth(1)}
            className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-surface-page"
          >
            <ChevronRight className="size-4 text-ink-soft" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleRangeMode}
            className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-bold transition ${
              rangeMode
                ? "border-brand bg-brand-tint-100 text-brand"
                : "border-line-soft bg-surface-card text-ink-strong hover:bg-surface-page"
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
            className="text-[12px] font-bold text-brand hover:underline"
          >
            Today
          </button>
        </div>
      </div>

      {rangeMode || rangeStart ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-brand-tint-300 bg-danger-warm-tint px-3 py-2 text-[11.5px] font-semibold text-danger-brown">
          <CalendarRange className="size-3.5 text-brand" />
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
            className="pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-ink-muted"
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
          const externalHere = busyEventsByDateKey.get(k) ?? [];

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
              externalCount={externalHere.length}
              note={override?.note ?? null}
              inRange={inRange}
              isRangeEdge={isRangeEdge}
              onClick={() => onPickDate(date)}
            />
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line-cream pt-3">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-soft">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-success" /> Bookable
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-purple" /> Has bookings
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-danger-strong" /> Blocked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-ink-muted" /> Day off
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-info-bright" /> External event
          </span>
        </div>
        <button
          type="button"
          onClick={onApplyRange}
          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ink-strong hover:underline"
        >
          <CalendarRange className="size-3.5 text-ink-muted" /> Apply to date
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
  externalCount,
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
  externalCount: number;
  note: string | null;
  inRange?: boolean;
  isRangeEdge?: boolean;
  onClick: () => void;
}) {
  if (state === "outside") {
    return (
      <div className="relative aspect-square rounded-[10px] p-2">
        <span className="text-[14px] font-bold leading-none text-ink-faint">
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
    past: "text-ink-muted cursor-default",
    bookable: "bg-surface-card hover:bg-surface-page hover:border-brand-tint-300",
    dayoff: "bg-surface-cream text-ink-muted",
    blocked: "bg-danger-tint",
    fully: "bg-purple-tint",
  };

  const selectedClasses =
    selected || isRangeEdge
      ? "!bg-gradient-to-br from-brand-coral to-brand-orange !border-transparent shadow-md text-white"
      : inRange
        ? "!bg-danger-warm !border-brand-tint-300"
        : "";

  const todayClasses =
    today && !selected && !isRangeEdge ? "ring-2 ring-inset ring-brand" : "";

  const dotColor =
    state === "blocked"
      ? "bg-danger-strong"
      : state === "fully"
        ? "bg-purple"
        : state === "dayoff"
          ? "bg-ink-muted"
          : "bg-success";

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
              ? "text-danger"
              : state === "fully"
                ? "text-purple-strong"
                : state === "dayoff"
                  ? "text-ink-muted"
                  : state === "past"
                    ? "text-ink-muted"
                    : "text-ink-strong"
        }`}
      >
        {date.getDate()}
      </span>

      {state !== "past" && indicator ? (
        <span className="absolute bottom-1.5 left-2 flex items-center gap-1">
          <span
            className={`size-1.5 rounded-full ${
              selected ? "bg-surface-card" : dotColor
            }`}
          />
          <span
            className={`text-[10px] font-bold tabular-nums ${
              selected ? "text-white" : "text-ink-soft"
            }`}
          >
            {indicator}
          </span>
        </span>
      ) : null}

      {externalCount > 0 ? (
        <span
          title={`${externalCount} external calendar ${
            externalCount === 1 ? "event" : "events"
          }`}
          className={`absolute top-1.5 right-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-bold tabular-nums ${
            selected || isRangeEdge
              ? "bg-white/30 text-white"
              : "bg-info-tint text-info"
          }`}
        >
          {externalCount}
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
  busyEvents,
  bufferDrafts,
  busyEventsLoading,
  onStatus,
  onBlockChange,
  onRemoveBlock,
  onAddBlock,
  onReset,
  onNote,
  onBufferDraftChange,
  onBufferCommit,
  onToggleIgnored,
}: {
  selectedDate: Date;
  today: Date;
  draft: DayDraft;
  bookings: HostBooking[];
  busyEvents: HostBusyEvent[];
  bufferDrafts: Record<string, { before: number; after: number; saving: boolean }>;
  busyEventsLoading: boolean;
  onStatus: (status: DayStatus) => void;
  onBlockChange: (index: number, next: Block) => void;
  onRemoveBlock: (index: number) => void;
  onAddBlock: () => void;
  onReset: () => void;
  onNote: (value: string) => void;
  onBufferDraftChange: (
    eventId: string,
    next: { before?: number; after?: number },
  ) => void;
  onBufferCommit: (event: HostBusyEvent) => void;
  onToggleIgnored: (event: HostBusyEvent) => void;
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
    const externalLabel =
      busyEvents.length > 0 ? ` · ${busyEvents.length} external` : "";
    sub = `${bookings.length} booked${externalLabel} · ${open
      .toFixed(1)
      .replace(/\.0$/, "")}h open`;
  }

  return (
    <div className="rounded-2xl border border-line-cream bg-surface-card p-5 shadow-sm">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">
        Selected day
      </p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <h2 className="text-[20px] font-bold tabular-nums">{dateLabel}</h2>
        <span className="text-[12px] text-ink-soft tabular-nums">{sub}</span>
      </div>

      {isPast ? (
        <p className="mt-3 rounded-lg border border-line-cream bg-surface-cream px-3 py-2 text-[12px] text-ink-muted">
          You can&apos;t edit availability in the past.
        </p>
      ) : (
        <>
          <div className="mt-4">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">
              Status
            </p>
            <div className="mt-1.5 inline-flex w-full rounded-[10px] border border-line-soft bg-surface-page p-[3px] gap-[2px]">
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
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">
                  Bookable hours
                </p>
                <button
                  type="button"
                  onClick={onReset}
                  className="text-[11px] font-bold text-brand hover:underline"
                >
                  Reset to default
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {draft.blocks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line-cream bg-surface-page px-3 py-3 text-center text-[12px] text-ink-muted">
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
                className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-tint-300 bg-brand-tint-50 px-3 text-[12px] font-bold text-brand hover:bg-brand-tint-100"
              >
                <Plus className="size-3.5" /> Add time block
              </button>
            </div>
          ) : null}

          {draft.status === "dayoff" ? (
            <div className="mt-4 rounded-xl border border-line-cream bg-surface-cream p-4 text-center">
              <p className="text-[13px] font-bold text-ink-soft">
                No bookings on this day
              </p>
              <p className="mt-1 text-[11px] text-ink-muted">
                Guests will see this date as unavailable.
              </p>
            </div>
          ) : null}

          {draft.status === "blocked" ? (
            <div className="mt-4 rounded-xl border border-danger-border bg-danger-tint p-4">
              <p className="text-center text-[13px] font-bold text-danger">
                Blocked
              </p>
              <p className="mt-1 text-center text-[11px] text-danger-deep">
                Hidden from your public booking page.
              </p>
              <label className="mt-3 block text-left">
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-danger-deep">
                  Reason (optional)
                </span>
                <input
                  type="text"
                  value={draft.note}
                  onChange={(e) => onNote(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. Annual leave"
                  className="mt-1.5 block h-9 w-full rounded-lg border border-danger-border bg-surface-card px-3 text-[12px] outline-none focus:border-danger focus:shadow-[0_0_0_4px_rgba(220,38,38,0.15)]"
                />
              </label>
            </div>
          ) : null}
        </>
      )}

      {/* Combined Bookvella + external calendar events on this day */}
      <div className="mt-5 border-t border-line-cream pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">
            Calendar events
          </p>
          {busyEventsLoading ? (
            <span className="text-[10px] text-ink-muted">Syncing…</span>
          ) : null}
        </div>
        <div className="mt-2 space-y-2">
          {bookings.length === 0 && busyEvents.length === 0 ? (
            <p className="rounded-lg border border-line-cream bg-surface-page px-3 py-3 text-center text-[12px] text-ink-muted">
              {busyEventsLoading
                ? "Loading external events…"
                : "Nothing scheduled on this date."}
            </p>
          ) : null}
          {bookings.map((booking) => (
            <BookingRow key={booking.id} booking={booking} />
          ))}
          {busyEvents.map((event) => {
            const localDraft = bufferDrafts[event.id];
            const before = localDraft?.before ?? event.bufferBeforeMinutes;
            const after = localDraft?.after ?? event.bufferAfterMinutes;
            const saving = localDraft?.saving ?? false;
            return (
              <ExternalEventRow
                key={event.id}
                event={event}
                bufferBefore={before}
                bufferAfter={after}
                saving={saving}
                onChange={(next) => onBufferDraftChange(event.id, next)}
                onCommit={() => onBufferCommit(event)}
                onToggleIgnored={() => onToggleIgnored(event)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ExternalEventRow({
  event,
  bufferBefore,
  bufferAfter,
  saving,
  onChange,
  onCommit,
  onToggleIgnored,
}: {
  event: HostBusyEvent;
  bufferBefore: number;
  bufferAfter: number;
  saving: boolean;
  onChange: (next: { before?: number; after?: number }) => void;
  onCommit: () => void;
  onToggleIgnored: () => void;
}) {
  const start = new Date(event.startTimeUtc);
  const end = new Date(event.endTimeUtc);
  const timeLabel = `${start.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}–${end.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })}`;
  const providerLabel =
    event.provider === "GOOGLE" ? "Google" : "Outlook";
  const calendarLabel = event.calendarName ?? providerLabel;
  const ignored = event.ignored;

  return (
    <div
      className={`rounded-lg border bg-surface-card p-2.5 transition ${
        ignored
          ? "border-dashed border-line-soft bg-surface-cream"
          : "border-line-cream"
      }`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`size-2 rounded-full ${ignored ? "opacity-40" : ""}`}
          style={{ background: event.calendarColor ?? "var(--color-ink-soft)" }}
        />
        <span
          className={`w-24 text-[11px] font-bold tabular-nums ${
            ignored ? "text-ink-muted line-through" : "text-ink-soft"
          }`}
        >
          {timeLabel}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p
            className={`truncate text-[12px] font-bold ${
              ignored ? "text-ink-muted line-through" : "text-ink-strong"
            }`}
          >
            {ignored ? "Available (ignored)" : "Busy"}
          </p>
          <p className="truncate text-[10px] text-ink-soft">
            {providerLabel} · {calendarLabel}
          </p>
        </div>
        <span className="rounded-full bg-line-subtle px-1.5 py-0.5 text-[9px] font-bold text-ink-body">
          External
        </span>
        <button
          type="button"
          onClick={onToggleIgnored}
          aria-label={
            ignored
              ? "Treat this event as busy again"
              : "Stay available during this event"
          }
          title={
            ignored
              ? "Treat as busy again"
              : "I'm actually available during this event"
          }
          className={`inline-flex size-6 items-center justify-center rounded-md border text-ink-soft transition hover:text-ink-strong ${
            ignored
              ? "border-success-bright bg-success-tint text-success-strong hover:bg-success-tint-strong"
              : "border-line-soft bg-surface-card hover:border-brand-tint-300 hover:bg-brand-tint-50"
          }`}
        >
          {ignored ? (
            <RefreshCw className="size-3.5" />
          ) : (
            <X className="size-3.5" />
          )}
        </button>
      </div>
      {ignored ? (
        <p className="mt-2 border-t border-dashed border-line-soft pt-2 text-[10.5px] italic text-ink-soft">
          This event won&apos;t block bookings. Click the arrow above to treat
          it as busy again.
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line-subtle pt-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-ink-muted">
            Block also
          </span>
          <BufferStepper
            value={bufferBefore}
            disabled={saving}
            label="min before"
            onChange={(next) => onChange({ before: next })}
            onCommit={onCommit}
          />
          <BufferStepper
            value={bufferAfter}
            disabled={saving}
            label="min after"
            onChange={(next) => onChange({ after: next })}
            onCommit={onCommit}
          />
          {saving ? (
            <span className="text-[10px] text-ink-muted">Saving…</span>
          ) : null}
        </div>
      )}
    </div>
  );
}

function BufferStepper({
  value,
  disabled,
  label,
  onChange,
  onCommit,
}: {
  value: number;
  disabled: boolean;
  label: string;
  onChange: (next: number) => void;
  onCommit: () => void;
}) {
  const step = 5;
  const max = 240;
  const clamp = (next: number) => Math.max(0, Math.min(max, next));

  function bump(delta: number) {
    if (disabled) return;
    const next = clamp(value + delta);
    if (next === value) return;
    onChange(next);
    // Persist immediately on stepper bump — there's no blur event when the
    // user just keeps clicking the chevrons.
    queueMicrotask(onCommit);
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <div
        className={`inline-flex h-8 items-stretch overflow-hidden rounded-md border border-line-soft bg-surface-card ${
          disabled ? "opacity-60" : ""
        }`}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Decrease ${label}`}
          disabled={disabled || value <= 0}
          onClick={() => bump(-step)}
          className="flex w-6 items-center justify-center text-[14px] font-bold text-ink-soft hover:bg-surface-soft disabled:cursor-not-allowed disabled:text-ink-faint"
        >
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            const raw = event.target.value;
            const next = raw === "" ? 0 : Number(raw);
            if (Number.isFinite(next)) onChange(clamp(next));
          }}
          onBlur={onCommit}
          className="w-10 border-x border-line-soft bg-surface-card text-center text-[11px] font-bold tabular-nums text-ink-strong outline-none focus:bg-surface-page [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Increase ${label}`}
          disabled={disabled || value >= max}
          onClick={() => bump(step)}
          className="flex w-6 items-center justify-center text-[14px] font-bold text-ink-soft hover:bg-surface-soft disabled:cursor-not-allowed disabled:text-ink-faint"
        >
          +
        </button>
      </div>
      <span className="text-[10px] text-ink-soft">{label}</span>
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
    <div className="rounded-2xl border border-brand-tint-300 bg-surface-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-brand">
          Selected range
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md p-1 text-ink-muted hover:bg-surface-blush hover:text-ink-strong"
          aria-label="Cancel range selection"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <h2 className="text-[18px] font-bold tabular-nums">
          {formatRangeLabel(start, end)}
        </h2>
        <span className="text-[12px] text-ink-soft tabular-nums">
          {dayCount} day{dayCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">
          What should happen on these dates?
        </p>
        <div className="mt-1.5 inline-flex w-full rounded-[10px] border border-line-soft bg-surface-page p-[3px] gap-[2px]">
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
        <p className="mt-2 text-[11.5px] text-ink-soft">
          {isBlocked
            ? "Guests can't book any of these dates."
            : "Replace the weekly schedule with these time blocks on every day in the range."}
        </p>
      </div>

      {!isBlocked ? (
        <div className="mt-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">
              Bookable hours
            </p>
            <button
              type="button"
              onClick={addBlock}
              className="text-[11px] font-bold text-brand hover:underline"
            >
              + Add block
            </button>
          </div>
          <div className="mt-2 space-y-2">
            {draft.blocks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line-cream bg-surface-page px-3 py-3 text-center text-[12px] text-ink-muted">
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
          <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">
            Reason {isBlocked ? "(optional)" : "(optional, shown to you only)"}
          </span>
          <input
            value={draft.note}
            onChange={(event) => onChange({ ...draft, note: event.target.value })}
            placeholder={isBlocked ? "Vacation, holiday, sick day…" : "Extended summer hours…"}
            className="mt-1.5 h-10 w-full rounded-lg border border-line-soft bg-surface-card px-3 text-[13px] outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
          />
        </label>
      </div>

      <div className="mt-5 flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange px-4 text-[13px] font-bold text-white shadow-sm hover:brightness-105 disabled:opacity-60"
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
          className="inline-flex h-10 items-center rounded-xl border border-line-soft bg-surface-card px-4 text-[13px] font-bold text-ink-strong hover:bg-surface-page disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TimePartsInput({
  value,
  ariaLabel,
  compact = false,
  onCommit,
}: {
  value: number;
  ariaLabel: string;
  compact?: boolean;
  onCommit: (next: number) => boolean;
}) {
  const listIdBase = useId().replace(/:/g, "");
  const hourListId = `${listIdBase}-hours`;
  const minuteListId = `${listIdBase}-minutes`;
  const [hourText, setHourText] = useState(() => timeParts(value).hour);
  const [minuteText, setMinuteText] = useState(() => timeParts(value).minute);

  function reset(nextValue = value) {
    const parts = timeParts(nextValue);
    setHourText(parts.hour);
    setMinuteText(parts.minute);
  }

  function commit() {
    const next = parseTimeParts(hourText, minuteText);
    if (next === null) {
      toast.error("Enter a valid time");
      reset();
      return;
    }
    if (onCommit(next)) {
      reset(next);
      return;
    }
    reset();
  }

  function handleBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    ) {
      return;
    }
    commit();
  }

  function cleanPart(value: string) {
    return value.replace(/\D/g, "").slice(0, 2);
  }

  const wrapperClass = compact
    ? "inline-flex h-7 items-center gap-1 rounded-md border border-line-soft bg-surface-card px-1"
    : "inline-flex h-9 items-center gap-1.5 rounded-md border border-line-soft bg-surface-card px-1.5";
  const inputClass = compact
    ? "h-5 w-[28px] rounded border border-transparent bg-surface-page px-0.5 text-center text-[11px] font-bold tabular-nums outline-none focus:border-brand focus:bg-surface-card"
    : "h-7 w-[36px] rounded border border-transparent bg-surface-page px-1 text-center text-[12px] font-semibold tabular-nums outline-none focus:border-brand focus:bg-surface-card";
  const unitClass = compact
    ? "text-[10px] font-bold text-ink-muted"
    : "text-[11px] font-bold text-ink-muted";

  return (
    <div className={wrapperClass} onBlur={handleBlur}>
      <input
        aria-label={`${ariaLabel} hour`}
        inputMode="numeric"
        list={hourListId}
        maxLength={2}
        onChange={(event) => setHourText(cleanPart(event.target.value))}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            reset();
          }
        }}
        placeholder="HH"
        value={hourText}
        className={inputClass}
      />
      <span className={unitClass}>h</span>
      <input
        aria-label={`${ariaLabel} minute`}
        inputMode="numeric"
        list={minuteListId}
        maxLength={2}
        onChange={(event) => setMinuteText(cleanPart(event.target.value))}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            reset();
          }
        }}
        placeholder="MM"
        value={minuteText}
        className={inputClass}
      />
      <span className={unitClass}>m</span>
      <datalist id={hourListId}>
        {HOUR_OPTIONS.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
      <datalist id={minuteListId}>
        {MINUTE_OPTIONS.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
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
  // Validate the split hour/minute controls against the surrounding range.
  function commitStart(next: number) {
    if (next >= block.end) {
      toast.error("Start must be before end");
      return false;
    }
    onChange({ start: next, end: block.end });
    return true;
  }

  function commitEnd(next: number) {
    if (next <= block.start) {
      toast.error("End must be after start");
      return false;
    }
    onChange({ start: block.start, end: next });
    return true;
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-line-cream bg-surface-page px-2.5 py-2">
      <TimePartsInput
        key={`start-${block.start}`}
        value={block.start}
        ariaLabel="Start time"
        onCommit={commitStart}
      />
      <span className="text-ink-muted">—</span>
      <TimePartsInput
        key={`end-${block.end}`}
        value={block.end}
        ariaLabel="End time"
        onCommit={commitEnd}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove time block"
        className="ml-auto rounded-md p-1.5 text-ink-muted hover:bg-surface-card hover:text-danger"
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
    <div className="flex items-center gap-3 rounded-lg border border-line-cream bg-surface-page p-2.5">
      <span className="w-12 text-[11px] font-bold tabular-nums text-purple">
        {timeLabel}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[12px] font-bold">{booking.guestName}</p>
        <p className="text-[10px] text-ink-soft">
          {booking.eventType.title} · {booking.eventType.durationMinutes} min
        </p>
      </div>
      <span className="rounded-full bg-success-mint px-1.5 py-0.5 text-[9px] font-bold text-success">
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
      <span className="inline-flex h-9 items-center rounded-[10px] border border-dashed border-line-cream bg-surface-card px-3 text-[12px] font-bold text-ink-muted">
        No services yet
      </span>
    );
  }

  // Visible services come from the host's active list. Inactive services are
  // dropped to keep the toolbar focused on what the host is actually selling.
  const visibleServices = eventTypes.filter((service) => service.isActive);

  return (
    <div className="inline-flex max-w-full overflow-x-auto rounded-[10px] border border-line-soft bg-surface-page p-[3px] gap-[2px]">
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
          ? "bg-surface-card text-ink-strong shadow-[0_1px_2px_rgba(17,24,39,0.08)]"
          : "text-ink-soft hover:text-ink-strong",
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
          ? "bg-surface-card text-ink-strong shadow-[0_1px_2px_rgba(17,24,39,0.08)]"
          : "text-ink-soft hover:text-ink-strong",
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
          ? "text-brand border-brand"
          : "text-ink-muted border-transparent hover:text-ink-strong",
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
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-cream bg-surface-page p-3.5">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-ink-strong">
              {serviceTitle}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-soft">
              {serviceMode === "HOST_DEFAULT"
                ? "Inherits your default weekly hours."
                : "Uses custom weekly hours for this service."}
            </p>
          </div>
          <div className="inline-flex rounded-[10px] border border-line-soft bg-surface-card p-[3px] gap-[2px]">
            <button
              type="button"
              onClick={() => onServiceModeChange("HOST_DEFAULT")}
              className={[
                "whitespace-nowrap rounded-md px-3 py-1.5 text-[12px] font-bold transition",
                serviceMode === "HOST_DEFAULT"
                  ? "bg-surface-page text-ink-strong shadow-[0_1px_2px_rgba(17,24,39,0.08)]"
                  : "text-ink-soft hover:text-ink-strong",
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
                  ? "bg-surface-page text-ink-strong shadow-[0_1px_2px_rgba(17,24,39,0.08)]"
                  : "text-ink-soft hover:text-ink-strong",
              ].join(" ")}
            >
              Custom hours
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[12px] text-ink-soft">
          Used as the starting point for every new date. Changes don&apos;t affect
          dates you&apos;ve already edited.
        </p>
      )}
      <div className="mt-4 divide-y divide-line-cream rounded-xl border border-line-cream">
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
      <div className="mt-3 flex items-center justify-between text-[11px] text-ink-muted">
        <span>
          <span className="font-bold tabular-nums text-ink-strong">
            {weekTotal.toFixed(1).replace(/\.0$/, "")}
          </span>{" "}
          hours bookable per week
        </span>
        <button
          type="button"
          onClick={onCopyMonday}
          className="inline-flex items-center gap-1 text-[12px] font-bold text-ink-strong hover:underline"
        >
          <Copy className="size-3 text-ink-muted" /> Copy Monday to all weekdays
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
          className={`text-[13px] font-bold ${day.enabled ? "text-ink-strong" : "text-ink-muted"}`}
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
              className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-brand-tint-300 bg-brand-tint-50 px-2 text-[11px] font-bold text-brand hover:bg-brand-tint-100"
            >
              <Plus className="size-3" /> Add range
            </button>
          </>
        ) : (
          <span className="text-[12px] italic text-ink-muted">Day off</span>
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
  function commitStart(next: number) {
    if (next >= block.end) {
      toast.error("Start must be before end");
      return false;
    }
    onChange({ start: next, end: block.end });
    return true;
  }

  function commitEnd(next: number) {
    if (next <= block.start) {
      toast.error("End must be after start");
      return false;
    }
    onChange({ start: block.start, end: next });
    return true;
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-line-cream bg-surface-page px-2 py-1">
      <TimePartsInput
        key={`start-${block.start}`}
        value={block.start}
        ariaLabel="Start time"
        compact
        onCommit={commitStart}
      />
      <span className="text-ink-muted">–</span>
      <TimePartsInput
        key={`end-${block.end}`}
        value={block.end}
        ariaLabel="End time"
        compact
        onCommit={commitEnd}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove range"
        className="rounded-md p-1 text-ink-muted hover:text-danger"
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
        on ? "bg-gradient-to-r from-brand-coral to-brand-orange" : "bg-line-soft"
      }`}
    >
      <span
        className={`absolute top-[2px] ${knob} rounded-full bg-surface-card shadow-sm transition-all ${
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
  // null = host-wide (applies to every service). Otherwise the EventType.id.
  eventTypeId?: string | null;
};

function emptyExceptionDraft(eventTypeId: string | null = null): ExceptionDraft {
  return {
    startDate: dateKey(new Date()),
    endDate: "",
    type: "BLOCKED",
    note: "",
    blocks: [{ start: 9 * 60, end: 17 * 60 }],
    eventTypeId,
  };
}

function ExceptionsTab({
  groups,
  editor,
  scopeLabel,
  onStartAdd,
  onCancel,
  onSave,
  onChange,
  onDelete,
}: {
  groups: ExceptionGroup[];
  editor: ExceptionDraft | null;
  scopeLabel: string;
  onStartAdd: () => void;
  onCancel: () => void;
  onSave: (draft: ExceptionDraft) => void;
  onChange: (next: ExceptionDraft) => void;
  onDelete: (group: ExceptionGroup) => void;
}) {
  return (
    <div className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[12px] text-ink-soft">
          Block off vacations or open extra days {scopeLabel}.
        </p>
        {!editor ? (
          <button
            type="button"
            onClick={onStartAdd}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-soft bg-surface-card px-2.5 text-[12px] font-bold text-ink-strong hover:bg-surface-page"
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
          <p className="rounded-xl border border-dashed border-line-cream bg-surface-page px-4 py-6 text-center text-[12px] text-ink-muted">
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
    <div className="mt-3 rounded-xl border border-line-cream bg-surface-page p-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
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
            className="mt-1.5 h-9 w-full rounded-lg border border-line-soft bg-surface-card px-2 text-[13px] outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
          >
            <option value="BLOCKED">Blocked (vacation, holiday)</option>
            <option value="CUSTOM_HOURS">Extra opening / custom hours</option>
          </select>
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
            Start date
          </span>
          <input
            type="date"
            value={draft.startDate}
            min={dateKey(new Date())}
            onChange={(e) => onChange({ ...draft, startDate: e.target.value })}
            className="mt-1.5 h-9 w-full rounded-lg border border-line-soft bg-surface-card px-2 text-[13px] outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
            End date (optional)
          </span>
          <input
            type="date"
            value={draft.endDate}
            min={draft.startDate || dateKey(new Date())}
            onChange={(e) => onChange({ ...draft, endDate: e.target.value })}
            className="mt-1.5 h-9 w-full rounded-lg border border-line-soft bg-surface-card px-2 text-[13px] outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
          />
        </label>
      </div>

      <label className="mt-3 block">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Note (optional)
        </span>
        <input
          type="text"
          value={draft.note}
          maxLength={120}
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
          placeholder={isBlocked ? "e.g. Annual leave" : "e.g. Pop-up market"}
          className="mt-1.5 h-9 w-full rounded-lg border border-line-soft bg-surface-card px-2 text-[13px] outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
        />
      </label>

      {!isBlocked ? (
        <div className="mt-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
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
            className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-brand-tint-300 bg-brand-tint-50 px-3 text-[12px] font-bold text-brand hover:bg-brand-tint-100"
          >
            <Plus className="size-3.5" /> Add time block
          </button>
        </div>
      ) : null}

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center rounded-lg border border-line-soft bg-surface-card px-3 text-[12px] font-bold text-ink-strong hover:bg-surface-soft"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className="inline-flex h-9 items-center rounded-lg bg-gradient-to-r from-brand-coral to-brand-orange px-4 text-[12px] font-bold text-white shadow-sm hover:brightness-105"
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
      <div className="flex items-center gap-3 rounded-xl border border-danger-border bg-danger-tint px-4 py-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-card px-2 py-0.5 text-[10px] font-bold text-danger">
          <span className="size-1.5 rounded-full bg-danger-strong" /> Blocked
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold tabular-nums">
            {formatRangeLabel(group.start, group.end)}
          </p>
          {group.note ? (
            <p className="text-[11px] text-ink-soft">{group.note}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Remove exception"
          className="rounded-md p-1.5 text-ink-muted hover:bg-surface-card hover:text-danger"
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
    <div className="flex items-center gap-3 rounded-xl border border-success-border bg-success-tint px-4 py-3">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-card px-2 py-0.5 text-[10px] font-bold text-success-deep">
        <span className="size-1.5 rounded-full bg-success-bright" /> Extra opening
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-bold tabular-nums">
          {formatRangeLabel(group.start, group.end)}
          {blocksLabel ? ` · ${blocksLabel}` : ""}
        </p>
        {group.note ? (
          <p className="text-[11px] text-ink-soft">{group.note}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Remove exception"
        className="rounded-md p-1.5 text-ink-muted hover:bg-surface-card hover:text-danger"
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
      <p className="text-[12px] text-ink-soft">
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
      <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-line-cream bg-surface-page p-3.5">
        <div className="min-w-0">
          <p className="text-[13px] font-bold">
            Show buffer time on the public page
          </p>
          <p className="mt-0.5 text-[11px] text-ink-soft">
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
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 h-10 w-full rounded-lg border border-line-soft bg-surface-card px-3 text-[13px] outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-[11px] text-ink-muted">{hint}</p>
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
