"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  apiRequest,
  type AvailableSlot,
  type BookingCodeResponse,
  type HostBooking,
  type PublicEvent,
} from "@/lib/api";
import { detectBrowserTimezone } from "@/lib/timezones";
import { ServiceAside } from "./service-aside";
import { Stepper, type BookingStep } from "./stepper";
import { StepSlots } from "./step-slots";
import { StepDetails, type GuestDetails } from "./step-details";
import { StepOtp } from "./step-otp";
import { StepSuccess } from "./step-success";
import { ReviewPanel } from "./review-panel";
import { slotGuestDateKey } from "./helpers";

const VALID_STEPS: BookingStep[] = ["slots", "details", "code", "success"];

export function PublicBooking({
  hostSlug,
  eventSlug,
  initialStep,
  reviewBookingId,
  reviewToken,
}: {
  hostSlug: string;
  eventSlug: string;
  initialStep?: string;
  reviewBookingId?: string;
  reviewToken?: string;
}) {
  const [step, setStep] = useState<BookingStep>(
    VALID_STEPS.includes(initialStep as BookingStep)
      ? (initialStep as BookingStep)
      : "slots",
  );
  const [data, setData] = useState<PublicEvent | null>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);

  const [guestTimezone, setGuestTimezone] = useState(() =>
    detectBrowserTimezone(),
  );
  // The slot fetch result carries the timezone it was fetched for, so the
  // loading state can be *derived* (no setState-in-effect): a result whose
  // `tz` is stale means we're refetching for the current timezone.
  const [slotResult, setSlotResult] = useState<{
    tz: string;
    byDate: Map<string, AvailableSlot[]>;
    dates: string[];
  } | null>(null);
  const slotsByDate = slotResult?.byDate ?? new Map<string, AvailableSlot[]>();
  const availableDates = slotResult?.dates ?? [];
  const loadingSlots =
    !!data && (!slotResult || slotResult.tz !== guestTimezone);

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [slotGoneWarning, setSlotGoneWarning] = useState(false);

  const [guest, setGuest] = useState<GuestDetails>({
    name: "",
    email: "",
    phone: "",
    note: "",
  });
  const [verification, setVerification] = useState<BookingCodeResponse | null>(
    null,
  );
  const [lastSentAt, setLastSentAt] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1) Load the public event (host + service + reviews).
  useEffect(() => {
    let cancelled = false;
    apiRequest<PublicEvent>(`/public/${hostSlug}/${eventSlug}`)
      .then((event) => {
        if (cancelled) return;
        setData(event);
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "This booking page was not found",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingEvent(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hostSlug, eventSlug]);

  // 2) Fetch the next 21-day slot window whenever event or timezone changes.
  // setState only fires inside the async resolve handlers — the effect body
  // itself contains no synchronous state writes.
  useEffect(() => {
    if (!data) return;
    let cancelled = false;
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 21);
    const query = new URLSearchParams({
      start: now.toISOString(),
      end: end.toISOString(),
      timezone: guestTimezone,
    });
    apiRequest<AvailableSlot[]>(
      `/public/${hostSlug}/${eventSlug}/slots?${query}`,
    )
      .then((slots) => {
        if (cancelled) return;
        // Drop anything already in the past from the guest's vantage point.
        const future = slots.filter((s) => new Date(s.startTimeUtc) > now);
        const byDate = new Map<string, AvailableSlot[]>();
        for (const slot of future) {
          const key = slotGuestDateKey(slot.startTimeUtc, guestTimezone);
          if (!byDate.has(key)) byDate.set(key, []);
          byDate.get(key)!.push(slot);
        }
        const dates = Array.from(byDate.keys()).sort();
        setSlotResult({ tz: guestTimezone, byDate, dates });
        setSelectedDate((prev) =>
          prev && dates.includes(prev) ? prev : (dates[0] ?? ""),
        );
      })
      .catch((caught) => {
        if (cancelled) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load available times",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [data, hostSlug, eventSlug, guestTimezone]);

  const selectedDateKey = useMemo(() => {
    if (!selectedSlot) return selectedDate;
    return slotGuestDateKey(selectedSlot.startTimeUtc, guestTimezone);
  }, [selectedSlot, selectedDate, guestTimezone]);

  async function sendCode(values: GuestDetails) {
    if (!selectedSlot) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await apiRequest<BookingCodeResponse>(
        `/public/${hostSlug}/${eventSlug}/booking-codes`,
        {
          method: "POST",
          body: JSON.stringify({
            guestEmail: values.email,
            guestTimezone,
            startTimeUtc: selectedSlot.startTimeUtc,
          }),
        },
      );
      setGuest(values);
      setVerification(response);
      setLastSentAt(Date.now());
      setStep("code");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not send verification code",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function resendCode() {
    if (!selectedSlot || !guest.email) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await apiRequest<BookingCodeResponse>(
        `/public/${hostSlug}/${eventSlug}/booking-codes`,
        {
          method: "POST",
          body: JSON.stringify({
            guestEmail: guest.email,
            guestTimezone,
            startTimeUtc: selectedSlot.startTimeUtc,
          }),
        },
      );
      setVerification(response);
      setLastSentAt(Date.now());
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not resend verification code",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmBooking(code: string) {
    if (!selectedSlot || !verification) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest<HostBooking>(
        `/public/${hostSlug}/${eventSlug}/bookings`,
        {
          method: "POST",
          body: JSON.stringify({
            guestName: guest.name,
            guestEmail: guest.email,
            guestPhone: guest.phone || null,
            guestNote: guest.note || null,
            guestTimezone,
            startTimeUtc: selectedSlot.startTimeUtc,
            verificationId: verification.verificationId,
            verificationCode: code,
          }),
        },
      );
      setStep("success");
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Could not confirm booking";
      // Specific race-condition detection: slot taken between selection and
      // confirmation. Bounce back to step 1 with the warning banner up.
      const lower = message.toLowerCase();
      if (
        lower.includes("no longer available") ||
        lower.includes("conflict") ||
        lower.includes("taken")
      ) {
        setSlotGoneWarning(true);
        setSelectedSlot(null);
        setVerification(null);
        setStep("slots");
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingEvent) {
    return (
      <PublicState title="Loading booking page" text="Finding this event." />
    );
  }

  if (!data) {
    return (
      <PublicState
        title="Event not found"
        text={error ?? "This booking page is unavailable."}
      />
    );
  }

  const selectedStartUtc = selectedSlot?.startTimeUtc ?? "";
  const selectedEndUtc = selectedSlot?.endTimeUtc ?? "";

  return (
    <div className="min-h-screen bg-[#FFFBF7] text-[#0B1220]">
      {/* slim top bar */}
      <header className="border-b border-[#EEE7DF] bg-white">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/icon.svg" alt="" className="size-7 rounded-md" />
            <span className="text-[15px] font-bold tracking-tight">
              Bookvella
            </span>
          </Link>
          <p className="hidden text-[12px] text-[#6B7280] sm:block">
            Powered by Bookvella — free booking platform
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1320px] gap-10 px-6 py-10 md:grid-cols-[400px_1fr]">
        <ServiceAside data={data} />

        <main>
          <Stepper step={step} />

          {error ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {step === "slots" ? (
            <StepSlots
              timezone={guestTimezone}
              loading={loadingSlots}
              slotsByDate={slotsByDate}
              availableDates={availableDates}
              selectedDate={selectedDate}
              selectedSlot={selectedSlot}
              slotGoneWarning={slotGoneWarning}
              onDismissSlotGoneWarning={() => setSlotGoneWarning(false)}
              onTimezoneChange={(tz) => {
                setGuestTimezone(tz);
                setSelectedSlot(null);
              }}
              onDateChange={(date) => {
                setSelectedDate(date);
                setSelectedSlot(null);
              }}
              onSelectSlot={(slot) => {
                setSelectedSlot(slot);
                setSlotGoneWarning(false);
              }}
              onContinue={() => setStep("details")}
              durationMinutes={data.eventType.durationMinutes}
            />
          ) : null}

          {step === "details" && selectedSlot ? (
            <StepDetails
              data={data}
              guest={guest}
              timezone={guestTimezone}
              selectedDateKey={selectedDateKey}
              selectedStartUtc={selectedStartUtc}
              selectedEndUtc={selectedEndUtc}
              submitting={submitting}
              onBack={() => setStep("slots")}
              onSubmit={sendCode}
            />
          ) : null}

          {step === "code" && selectedSlot ? (
            <StepOtp
              email={guest.email}
              devCode={verification?.devCode}
              submitting={submitting}
              lastSentAt={lastSentAt}
              data={data}
              timezone={guestTimezone}
              selectedDateKey={selectedDateKey}
              selectedStartUtc={selectedStartUtc}
              onSubmit={confirmBooking}
              onResend={resendCode}
              onChangeEmail={() => {
                setVerification(null);
                setStep("details");
              }}
            />
          ) : null}

          {step === "success" && selectedSlot ? (
            <StepSuccess
              data={data}
              email={guest.email}
              timezone={guestTimezone}
              selectedDateKey={selectedDateKey}
              selectedStartUtc={selectedStartUtc}
              selectedEndUtc={selectedEndUtc}
            />
          ) : null}

          {reviewBookingId && reviewToken ? (
            <ReviewPanel
              bookingId={reviewBookingId}
              token={reviewToken}
              onSubmitted={async () => {
                // Refresh review counts so the aside picks up the new entry.
                try {
                  const refreshed = await apiRequest<PublicEvent>(
                    `/public/${hostSlug}/${eventSlug}`,
                  );
                  setData(refreshed);
                } catch {
                  // ignored — refresh is best-effort.
                }
              }}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}

function PublicState({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#FFFBF7] px-4">
      <div className="w-full max-w-[440px] rounded-2xl border border-[#EEE7DF] bg-white p-8 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/icon.svg" alt="" className="size-7 rounded-md" />
          <span className="text-[15px] font-bold tracking-tight">
            Bookvella
          </span>
        </div>
        <h1 className="mt-8 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-[#6B7280]">{text}</p>
      </div>
    </main>
  );
}
