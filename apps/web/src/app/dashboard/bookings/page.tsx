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
  type HostBooking,
  type PublicUser,
} from "@/lib/api";

type Tab = "upcoming" | "past" | "cancelled";

export default function BookingsPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const [selected, setSelected] = useState<HostBooking | null>(null);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
          <p className="mt-2 text-sm text-[#6B7280]">
            All appointments across your services.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:opacity-60"
          >
            <Download className="size-4" /> Export
          </button>
          <button
            type="button"
            disabled
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:opacity-60"
          >
            <Calendar className="size-4" /> Calendar view
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
              accent="text-[#0B1220]"
            />
            <StatTile
              label="This month"
              value={String(thisMonth)}
              sub="Confirmed in the current month"
              accent="text-[#A855F7]"
            />
            <StatTile
              label="Upcoming"
              value={String(counts.upcoming)}
              sub="Next 7 days"
              accent="text-[#FF5F63]"
            />
            <StatTile
              label="Completed"
              value={String(counts.past)}
              sub="Past appointments"
              accent="text-[#16A34A]"
            />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEE7DF] bg-white p-2 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
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
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by guest, email, service…"
                  className="h-10 w-[260px] rounded-xl border border-[#E5E7EB] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
                />
              </div>
              <ServiceFilterDropdown
                services={availableServices}
                selectedIds={serviceFilter}
                onChange={setServiceFilter}
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState tab={tab} search={search} user={user} />
          ) : (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[#EEE7DF] bg-white shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
              <div className="flex items-center justify-between border-b border-[#EEE7DF] px-5 py-3">
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
                <thead className="border-b border-[#EEE7DF] bg-[#FFFBF7] text-[10px] font-bold uppercase tracking-[0.14em] text-[#9CA3AF]">
                  <tr>
                    <th className="px-5 py-3">Guest</th>
                    <th className="px-3">Service</th>
                    <th className="px-3">Date &amp; time</th>
                    <th className="px-3">Status</th>
                    <th className="px-3">Location</th>
                    <th className="px-5 text-right" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEE7DF]">
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
                    />
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between border-t border-[#EEE7DF] px-5 py-3 text-[11px] text-[#6B7280]">
                <p>
                  Showing{" "}
                  <span className="font-bold text-[#0B1220]">
                    1–{filtered.length}
                  </span>{" "}
                  of <span className="font-bold text-[#0B1220]">{filtered.length}</span>
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled
                    className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1 text-[#9CA3AF]"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled
                    className="rounded-md border border-[#E5E7EB] bg-white px-2 py-1 text-[#9CA3AF]"
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
            ? "border-[#FCC9C5] bg-[#FFF0EF] text-[#FF5F63] hover:bg-[#FFE2DF]"
            : "border-[#E5E7EB] bg-white text-[#0B1220] hover:bg-[#F9FAFB]"
        }`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Filter className="size-4" />
        Filters
        {hasFilter ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#FF5F63] px-1.5 text-[10px] font-bold text-white">
            {count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-20 w-[280px] rounded-xl border border-[#EEE7DF] bg-white p-2 shadow-[0_24px_48px_-20px_rgba(17,24,39,0.16)]"
        >
          <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#9CA3AF]">
              Services
            </p>
            {hasFilter ? (
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="text-[11px] font-bold text-[#FF5F63] hover:underline"
              >
                Clear all
              </button>
            ) : null}
          </div>
          <div className="max-h-[320px] overflow-y-auto">
            {services.length === 0 ? (
              <p className="px-3 py-4 text-center text-[12px] text-[#9CA3AF]">
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
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-semibold text-[#0B1220] hover:bg-[#FFFBF7]"
                  >
                    <span
                      className={`flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${
                        checked
                          ? "border-[#FF5F63] bg-[#FF5F63] text-white"
                          : "border-[#D1D5DB] bg-white"
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
    <div className="rounded-2xl border border-[#EEE7DF] bg-white p-5 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
        {label}
      </p>
      <p className={`mt-3 text-[28px] font-bold tabular-nums ${accent}`}>
        {value}
      </p>
      <p className="text-[11px] text-[#6B7280]">{sub}</p>
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
          ? "inline-flex h-10 items-center gap-2 rounded-xl bg-[#0B1220] px-3.5 text-[13px] font-bold text-white"
          : "inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-[13px] font-bold text-[#6B7280] hover:text-[#0B1220]"
      }
    >
      {children}
      <span
        className={
          active
            ? "rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] tabular-nums"
            : "rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] tabular-nums text-[#6B7280]"
        }
      >
        {count}
      </span>
    </button>
  );
}

function BookingRow({
  booking,
  timeZone,
  expanded,
  onToggle,
  onCancel,
}: {
  booking: HostBooking;
  timeZone: string;
  expanded: boolean;
  onToggle: () => void;
  onCancel: () => void;
}) {
  const cancelled = booking.status === "CANCELLED";
  const location =
    booking.eventType.locationDetails ??
    formatLocation(booking.eventType.locationType);

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-[#FFFBF7]"
        onClick={onToggle}
      >
        <td className="px-5 py-3.5">
          <div className="flex items-center gap-3">
            <Avatar name={booking.guestName} />
            <div className="leading-tight">
              <p className="font-bold">{booking.guestName}</p>
              <p className="text-[11px] text-[#9CA3AF]">{booking.guestEmail}</p>
            </div>
          </div>
        </td>
        <td className="px-3">
          <span
            className={
              cancelled
                ? "inline-flex rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px] font-bold text-[#9CA3AF]"
                : "inline-flex rounded-full bg-[#FFF0EF] px-2.5 py-1 text-[11px] font-bold text-[#FF5F63]"
            }
          >
            {booking.eventType.title}
          </span>
        </td>
        <td className="px-3 tabular-nums">
          <p className="font-semibold">
            {formatDateTime(booking.startTimeUtc, timeZone)}
          </p>
          <p className="text-[11px] text-[#9CA3AF]">
            {booking.eventType.durationMinutes} min
          </p>
        </td>
        <td className="px-3">
          {cancelled ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FEE2E2] px-2.5 py-1 text-[11px] font-bold text-[#B91C1C]">
              <span className="size-1.5 rounded-full bg-[#DC2626]" /> Cancelled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EA] px-2.5 py-1 text-[11px] font-bold text-[#16A34A]">
              <span className="size-1.5 rounded-full bg-[#16A34A]" /> Confirmed
            </span>
          )}
        </td>
        <td className="px-3 text-[12px] text-[#374151]">
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
              className="inline-flex items-center gap-1 rounded-lg border border-[#FECACA] bg-white px-3 py-1.5 text-[12px] font-bold text-[#B91C1C] hover:bg-[#FEF2F2]"
            >
              Cancel
            </button>
          ) : null}
        </td>
      </tr>
      {expanded ? (
        <tr>
          <td colSpan={6} className="bg-[#FFFBF7] px-5 py-5">
            <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailBlock label="Guest">
                  <p className="text-[13px] font-bold">{booking.guestName}</p>
                  <p className="text-[12px] text-[#6B7280]">
                    {booking.guestEmail}
                  </p>
                  {booking.guestPhone ? (
                    <p className="text-[12px] text-[#6B7280] tabular-nums">
                      {booking.guestPhone}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-[#9CA3AF]">
                    Guest timezone:{" "}
                    <span className="font-semibold text-[#0B1220]">
                      {booking.guestTimezone}
                    </span>
                  </p>
                </DetailBlock>
                <DetailBlock label="Appointment">
                  <p className="text-[13px] font-bold">
                    {booking.eventType.title}
                  </p>
                  <p className="text-[12px] text-[#6B7280] tabular-nums">
                    {formatDateTime(booking.startTimeUtc, timeZone)} ·{" "}
                    {booking.eventType.durationMinutes} min
                  </p>
                  <p className="text-[12px] text-[#6B7280]">{location}</p>
                </DetailBlock>
                {booking.guestNote ? (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
                      Guest note
                    </p>
                    <p className="mt-1 rounded-xl border border-[#EEE7DF] bg-white p-3 text-[13px] leading-[1.6] text-[#374151]">
                      {booking.guestNote}
                    </p>
                  </div>
                ) : null}
                {booking.cancellationReason ? (
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
                      Cancellation reason
                    </p>
                    <p className="mt-1 rounded-xl border border-[#EEE7DF] bg-white p-3 text-[13px] leading-[1.6] text-[#374151]">
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
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
                >
                  <Mail className="size-4" /> Email guest
                </a>
                <ActionButton
                  icon={CalendarPlus}
                  label="Add to my calendar"
                  disabled
                  hint="Soon"
                />
                <ActionButton
                  icon={Repeat}
                  label="Reschedule"
                  disabled
                  hint="Soon"
                />
                {!cancelled ? (
                  <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#DC2626] px-4 text-[13px] font-bold text-white hover:bg-[#B91C1C]"
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
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
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
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:opacity-70"
    >
      <Icon className="size-4" /> {label}
      {hint ? (
        <span className="rounded-full bg-[#F3F4F6] px-1.5 text-[10px] text-[#6B7280]">
          {hint}
        </span>
      ) : null}
    </button>
  );
}

function Avatar({ name }: { name: string }) {
  const initial = name?.[0]?.toUpperCase() ?? "?";
  const palettes = [
    "from-[#A855F7] to-[#7C4DFF]",
    "from-[#10B981] to-[#0D9488]",
    "from-[#F97316] to-[#EA580C]",
    "from-[#EC4899] to-[#A855F7]",
    "from-[#3B82F6] to-[#0EA5E9]",
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1220]/45 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[460px] rounded-2xl bg-white shadow-[0_24px_48px_-20px_rgba(17,24,39,0.30)]">
        <div className="flex items-start gap-4 p-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#B91C1C]">
            <X className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold">Cancel this booking?</h3>
            <p className="mt-1 text-[13px] text-[#6B7280]">
              The guest will be notified by email. Cancellations can&apos;t be
              undone — the slot reopens for someone else.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto rounded-md p-1.5 text-[#9CA3AF] hover:bg-[#F9FAFB]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mx-6 mb-4 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-4">
          <p className="text-sm font-bold">{booking.eventType.title}</p>
          <p className="mt-0.5 text-xs text-[#6B7280] tabular-nums">
            {booking.guestName} ·{" "}
            {formatDateTime(booking.startTimeUtc, timeZone)} ·{" "}
            {booking.eventType.durationMinutes} min
          </p>
        </div>

        <div className="px-6 pb-2">
          <label className="block">
            <span className="text-xs font-bold text-[#374151]">
              Reason{" "}
              <span className="font-normal text-[#9CA3AF]">
                (optional, only you see this)
              </span>
            </span>
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Sick day, double-booking, guest requested change…"
              className="mt-1.5 w-full rounded-xl border border-[#E5E7EB] bg-white p-3 text-[13px] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#EEE7DF] p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
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
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#DC2626] px-4 text-[13px] font-bold text-white hover:bg-[#B91C1C] disabled:opacity-60"
          >
            <X className="size-4" /> {busy ? "Cancelling..." : "Yes, cancel it"}
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
      <div className="mt-4 rounded-2xl border border-[#EEE7DF] bg-white px-6 py-12 text-center text-sm text-[#6B7280] shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
        No bookings match &ldquo;{search}&rdquo;.
      </div>
    );
  }

  if (tab !== "upcoming") {
    return (
      <div className="mt-4 rounded-2xl border border-[#EEE7DF] bg-white px-6 py-12 text-center text-sm text-[#6B7280] shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
        No {tab} bookings yet.
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-[#EEE7DF] bg-white shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <div className="relative">
          <div className="absolute inset-0 -m-3 rounded-[26px] bg-[#FFF0EF]" />
          <div className="relative flex size-20 items-center justify-center rounded-[20px] border border-[#FFD2CE] bg-white text-[#FF5F63] shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
            <CalendarCheck2 className="size-9" />
          </div>
        </div>
        <h3 className="mt-7 text-[22px] font-bold">No bookings yet</h3>
        <p className="mt-2 max-w-[420px] text-sm leading-[1.6] text-[#6B7280]">
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
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-5 text-[13px] font-bold text-white shadow-sm hover:brightness-105"
          >
            <Copy className="size-4" /> Copy booking link
          </button>
          <Link
            href="/dashboard/services"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-5 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
          >
            <Plus className="size-4" /> Manage services
          </Link>
        </div>

        <div className="mt-10 grid w-full max-w-[720px] gap-3 text-left sm:grid-cols-3">
          <TipCard
            icon={Share2}
            iconColor="text-[#FF5F63]"
            iconBorder="border-[#FFD2CE]"
            title="Share on Instagram"
            text="Add your link to your bio so DMs become bookings."
          />
          <TipCard
            icon={MessageCircle}
            iconColor="text-[#A855F7]"
            iconBorder="border-[#E1CFFA]"
            title="Drop it in WhatsApp"
            text="Send it to existing clients next time they ask for a slot."
          />
          <TipCard
            icon={QrCode}
            iconColor="text-[#0D9488]"
            iconBorder="border-[#B6E4F2]"
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
    <div className="rounded-2xl border border-[#EEE7DF] bg-[#FFFBF7] p-4">
      <span
        className={`flex size-9 items-center justify-center rounded-xl bg-white ${iconColor} border ${iconBorder}`}
      >
        <Icon className="size-4" />
      </span>
      <p className="mt-3 text-[13px] font-bold">{title}</p>
      <p className="mt-1 text-[11px] leading-[1.5] text-[#6B7280]">{text}</p>
    </div>
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

function formatDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
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
