"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarClock, CalendarX, CheckCircle, Clock3 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { LegalFooter } from "@/components/legal-footer";
import { Button } from "@/components/ui/button";
import { apiRequest, type AvailableSlot } from "@/lib/api";

type BookingSummary = {
  id: string;
  status: string;
  guestName: string;
  eventTitle: string;
  eventSlug: string;
  hostName: string;
  hostSlug: string;
  startTimeUtc: string;
  endTimeUtc: string;
  guestTimezone: string;
};

export default function CancelPage() {
  return (
    <Suspense fallback={<CancelPageShell />}>
      <CancelPageContent />
    </Suspense>
  );
}

function CancelPageShell() {
  return (
    <div className="min-h-screen bg-surface-page">
      <div className="px-4 py-12">
        <div className="mx-auto w-full max-w-[480px]">
          <div className="mb-8 flex justify-center">
            <BrandLogo />
          </div>

          <div className="rounded-[24px] border border-line-cream bg-surface-card p-8 text-center shadow-sm">
            <p className="text-sm text-ink-soft">Loading booking details...</p>
          </div>
        </div>
      </div>
      <LegalFooter />
    </div>
  );
}

function CancelPageContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [rescheduled, setRescheduled] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const invalidToken = !token;
  const visibleLoading = !invalidToken && loading;
  const visibleError = invalidToken ? "Invalid cancellation link." : error;

  useEffect(() => {
    if (!token) return;

    apiRequest<BookingSummary>(`/public/bookings/guest-cancel/${token}`)
      .then((data) => {
        setBooking(data);
        if (data.status === "CANCELLED") {
          setCancelled(true);
        }
      })
      .catch((caught) => {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not find this booking.",
        );
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!booking || cancelled || booking.status === "CANCELLED") return;

    const start = new Date();
    const end = new Date(start.getTime() + 21 * 24 * 60 * 60 * 1000);
    apiRequest<AvailableSlot[]>(
      `/public/${booking.hostSlug}/${booking.eventSlug}/slots?start=${encodeURIComponent(
        start.toISOString(),
      )}&end=${encodeURIComponent(end.toISOString())}&timezone=${encodeURIComponent(
        booking.guestTimezone,
      )}`,
    )
      .then((items) => {
        const futureSlots = items.filter(
          (slot) => slot.startTimeUtc !== booking.startTimeUtc,
        );
        setSlots(futureSlots);
        setSelectedSlot(futureSlots[0]?.startTimeUtc ?? "");
      })
      .catch(() => {
        setSlots([]);
        setSelectedSlot("");
      })
      .finally(() => setSlotsLoading(false));
  }, [booking, cancelled]);

  async function handleCancel() {
    if (!token) return;
    setCancelling(true);
    setError(null);

    try {
      await apiRequest(`/public/bookings/guest-cancel/${token}`, {
        method: "POST",
      });
      setCancelled(true);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not cancel booking.",
      );
    } finally {
      setCancelling(false);
    }
  }

  async function handleReschedule() {
    if (!token || !selectedSlot || !booking) return;
    setRescheduling(true);
    setError(null);

    try {
      const updated = await apiRequest<{
        startTimeUtc: string;
        endTimeUtc: string;
        guestTimezone: string;
        status: string;
      }>(`/public/bookings/guest-reschedule/${token}`, {
        method: "POST",
        body: JSON.stringify({
          startTimeUtc: selectedSlot,
          guestTimezone: booking.guestTimezone,
        }),
      });
      setBooking({
        ...booking,
        startTimeUtc: updated.startTimeUtc,
        endTimeUtc: updated.endTimeUtc,
        guestTimezone: updated.guestTimezone,
        status: updated.status,
      });
      setRescheduled(true);
      setSlots([]);
      setSelectedSlot("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not reschedule booking.",
      );
    } finally {
      setRescheduling(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="px-4 py-12">
      <div className="mx-auto w-full max-w-[480px]">
        <div className="mb-8 flex justify-center">
          <BrandLogo />
        </div>

        {visibleLoading && (
          <div className="rounded-[24px] border border-line-cream bg-surface-card p-8 text-center shadow-sm">
            <p className="text-sm text-ink-soft">Loading booking details...</p>
          </div>
        )}

        {!visibleLoading && visibleError && (
          <div className="rounded-[24px] border border-danger-border bg-surface-card p-8 text-center shadow-sm">
            <CalendarX className="mx-auto mb-4 size-10 text-danger" />
            <h1 className="text-xl font-bold">Link not found</h1>
            <p className="mt-2 text-sm text-ink-soft">{visibleError}</p>
          </div>
        )}

        {!visibleLoading && !visibleError && cancelled && (
          <div className="rounded-[24px] border border-line-cream bg-surface-card p-8 text-center shadow-sm">
            <CheckCircle className="mx-auto mb-4 size-10 text-success" />
            <h1 className="text-xl font-bold">Booking cancelled</h1>
            <p className="mt-2 text-sm text-ink-soft">
              Your booking has been cancelled. You and the host will both
              receive a confirmation email.
            </p>
          </div>
        )}

        {!visibleLoading && !visibleError && !cancelled && booking && (
          <div className="rounded-[24px] border border-line-cream bg-surface-card p-8 shadow-sm">
            <h1 className="text-2xl font-bold">Manage your booking</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Reschedule or cancel your booking with {booking.hostName}.
            </p>

            <div className="mt-6 space-y-3 rounded-2xl border border-line-cream bg-surface-page p-5">
              <p className="font-bold">{booking.eventTitle}</p>
              <p className="text-sm text-ink-soft">
                with {booking.hostName}
              </p>
              <div className="flex items-center gap-2 text-sm text-ink-soft">
                <Clock3 className="size-4 shrink-0" />
                <span>
                  {new Intl.DateTimeFormat("en-US", {
                    dateStyle: "full",
                    timeStyle: "short",
                    timeZone: booking.guestTimezone,
                  }).format(new Date(booking.startTimeUtc))}
                </span>
              </div>
            </div>

            {rescheduled ? (
              <div className="mt-4 rounded-xl border border-success-border bg-success-tint px-4 py-3 text-sm text-success-strong">
                Booking rescheduled. You and the host will both receive an
                updated calendar invitation by email.
              </div>
            ) : null}

            {error && (
              <div className="mt-4 rounded-xl border border-danger-border bg-danger-tint px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-line-cream bg-surface-card p-4">
              <div className="flex items-start gap-3">
                <CalendarClock className="mt-0.5 size-5 shrink-0 text-brand" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">Reschedule</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    Choose another available time in the next 3 weeks.
                  </p>
                </div>
              </div>
              <select
                value={selectedSlot}
                onChange={(event) => setSelectedSlot(event.target.value)}
                disabled={slotsLoading || slots.length === 0 || rescheduling}
                className="mt-4 h-12 w-full rounded-2xl border border-line-soft bg-surface-card px-3 text-sm outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)] disabled:bg-surface-soft disabled:text-ink-muted"
              >
                {slotsLoading ? (
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
              <Button
                type="button"
                variant="outline"
                className="mt-3 h-12 w-full rounded-2xl font-bold"
                disabled={!selectedSlot || slotsLoading || rescheduling}
                onClick={handleReschedule}
              >
                {rescheduling ? "Rescheduling..." : "Reschedule booking"}
              </Button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-2xl font-bold"
                onClick={() => window.history.back()}
              >
                Keep booking
              </Button>
              <Button
                type="button"
                className="h-12 rounded-2xl bg-danger-strong font-bold text-white hover:bg-danger"
                disabled={cancelling}
                onClick={handleCancel}
              >
                {cancelling ? "Cancelling..." : "Yes, cancel it"}
              </Button>
            </div>
          </div>
        )}
      </div>
      </div>
      <LegalFooter />
    </div>
  );
}
