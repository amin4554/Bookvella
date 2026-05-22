"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarX, CheckCircle, Clock3 } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

type BookingSummary = {
  id: string;
  status: string;
  guestName: string;
  eventTitle: string;
  hostName: string;
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
    <div className="min-h-screen bg-[#FFFBF7] px-4 py-12">
      <div className="mx-auto w-full max-w-[480px]">
        <div className="mb-8 flex justify-center">
          <BrandLogo />
        </div>

        <div className="rounded-[24px] border border-[#EEE7DF] bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-[#6B7280]">Loading booking details...</p>
        </div>
      </div>
    </div>
  );
}

function CancelPageContent() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Invalid cancellation link.");
      setLoading(false);
      return;
    }

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

  return (
    <div className="min-h-screen bg-[#FFFBF7] px-4 py-12">
      <div className="mx-auto w-full max-w-[480px]">
        <div className="mb-8 flex justify-center">
          <BrandLogo />
        </div>

        {loading && (
          <div className="rounded-[24px] border border-[#EEE7DF] bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-[#6B7280]">Loading booking details...</p>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-[24px] border border-red-200 bg-white p-8 text-center shadow-sm">
            <CalendarX className="mx-auto mb-4 size-10 text-red-400" />
            <h1 className="text-xl font-bold">Link not found</h1>
            <p className="mt-2 text-sm text-[#6B7280]">{error}</p>
          </div>
        )}

        {!loading && !error && cancelled && (
          <div className="rounded-[24px] border border-[#EEE7DF] bg-white p-8 text-center shadow-sm">
            <CheckCircle className="mx-auto mb-4 size-10 text-[#16A34A]" />
            <h1 className="text-xl font-bold">Booking cancelled</h1>
            <p className="mt-2 text-sm text-[#6B7280]">
              Your booking has been cancelled. You and the host will both
              receive a confirmation email.
            </p>
          </div>
        )}

        {!loading && !error && !cancelled && booking && (
          <div className="rounded-[24px] border border-[#EEE7DF] bg-white p-8 shadow-sm">
            <h1 className="text-2xl font-bold">Cancel your booking?</h1>
            <p className="mt-1 text-sm text-[#6B7280]">
              This will notify {booking.hostName} immediately.
            </p>

            <div className="mt-6 space-y-3 rounded-2xl border border-[#EEE7DF] bg-[#FFFBF7] p-5">
              <p className="font-bold">{booking.eventTitle}</p>
              <p className="text-sm text-[#6B7280]">
                with {booking.hostName}
              </p>
              <div className="flex items-center gap-2 text-sm text-[#6B7280]">
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

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

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
                className="h-12 rounded-2xl bg-red-500 font-bold text-white hover:bg-red-600"
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
  );
}
