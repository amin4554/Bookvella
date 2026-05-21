"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { authedApiRequest, type HostBooking, type PublicUser } from "@/lib/api";

type Tab = "upcoming" | "past" | "cancelled";

export default function BookingsPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [bookings, setBookings] = useState<HostBooking[]>([]);
  const [selected, setSelected] = useState<HostBooking | null>(null);
  const [reason, setReason] = useState("");
  const [tab, setTab] = useState<Tab>("upcoming");
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
    return bookings.filter((booking) => {
      if (tab === "cancelled") {
        return booking.status === "CANCELLED";
      }

      if (booking.status === "CANCELLED") {
        return false;
      }

      const start = new Date(booking.startTimeUtc).getTime();
      return tab === "upcoming" ? start >= now : start < now;
    });
  }, [bookings, loadedAt, tab]);

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

      <div className="mt-5 flex flex-wrap gap-4">
        <TabButton active={tab === "upcoming"} onClick={() => setTab("upcoming")}>Upcoming</TabButton>
        <TabButton active={tab === "past"} onClick={() => setTab("past")}>Past</TabButton>
        <TabButton active={tab === "cancelled"} onClick={() => setTab("cancelled")}>Cancelled</TabButton>
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
            <div className="border-t border-[#EEE7DF] px-4 py-8 text-sm text-[#6B7280]">
              No {tab} bookings found.
            </div>
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
  const cancelled = booking.status === "CANCELLED";

  return (
    <div
      className={`grid items-center gap-3 border-t border-[#EEE7DF] px-4 py-3 text-sm lg:grid-cols-[1.4fr_1.4fr_1fr_1fr_1fr] ${
        cancelled ? "text-[#B8C0CC]" : ""
      }`}
    >
      <GuestCell name={booking.guestName} email={booking.guestEmail} muted={cancelled} />
      <div>
        <p className="font-medium">{booking.eventType.title}</p>
        <p className="text-xs text-[#6B7280] lg:hidden">{formatDateTime(booking.startTimeUtc, timeZone)}</p>
      </div>
      <p className="text-[#6B7280] max-lg:hidden">{formatDateTime(booking.startTimeUtc, timeZone)}</p>
      <p className="text-[#6B7280] max-lg:hidden">{formatDate(booking.createdAt, timeZone)}</p>
      <div className="flex items-center gap-8">
        <StatusBadge status={cancelled ? "cancelled" : "confirmed"}>
          {cancelled ? "Cancelled" : "Confirmed"}
        </StatusBadge>
        {!cancelled ? (
          <button
            className="h-7 rounded-md bg-red-100 px-4 text-sm font-medium text-red-600"
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
      </div>
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
