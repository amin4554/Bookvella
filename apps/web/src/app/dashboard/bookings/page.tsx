"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  CalendarCheck2,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Filter,
  List,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  QrCode,
  Repeat,
  Search,
  Share2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import {
  authedApiRequest,
  downloadAuthedFile,
  apiRequest,
  type AvailableSlot,
  type HostBooking,
  type PublicUser,
} from "@/lib/api";

type Tab = "upcoming" | "past" | "cancelled";
type ViewMode = "list" | "calendar";

export default function BookingsPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const [selected, setSelected] = useState<HostBooking | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<HostBooking | null>(
    null,
  );
  const [tab, setTab] = useState<Tab>("upcoming");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [exporting, setExporting] = useState(false);
  // Service filter: empty set = "All services"; otherwise show only bookings
  // whose service id is in the set.
  const [serviceFilter, setServiceFilter] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const [me, hostBookings] = await Promise.all([
          authedApiRequest<PublicUser>("/auth/me"),
          authedApiRequest<HostBooking[]>("/bookings"),
        ]);
        setUser(me);
        setBookings(hostBookings);
        setLoadedAt(Date.now());
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not load bookings",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const counts = useMemo(() => {
    const now = loadedAt;
    let upcoming = 0;
    let past = 0;
    let cancelled = 0;
    for (const b of bookings) {
      if (b.status === "CANCELLED") {
        cancelled += 1;
        continue;
      }
      const start = new Date(b.startTimeUtc).getTime();
      if (start >= now) upcoming += 1;
      else past += 1;
    }
    return { upcoming, past, cancelled };
  }, [bookings, loadedAt]);

  const filtered = useMemo(() => {
    const now = loadedAt;
    const query = search.toLowerCase().trim();

    return bookings.filter((booking) => {
      if (tab === "cancelled") {
        if (booking.status !== "CANCELLED") return false;
      } else {
        if (booking.status === "CANCELLED") return false;
        const start = new Date(booking.startTimeUtc).getTime();
        if (tab === "upcoming" ? start < now : start >= now) return false;
      }

      if (serviceFilter.size > 0 && !serviceFilter.has(booking.eventTypeId)) {
        return false;
      }

      if (query) {
        const matchesName = booking.guestName.toLowerCase().includes(query);
        const matchesEmail = booking.guestEmail.toLowerCase().includes(query);
        const matchesService = booking.eventType.title
          .toLowerCase()
          .includes(query);
        if (!matchesName && !matchesEmail && !matchesService) return false;
      }

      return true;
    });
  }, [bookings, loadedAt, tab, search, serviceFilter]);

  // Unique services that appear in the booking list, sorted by title.
  const availableServices = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    for (const booking of bookings) {
      const id = booking.eventTypeId;
      if (!map.has(id)) {
        map.set(id, { id, title: booking.eventType.title });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.title.localeCompare(b.title),
    );
  }, [bookings]);

  async function cancelBooking(reason: string) {
    if (!selected) return;
    try {
      const updated = await authedApiRequest<HostBooking>(
        `/bookings/${selected.id}/cancel`,
        { method: "PATCH", body: JSON.stringify({ reason: reason || null }) },
      );
      setBookings((current) =>
        current.map((b) => (b.id === updated.id ? updated : b)),
      );
      setSelected(null);
      toast.success("Booking cancelled");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not cancel booking",
      );
    }
  }

  async function exportBookings() {
    setExporting(true);
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadAuthedFile(
        "/bookings/export.csv",
        `bookvella-bookings-${stamp}.csv`,
      );
      toast.success("Bookings exported");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not export bookings",
      );
    } finally {
      setExporting(false);
    }
  }

  async function downloadBookingIcs(booking: HostBooking) {
    try {
      await downloadAuthedFile(
        `/bookings/${booking.id}.ics`,
        `bookvella-${booking.eventType.slug}-${booking.id}.ics`,
      );
      toast.success("Calendar file downloaded");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Could not download calendar file",
      );
    }
  }

  async function rescheduleBooking(booking: HostBooking, startTimeUtc: string) {
    const updated = await authedApiRequest<HostBooking>(
      `/bookings/${booking.id}/reschedule`,
      {
        method: "PATCH",
        body: JSON.stringify({
          startTimeUtc,
          guestTimezone: booking.guestTimezone,
        }),
      },
    );
    setBookings((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    toast.success("Booking rescheduled");
  }

  const totalBookings = bookings.length;
  const thisMonth = bookings.filter((b) =>
    isThisMonth(b.startTimeUtc, loadedAt),
  ).length;

  return (
    <AppShell
      active="Bookings"
      title="Bookings"
      userInitial={user?.name.charAt(0).toUpperCase() ?? "B"}
      bookingCount={counts.upcoming}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="text-[36px] font-extrabold md:text-[42px]"
            style={{ letterSpacing: "-0.03em", lineHeight: "1.02" }}
          >
            Bookings
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            All appointments across your services.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportBookings}
            disabled={exporting || bookings.length === 0}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-soft bg-surface-card px-4 text-[13px] font-bold text-ink-strong hover:bg-surface-soft disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}{" "}
            {exporting ? "Exporting..." : "Export"}
          </button>
          <button
            type="button"
            onClick={() =>
              setViewMode((current) =>
                current === "calendar" ? "list" : "calendar",
              )
            }
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-soft bg-surface-card px-4 text-[13px] font-bold text-ink-strong hover:bg-surface-soft disabled:opacity-60"
          >
            {viewMode === "calendar" ? (
              <List className="size-4" />
            ) : (
              <Calendar className="size-4" />
            )}
            {viewMode === "calendar" ? "List view" : "Calendar view"}
          </button>
        </div>
      </div>

      {error ? <InlineState title="Bookings unavailable" text={error} /> : null}
      {loading ? (
        <InlineState
          title="Loading bookings"
          text="Fetching your appointments."
        />
      ) : null}

      {!loading && !error ? (
        <>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Total bookings"
              value={String(totalBookings)}
              sub="All-time, all services"
              accent="text-ink-strong"
            />
            <StatTile
              label="This month"
              value={String(thisMonth)}
              sub="Confirmed in the current month"
              accent="text-purple"
            />
            <StatTile
              label="Upcoming"
              value={String(counts.upcoming)}
              sub="Next 7 days"
              accent="text-brand"
            />
            <StatTile
              label="Completed"
              value={String(counts.past)}
              sub="Past appointments"
              accent="text-success"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line-cream bg-surface-card p-2 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
            <div className="flex flex-wrap items-center gap-1.5 p-1">
              <TabButton
                active={tab === "upcoming"}
                count={counts.upcoming}
                onClick={() => setTab("upcoming")}
              >
                Upcoming
              </TabButton>
              <TabButton
                active={tab === "past"}
                count={counts.past}
                onClick={() => setTab("past")}
              >
                Past
              </TabButton>
              <TabButton
                active={tab === "cancelled"}
                count={counts.cancelled}
                onClick={() => setTab("cancelled")}
              >
                Cancelled
              </TabButton>
            </div>
            <div className="flex flex-wrap items-center gap-2 px-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by guest, email, service…"
                  className="h-10 w-[260px] rounded-xl border border-line-soft bg-surface-card pl-9 pr-3 text-[13px] outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
                />
              </div>
              <ServiceFilterDropdown
                services={availableServices}
                selectedIds={serviceFilter}
                onChange={setServiceFilter}
              />
            </div>
          </div>

          {viewMode === "calendar" ? (
            <BookingsCalendarView
              bookings={filtered}
              month={calendarMonth}
              timeZone={user?.timezone ?? "UTC"}
              onMonthChange={setCalendarMonth}
              onOpenBooking={(booking) => {
                setExpanded(booking.id);
                setViewMode("list");
              }}
            />
          ) : filtered.length === 0 ? (
            <EmptyState tab={tab} search={search} user={user} />
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-line-cream bg-surface-card shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
              <div className="flex items-center justify-between border-b border-line-cream px-5 py-3">
                <p className="text-[13px] font-bold">
                  {filtered.length}{" "}
                  {tab === "upcoming"
                    ? "upcoming"
                    : tab === "past"
                      ? "past"
                      : "cancelled"}{" "}
                  appointment{filtered.length === 1 ? "" : "s"}
                </p>
              </div>
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-line-cream bg-surface-page text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
                  <tr>
                    <th className="px-5 py-3">Guest</th>
                    <th className="px-3">Service</th>
                    <th className="px-3">Date &amp; time</th>
                    <th className="px-3">Status</th>
                    <th className="px-3">Location</th>
                    <th className="px-5 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-cream">
                  {filtered.map((booking) => (
                    <BookingRow
                      key={booking.id}
                      booking={booking}
                      timeZone={user?.timezone ?? "UTC"}
                      expanded={expanded === booking.id}
                      onToggle={() =>
                        setExpanded((current) =>
                          current === booking.id ? null : booking.id,
                        )
                      }
                      onCancel={() => setSelected(booking)}
                      onDownloadIcs={() => downloadBookingIcs(booking)}
                      onReschedule={() => setRescheduleTarget(booking)}
                    />
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-line-cream px-5 py-3 text-[11px] text-ink-soft">
                <p>
                  Showing{" "}
                  <span className="font-bold text-ink-strong">
                    1–{filtered.length}
                  </span>{" "}
                  of <span className="font-bold text-ink-strong">{filtered.length}</span>
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled
                    className="rounded-md border border-line-soft bg-surface-card px-2 py-1 text-ink-muted"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled
                    className="rounded-md border border-line-soft bg-surface-card px-2 py-1 text-ink-muted"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}

      {selected ? (
        <CancelModal
          booking={selected}
          timeZone={user?.timezone ?? "UTC"}
          onClose={() => setSelected(null)}
          onConfirm={cancelBooking}
        />
      ) : null}
      {rescheduleTarget && user ? (
        <RescheduleModal
          booking={rescheduleTarget}
          hostSlug={user.slug}
          timeZone={user.timezone}
          onClose={() => setRescheduleTarget(null)}
          onConfirm={async (startTimeUtc) => {
            await rescheduleBooking(rescheduleTarget, startTimeUtc);
            setRescheduleTarget(null);
          }}
        />
      ) : null}
    </AppShell>
  );
}

function ServiceFilterDropdown({
  services,
  selectedIds,
  onChange,
}: {
  services: { id: string; title: string }[];
  selectedIds: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function toggleService(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  const count = selectedIds.size;
  const hasFilter = count > 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        disabled={services.length === 0}
        className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-[12px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
          hasFilter
            ? "border-brand-tint-300 bg-brand-tint-100 text-brand hover:bg-brand-tint-hover"
            : "border-line-soft bg-surface-card text-ink-strong hover:bg-surface-soft"
        }`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Filter className="size-4" />
        Filters
        {hasFilter ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-20 w-[280px] rounded-xl border border-line-cream bg-surface-card p-2 shadow-[0_24px_48px_-20px_rgba(17,24,39,0.16)]"
        >
          <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-ink-muted">
              Services
            </p>
            {hasFilter ? (
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="text-[11px] font-bold text-brand hover:underline"
              >
                Clear all
              </button>
            ) : null}
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {services.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12px] text-ink-muted">
                No services found in your bookings.
              </p>
            ) : (
              services.map((service) => {
                const checked = selectedIds.has(service.id);
                return (
                  <button
                    key={service.id}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={checked}
                    onClick={() => toggleService(service.id)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-ink-strong hover:bg-surface-page"
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${
                        checked
                          ? "border-brand bg-brand text-white"
                          : "border-line-strong bg-surface-card"
                      }`}
                    >
                      {checked ? <Check className="size-3" /> : null}
                    </span>
                    <span className="truncate">{service.title}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-line-cream bg-surface-card p-5 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </p>
      <p className={`mt-3 text-[28px] font-bold tabular-nums ${accent}`}>
        {value}
      </p>
      <p className="text-[11px] text-ink-soft">{sub}</p>
    </div>
  );
}

function TabButton({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "inline-flex h-10 items-center gap-2 rounded-xl bg-ink-strong px-3.5 text-[13px] font-bold text-surface-card"
          : "inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-[13px] font-bold text-ink-soft hover:text-ink-strong"
      }
    >
      {children}
      <span
        className={
          active
            ? "rounded-full bg-surface-card/20 px-1.5 py-0.5 text-[10px] tabular-nums"
            : "rounded-full bg-line-subtle px-1.5 py-0.5 text-[10px] tabular-nums text-ink-soft"
        }
      >
        {count}
      </span>
    </button>
  );
}

function BookingsCalendarView({
  bookings,
  month,
  timeZone,
  onMonthChange,
  onOpenBooking,
}: {
  bookings: HostBooking[];
  month: Date;
  timeZone: string;
  onMonthChange: (next: Date) => void;
  onOpenBooking: (booking: HostBooking) => void;
}) {
  const days = useMemo(() => calendarGridDays(month), [month]);
  const bookingsByDay = useMemo(() => {
    const map = new Map<string, HostBooking[]>();
    for (const booking of bookings) {
      const key = dateKeyInTimeZone(booking.startTimeUtc, timeZone);
      const list = map.get(key) ?? [];
      list.push(booking);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.startTimeUtc).getTime() -
          new Date(b.startTimeUtc).getTime(),
      );
    }
    return map;
  }, [bookings, timeZone]);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-line-cream bg-surface-card shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-cream px-5 py-4">
        <div>
          <p className="text-[13px] font-bold">Calendar view</p>
          <p className="text-[11px] text-ink-soft">
            {bookings.length} booking{bookings.length === 1 ? "" : "s"} in the
            current filters
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(month, -1))}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-line-soft bg-surface-card text-ink-soft hover:bg-surface-soft"
            aria-label="Previous month"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(new Date())}
            className="inline-flex h-9 items-center rounded-lg border border-line-soft bg-surface-card px-3 text-[12px] font-bold text-ink-strong hover:bg-surface-soft"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(month, 1))}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-line-soft bg-surface-card text-ink-soft hover:bg-surface-soft"
            aria-label="Next month"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="border-b border-line-cream bg-surface-page px-5 py-4">
        <h2 className="text-xl font-bold">{monthLabel(month)}</h2>
      </div>

      <div className="grid grid-cols-7 border-b border-line-cream bg-surface-soft text-center text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-7">
        {days.map((day) => {
          const key = dateKey(day);
          const dayBookings = bookingsByDay.get(key) ?? [];
          const muted = day.getMonth() !== month.getMonth();
          return (
            <div
              key={key}
              className={`min-h-[132px] border-b border-r border-line-cream p-2.5 ${
                muted ? "bg-surface-soft text-ink-muted" : "bg-surface-card"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold tabular-nums">
                  {day.getDate()}
                </span>
                {dayBookings.length > 0 ? (
                  <span className="rounded-full bg-brand-tint-100 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                    {dayBookings.length}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 space-y-1.5">
                {dayBookings.slice(0, 3).map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => onOpenBooking(booking)}
                    className={`w-full rounded-lg border px-2 py-1.5 text-left text-[11px] leading-tight ${
                      booking.status === "CANCELLED"
                        ? "border-line-soft bg-line-subtle text-ink-soft"
                        : "border-brand-tint-400 bg-brand-tint-50 text-ink-strong hover:bg-brand-tint-100"
                    }`}
                  >
                    <span className="block font-bold tabular-nums">
                      {formatTime(booking.startTimeUtc, timeZone)}
                    </span>
                    <span className="block truncate text-ink-soft">
                      {booking.guestName}
                    </span>
                  </button>
                ))}
                {dayBookings.length > 3 ? (
                  <p className="px-1 text-[10px] font-bold text-ink-muted">
                    +{dayBookings.length - 3} more
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {bookings.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-ink-soft">
          No bookings match the current filters.
        </div>
      ) : null}
    </div>
  );
}

function BookingRow({
  booking,
  timeZone,
  expanded,
  onToggle,
  onCancel,
  onDownloadIcs,
  onReschedule,
}: {
  booking: HostBooking;
  timeZone: string;
  expanded: boolean;
  onToggle: () => void;
  onCancel: () => void;
  onDownloadIcs: () => void;
  onReschedule: () => void;
}) {
  const cancelled = booking.status === "CANCELLED";
  const location =
    booking.eventType.locationDetails ??
    formatLocation(booking.eventType.locationType);

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-surface-page"
        onClick={onToggle}
      >
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-3">
            <Avatar name={booking.guestName} />
            <div className="leading-tight">
              <p className="font-bold">{booking.guestName}</p>
              <p className="text-[11px] text-ink-muted">{booking.guestEmail}</p>
            </div>
          </div>
        </td>
        <td className="px-3">
          <span
            className={
              cancelled
                ? "inline-flex rounded-full bg-line-subtle px-2.5 py-1 text-[11px] font-bold text-ink-muted"
                : "inline-flex rounded-full bg-brand-tint-100 px-2.5 py-1 text-[11px] font-bold text-brand"
            }
          >
            {booking.eventType.title}
          </span>
        </td>
        <td className="px-3 tabular-nums">
          <p className="font-semibold">
            {formatDateTime(booking.startTimeUtc, timeZone)}
          </p>
          <p className="text-[11px] text-ink-muted">
            {booking.eventType.durationMinutes} min
          </p>
        </td>
        <td className="px-3">
          {cancelled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-tint-strong px-2.5 py-1 text-[11px] font-bold text-danger">
              <span className="size-1.5 rounded-full bg-danger-strong" /> Cancelled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-mint px-2.5 py-1 text-[11px] font-bold text-success">
              <span className="size-1.5 rounded-full bg-success" /> Confirmed
            </span>
          )}
        </td>
        <td className="px-3 text-[12px] text-ink-body">
          {location.split("·")[0].trim()}
        </td>
        <td className="px-5 text-right">
          {!cancelled ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onCancel();
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-danger-border bg-surface-card px-3 py-1.5 text-[12px] font-bold text-danger hover:bg-danger-tint"
            >
              Cancel
            </button>
          ) : null}
        </td>
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={6} className="bg-surface-page px-5 py-5">
            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailBlock label="Guest">
                  <p className="text-[13px] font-bold">{booking.guestName}</p>
                  <p className="text-[12px] text-ink-soft">
                    {booking.guestEmail}
                  </p>
                  {booking.guestPhone ? (
                    <p className="text-[12px] text-ink-soft tabular-nums">
                      {booking.guestPhone}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-ink-muted">
                    Guest timezone:{" "}
                    <span className="font-semibold text-ink-strong">
                      {booking.guestTimezone}
                    </span>
                  </p>
                </DetailBlock>
                <DetailBlock label="Appointment">
                  <p className="text-[13px] font-bold">
                    {booking.eventType.title}
                  </p>
                  <p className="text-[12px] text-ink-soft tabular-nums">
                    {formatDateTime(booking.startTimeUtc, timeZone)} ·{" "}
                    {booking.eventType.durationMinutes} min
                  </p>
                  <p className="text-[12px] text-ink-soft">{location}</p>
                </DetailBlock>
                {booking.guestNote ? (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                      Guest note
                    </p>
                    <p className="mt-1 rounded-xl border border-line-cream bg-surface-card p-3 text-[13px] leading-[1.6] text-ink-body">
                      {booking.guestNote}
                    </p>
                  </div>
                ) : null}
                {booking.cancellationReason ? (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                      Cancellation reason
                    </p>
                    <p className="mt-1 rounded-xl border border-line-cream bg-surface-card p-3 text-[13px] leading-[1.6] text-ink-body">
                      {booking.cancellationReason}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-2">
                <ActionButton
                  icon={Copy}
                  label="Copy guest email"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(booking.guestEmail);
                      toast.success("Email copied");
                    } catch {
                      // ignored
                    }
                  }}
                />
                <a
                  href={`mailto:${booking.guestEmail}`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line-soft bg-surface-card px-4 text-[13px] font-bold text-ink-strong hover:bg-surface-soft"
                >
                  <Mail className="size-4" /> Email guest
                </a>
                <ActionButton
                  icon={CalendarPlus}
                  label="Add to my calendar"
                  onClick={onDownloadIcs}
                />
                <ActionButton
                  icon={Repeat}
                  label="Reschedule"
                  disabled={cancelled}
                  onClick={onReschedule}
                />
                {!cancelled ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-danger-strong px-4 text-[13px] font-bold text-white hover:bg-danger"
                  >
                    <X className="size-4" /> Cancel booking
                  </button>
                ) : null}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function DetailBlock({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </p>
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-line-soft bg-surface-card px-4 text-[13px] font-bold text-ink-strong hover:bg-surface-soft disabled:opacity-70"
    >
      <Icon className="size-4" /> {label}
      {hint ? (
        <span className="rounded-full bg-line-subtle px-1.5 text-[10px] text-ink-soft">
          {hint}
        </span>
      ) : null}
    </button>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name?.[0]?.toUpperCase() ?? "?";
  const palettes = [
    "from-purple to-purple-strong",
    "from-success-bright to-success-teal",
    "from-orange-500 to-orange-600",
    "from-pink-500 to-purple",
    "from-info-bright to-info-cyan",
  ];
  const palette = palettes[(initial.charCodeAt(0) || 0) % palettes.length];
  return (
    <div
      className={`flex size-9 items-center justify-center rounded-xl bg-gradient-to-br ${palette} text-[12px] font-bold text-white`}
    >
      {initial}
    </div>
  );
}

function CancelModal({
  booking,
  timeZone,
  onClose,
  onConfirm,
}: {
  booking: HostBooking;
  timeZone: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-strong/45 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[460px] rounded-2xl bg-surface-card shadow-[0_24px_48px_-20px_rgba(17,24,39,0.30)]">
        <div className="flex items-start gap-4 p-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-danger-tint-strong text-danger">
            <X className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold">Cancel this booking?</h3>
            <p className="mt-1 text-[13px] text-ink-soft">
              The guest will be notified by email. Cancellations can&apos;t be
              undone — the slot reopens for someone else.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-md p-1.5 text-ink-muted hover:bg-surface-soft"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mx-6 mb-4 rounded-xl border border-line-cream bg-surface-page p-4">
          <p className="text-sm font-bold">{booking.eventType.title}</p>
          <p className="mt-0.5 text-xs text-ink-soft tabular-nums">
            {booking.guestName} ·{" "}
            {formatDateTime(booking.startTimeUtc, timeZone)} ·{" "}
            {booking.eventType.durationMinutes} min
          </p>
        </div>

        <div className="px-6 pb-2">
          <label className="block">
            <span className="text-xs font-bold text-ink-body">
              Reason{" "}
              <span className="font-normal text-ink-muted">
                (optional, only you see this)
              </span>
            </span>
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Sick day, double-booking, guest requested change…"
              className="mt-1.5 w-full rounded-xl border border-line-soft bg-surface-card p-3 text-[13px] outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line-cream p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-line-soft bg-surface-card px-4 text-[13px] font-bold text-ink-strong hover:bg-surface-soft"
          >
            Keep booking
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason);
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-danger-strong px-4 text-[13px] font-bold text-white hover:bg-danger disabled:opacity-60"
          >
            <X className="size-4" /> {busy ? "Cancelling..." : "Yes, cancel it"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RescheduleModal({
  booking,
  hostSlug,
  timeZone,
  onClose,
  onConfirm,
}: {
  booking: HostBooking;
  hostSlug: string;
  timeZone: string;
  onClose: () => void;
  onConfirm: (startTimeUtc: string) => Promise<void>;
}) {
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const start = new Date();
    const end = new Date(start.getTime() + 21 * 24 * 60 * 60 * 1000);
    apiRequest<AvailableSlot[]>(
      `/public/${hostSlug}/${booking.eventType.slug}/slots?start=${encodeURIComponent(
        start.toISOString(),
      )}&end=${encodeURIComponent(end.toISOString())}&timezone=${encodeURIComponent(
        booking.guestTimezone,
      )}`,
    )
      .then((items) => {
        if (!alive) return;
        const next = items.filter(
          (slot) => slot.startTimeUtc !== booking.startTimeUtc,
        );
        setSlots(next);
        setSelectedSlot(next[0]?.startTimeUtc ?? "");
      })
      .catch((caught) => {
        if (!alive) return;
        setError(
          caught instanceof Error ? caught.message : "Could not load slots",
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [booking, hostSlug]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-strong/45 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[500px] rounded-2xl bg-surface-card shadow-[0_24px_48px_-20px_rgba(17,24,39,0.30)]">
        <div className="flex items-start gap-4 p-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint-100 text-brand">
            <Repeat className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold">Reschedule booking</h3>
            <p className="mt-1 text-[13px] text-ink-soft">
              Choose a new available slot. The guest will receive an updated
              confirmation email and calendar file.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-md p-1.5 text-ink-muted hover:bg-surface-soft"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mx-6 rounded-xl border border-line-cream bg-surface-page p-4">
          <p className="text-sm font-bold">{booking.eventType.title}</p>
          <p className="mt-0.5 text-xs text-ink-soft tabular-nums">
            {booking.guestName} - {formatDateTime(booking.startTimeUtc, timeZone)}
          </p>
        </div>

        <div className="px-6 py-5">
          <label className="block">
            <span className="text-xs font-bold text-ink-body">
              New time
            </span>
            <select
              value={selectedSlot}
              onChange={(event) => setSelectedSlot(event.target.value)}
              disabled={loading || busy || slots.length === 0}
              className="mt-1.5 h-12 w-full rounded-xl border border-line-soft bg-surface-card px-3 text-[13px] outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)] disabled:bg-surface-soft disabled:text-ink-muted"
            >
              {loading ? (
                <option>Loading available times...</option>
              ) : slots.length === 0 ? (
                <option>No alternate slots available</option>
              ) : (
                slots.map((slot) => (
                  <option key={slot.startTimeUtc} value={slot.startTimeUtc}>
                    {new Intl.DateTimeFormat("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: booking.guestTimezone,
                    }).format(new Date(slot.startTimeUtc))}
                  </option>
                ))
              )}
            </select>
          </label>
          {error ? (
            <p className="mt-3 rounded-xl border border-danger-border bg-danger-tint px-3 py-2 text-[12px] text-danger">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line-cream p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-line-soft bg-surface-card px-4 text-[13px] font-bold text-ink-strong hover:bg-surface-soft"
          >
            Keep current time
          </button>
          <button
            type="button"
            disabled={!selectedSlot || busy || loading}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(selectedSlot);
              } catch (caught) {
                setError(
                  caught instanceof Error
                    ? caught.message
                    : "Could not reschedule booking",
                );
              } finally {
                setBusy(false);
              }
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange px-4 text-[13px] font-bold text-white hover:brightness-105 disabled:opacity-60"
          >
            <Repeat className="size-4" />{" "}
            {busy ? "Rescheduling..." : "Reschedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  tab,
  search,
  user,
}: {
  tab: Tab;
  search: string;
  user: PublicUser | null;
}) {
  if (search) {
    return (
      <div className="mt-4 rounded-2xl border border-line-cream bg-surface-card px-6 py-12 text-center text-sm text-ink-soft shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
        No bookings match &ldquo;{search}&rdquo;.
      </div>
    );
  }

  if (tab !== "upcoming") {
    return (
      <div className="mt-4 rounded-2xl border border-line-cream bg-surface-card px-6 py-12 text-center text-sm text-ink-soft shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
        No {tab} bookings yet.
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-line-cream bg-surface-card shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <div className="relative">
          <div className="absolute inset-0 -m-3 rounded-[26px] bg-brand-tint-100" />
          <div className="relative flex size-20 items-center justify-center rounded-[20px] border border-brand-tint-400 bg-surface-card text-brand shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
            <CalendarCheck2 className="size-9" />
          </div>
        </div>
        <h3 className="mt-7 text-[22px] font-bold">No bookings yet</h3>
        <p className="mt-2 max-w-[420px] text-sm leading-[1.6] text-ink-soft">
          Once guests start booking you, their appointments will appear here.
          Share your link to get your first booking.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={async () => {
              if (!user) return;
              const link = `https://bookvella.com/${user.slug}`;
              try {
                await navigator.clipboard.writeText(link);
                toast.success("Booking link copied");
              } catch {
                // ignored
              }
            }}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange px-5 text-[13px] font-bold text-white shadow-sm hover:brightness-105"
          >
            <Copy className="size-4" /> Copy booking link
          </button>
          <Link
            href="/dashboard/services"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-soft bg-surface-card px-5 text-[13px] font-bold text-ink-strong hover:bg-surface-soft"
          >
            <Plus className="size-4" /> Manage services
          </Link>
        </div>

        <div className="mt-10 grid w-full max-w-[720px] gap-3 text-left sm:grid-cols-3">
          <TipCard
            icon={Share2}
            iconColor="text-brand"
            iconBorder="border-brand-tint-400"
            title="Share on Instagram"
            text="Add your link to your bio so DMs become bookings."
          />
          <TipCard
            icon={MessageCircle}
            iconColor="text-purple"
            iconBorder="border-purple-border"
            title="Drop it in WhatsApp"
            text="Send it to existing clients next time they ask for a slot."
          />
          <TipCard
            icon={QrCode}
            iconColor="text-success-teal"
            iconBorder="border-info-sky-soft"
            title="Print a QR card"
            text="Hand one to walk-ins so they can book from the chair."
          />
        </div>
      </div>
    </div>
  );
}

function TipCard({
  icon: Icon,
  iconColor,
  iconBorder,
  title,
  text,
}: {
  icon: React.ElementType;
  iconColor: string;
  iconBorder: string;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-line-cream bg-surface-page p-4">
      <span
        className={`flex size-9 items-center justify-center rounded-xl bg-surface-card ${iconColor} border ${iconBorder}`}
      >
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-[13px] font-bold">{title}</p>
      <p className="mt-1 text-[11px] leading-[1.5] text-ink-soft">{text}</p>
    </div>
  );
}

function InlineState({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-6 rounded-xl border border-line-cream bg-surface-card p-6 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-ink-soft">{text}</p>
    </div>
  );
}

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

function monthLabel(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(value);
}

function addMonths(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

function calendarGridDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function dateKey(value: Date) {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function dateKeyInTimeZone(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).formatToParts(new Date(value));
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function formatLocation(locationType: string) {
  if (locationType === "PHONE") return "Phone call";
  if (locationType === "IN_PERSON") return "In person";
  return "Video call";
}

function isThisMonth(value: string, referenceMs: number) {
  const d = new Date(value);
  const ref = new Date(referenceMs);
  return d.getMonth() === ref.getMonth() && d.getFullYear() === ref.getFullYear();
}
