"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { authedApiRequest, type HostBooking, type PublicUser, publicBookingUrl } from "@/lib/api";

type Tab = "upcoming" | "past" | "cancelled";

export default function BookingsPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const [selected, setSelected] = useState<HostBooking | null>(null);
  const [reason, setReason] = useState("");
  const [tab, setTab] = useState<Tab>("upcoming");
  const [search, setSearch] = useState("");
  const [loadedAt, setLoadedAt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setError(caught instanceof Error ? caught.message : "Could not load bookings");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

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

      if (query) {
        const matchesName = booking.guestName.toLowerCase().includes(query);
        const matchesEmail = booking.guestEmail.toLowerCase().includes(query);
        if (!matchesName && !matchesEmail) return false;
      }

      return true;
    });
  }, [bookings, loadedAt, tab, search]);

  async function cancelBooking() {
    if (!selected) return;

    try {
      const updated = await authedApiRequest<HostBooking>(`/bookings/${selected.id}/cancel`, {
        method: "PATCH",
        body: JSON.stringify({ reason: reason || null }),
      });
      setBookings((current) =>
        current.map((booking) => (booking.id === updated.id ? updated : booking)),
      );
      setSelected(null);
      setReason("");
      toast.success("Booking cancelled successfully");
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : "Could not cancel booking");
    }
  }

  const firstActiveService = user
    ? (bookings.find((b) => b.status === "CONFIRMED") ?? null)
    : null;

  return (
    <AppShell
      active="Bookings"
      title="Bookings"
      userInitial={user?.name.charAt(0).toUpperCase() ?? "B"}
    >
      <section>
        <h2 className="text-2xl font-semibold text-[#111827]">Your Bookings</h2>
        <p className="mt-1 text-sm text-[#6B7280]">
          Manage and review all your appointments.
        </p>
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          <TabButton active={tab === "upcoming"} onClick={() => setTab("upcoming")}>Upcoming</TabButton>
          <TabButton active={tab === "past"} onClick={() => setTab("past")}>Past</TabButton>
          <TabButton active={tab === "cancelled"} onClick={() => setTab("cancelled")}>Cancelled</TabButton>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by guest name or email..."
          className="h-8 flex-1 rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm outline-none placeholder:text-[#B8C0CC] focus:border-[#FF5F63] focus:ring-2 focus:ring-[#FF5F63]/15 min-w-[200px] max-w-[360px]"
        />
      </div>

      {error ? <InlineState title="Bookings unavailable" text={error} /> : null}
      {loading ? <InlineState title="Loading bookings" text="Fetching your appointments." /> : null}

      {!loading && !error ? (
        <div className="mt-5 overflow-hidden rounded-xl border border-[#EEE7DF] bg-white shadow-sm">
          <div className="grid grid-cols-[1.4fr_1.4fr_1fr_1fr_1fr] bg-[#FFFBF7] px-4 py-3 text-xs font-medium text-[#6B7280] max-lg:hidden">
            <span>Guest</span>
            <span>Event</span>
            <span>Date &amp; Time</span>
            <span>Booked on</span>
            <span>Status</span>
          </div>
          {filtered.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              timeZone={user?.timezone ?? "UTC"}
              onCancel={() => setSelected(booking)}
            />
          ))}
          {filtered.length === 0 ? (
            <EmptyState tab={tab} search={search} user={user} firstBooking={firstActiveService} />
          ) : null}
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/45 px-4">
          <div className="w-full max-w-[480px] rounded-2xl bg-white p-8 shadow-2xl">
            <h3 className="text-xl font-semibold">Cancel this booking?</h3>
            <p className="mt-2 max-w-sm text-sm leading-5 text-[#6B7280]">
              The guest will receive a cancellation email.
            </p>
            <div className="mt-6 rounded-lg bg-[#FFFBF7] px-4 py-3">
              <p className="text-sm font-semibold">{selected.guestName}</p>
              <p className="mt-1 text-sm text-[#6B7280]">
                {selected.eventType.title} - {formatDateTime(selected.startTimeUtc, user?.timezone ?? "UTC")}
              </p>
            </div>
            <label className="mt-5 block">
              <span className="text-sm font-medium">Reason (optional)</span>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-1 h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-sm outline-none placeholder:text-[#B8C0CC] focus:border-[#FF5F63]"
                placeholder="Add a note about this cancellation..."
              />
            </label>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Button
                variant="outline"
                className="h-10 rounded-lg border-[#D1D5DB] bg-white font-semibold"
                onClick={() => setSelected(null)}
              >
                Keep booking
              </Button>
              <Button
                className="h-10 rounded-lg bg-[#DC2626] font-semibold text-white hover:bg-[#b91c1c]"
                onClick={cancelBooking}
              >
                Yes, cancel booking
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function BookingRow({
  booking,
  timeZone,
  onCancel,
}: {
  booking: HostBooking;
  timeZone: string;
  onCancel: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cancelled = booking.status === "CANCELLED";
  const hasDetails =
    booking.guestPhone ||
    booking.guestNote ||
    booking.cancellationReason ||
    booking.guestTimezone;

  const location =
    booking.eventType.locationDetails ?? formatLocation(booking.eventType.locationType);

  return (
    <div className={`border-t border-[#EEE7DF] ${cancelled ? "text-[#B8C0CC]" : ""}`}>
      <div
        className="grid cursor-pointer items-center gap-3 px-4 py-3 text-sm lg:grid-cols-[1.4fr_1.4fr_1fr_1fr_1fr]"
        onClick={() => hasDetails && setExpanded((v) => !v)}
      >
        <GuestCell name={booking.guestName} email={booking.guestEmail} muted={cancelled} />
        <div>
          <p className="font-medium">{booking.eventType.title}</p>
          {booking.guestNote ? (
            <p className="mt-1 line-clamp-1 text-xs text-[#6B7280]">
              Note: {booking.guestNote}
            </p>
          ) : null}
          <p className="text-xs text-[#6B7280] lg:hidden">{formatDateTime(booking.startTimeUtc, timeZone)}</p>
        </div>
        <p className="text-[#6B7280] max-lg:hidden">{formatDateTime(booking.startTimeUtc, timeZone)}</p>
        <p className="text-[#6B7280] max-lg:hidden">{formatDate(booking.createdAt, timeZone)}</p>
        <div className="flex items-center gap-4">
          <StatusBadge status={cancelled ? "cancelled" : "confirmed"}>
            {cancelled ? "Cancelled" : "Confirmed"}
          </StatusBadge>
          {!cancelled ? (
            <button
              className="h-7 rounded-md bg-red-100 px-4 text-sm font-medium text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
            >
              Cancel
            </button>
          ) : null}
          {hasDetails ? (
            <span className="ml-auto text-[#9CA3AF]">
              {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </span>
          ) : null}
        </div>
      </div>

      {expanded ? (
        <div className="grid gap-3 border-t border-[#EEE7DF] bg-[#FFFBF7] px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {booking.guestPhone ? (
            <DetailCell label="Phone" value={booking.guestPhone} />
          ) : null}
          <DetailCell label="Timezone" value={booking.guestTimezone} />
          <DetailCell label="Location" value={location} />
          {booking.guestNote ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Guest note</p>
              <p className="mt-1 leading-6 text-[#6B7280]">{booking.guestNote}</p>
            </div>
          ) : null}
          {booking.cancellationReason ? (
            <div className="sm:col-span-2 lg:col-span-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">Cancellation reason</p>
              <p className="mt-1 leading-6 text-[#6B7280]">{booking.cancellationReason}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#9CA3AF]">{label}</p>
      <p className="mt-1 text-[#6B7280]">{value}</p>
    </div>
  );
}

function EmptyState({
  tab,
  search,
  user,
  firstBooking,
}: {
  tab: Tab;
  search: string;
  user: PublicUser | null;
  firstBooking: HostBooking | null;
}) {
  if (search) {
    return (
      <div className="border-t border-[#EEE7DF] px-4 py-8 text-sm text-[#6B7280]">
        No bookings match &ldquo;{search}&rdquo;.
      </div>
    );
  }

  if (tab === "upcoming") {
    const link = firstBooking && user
      ? publicBookingUrl(user.slug, firstBooking.eventType.slug)
      : null;

    return (
      <div className="border-t border-[#EEE7DF] px-4 py-10">
        <p className="font-semibold text-[#111827]">No upcoming bookings yet</p>
        <p className="mt-1 text-sm text-[#6B7280]">
          Share your booking link so guests can schedule time with you.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {link ? (
            <button
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#FF6267] px-4 text-sm font-bold text-white"
              onClick={() => {
                navigator.clipboard.writeText(link);
                toast.success("Booking link copied");
              }}
            >
              <Copy className="size-3.5" />
              Copy booking link
            </button>
          ) : null}
          <Link
            href="/dashboard/event-types"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#E8DED7] bg-white px-4 text-sm font-bold"
          >
            <ExternalLink className="size-3.5" />
            {link ? "Manage services" : "Create a service"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-[#EEE7DF] px-4 py-8 text-sm text-[#6B7280]">
      No {tab} bookings found.
    </div>
  );
}

function GuestCell({
  name,
  email,
  muted = false,
}: {
  name: string;
  email: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold ${
          muted ? "bg-[#FFFBF7] text-[#C2C8D0]" : "bg-[#FFF0EF] text-[#FF5F63]"
        }`}
      >
        {name[0]}
      </div>
      <div>
        <p className="font-semibold">{name}</p>
        <p className="text-xs text-[#6B7280]">{email}</p>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      className={
        active
          ? "h-8 rounded-lg border border-[#FF5F63] bg-[#FFF0EF] px-4 text-sm font-semibold text-[#FF5F63]"
          : "h-8 rounded-lg border border-[#EEE7DF] bg-white px-6 text-sm text-[#6B7280]"
      }
      onClick={onClick}
    >
      {children}
    </button>
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

function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
}

function formatLocation(locationType: string) {
  if (locationType === "PHONE") return "Phone call";
  if (locationType === "IN_PERSON") return "In person";
  return "Video call";
}
