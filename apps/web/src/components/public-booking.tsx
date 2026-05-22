"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  Check,
  Clock3,
  Mail,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  apiRequest,
  type AvailableSlot,
  type BookingCodeResponse,
  type HostBooking,
  type PublicEvent,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type BookingStep = "slots" | "details" | "code" | "success";

type GuestDetails = {
  name: string;
  email: string;
  phone: string;
  note: string;
};

const validSteps: BookingStep[] = ["slots", "details", "code", "success"];

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
    validSteps.includes(initialStep as BookingStep)
      ? (initialStep as BookingStep)
      : "slots",
  );
  const [publicEvent, setPublicEvent] = useState<PublicEvent | null>(null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState(() =>
    toDateInput(new Date()),
  );
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [guestTimezone, setGuestTimezone] = useState(() => guessTimezone());
  const [guest, setGuest] = useState<GuestDetails>({
    name: "",
    email: "",
    phone: "",
    note: "",
  });
  const [verification, setVerification] = useState<BookingCodeResponse | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    async function loadEvent() {
      try {
        setPublicEvent(
          await apiRequest<PublicEvent>(`/public/${hostSlug}/${eventSlug}`),
        );
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "This booking page was not found",
        );
      } finally {
        setLoadingEvent(false);
      }
    }

    loadEvent();
  }, [hostSlug, eventSlug]);

  useEffect(() => {
    async function loadSlots() {
      setLoadingSlots(true);
      try {
        const now = new Date();
        const dayStart = new Date(`${selectedDate}T00:00:00`);
        const start = (
          toDateInput(now) === selectedDate && now > dayStart ? now : dayStart
        ).toISOString();
        const endDate = new Date(`${selectedDate}T00:00:00`);
        endDate.setDate(endDate.getDate() + 1);
        const query = new URLSearchParams({
          start,
          end: endDate.toISOString(),
          timezone: guestTimezone,
        });
        const available = await apiRequest<AvailableSlot[]>(
          `/public/${hostSlug}/${eventSlug}/slots?${query}`,
        );
        setSlots(available.filter((slot) => new Date(slot.startTimeUtc) > now));
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load available times",
        );
      } finally {
        setLoadingSlots(false);
      }
    }

    if (publicEvent) {
      loadSlots();
    }
  }, [publicEvent, hostSlug, eventSlug, selectedDate, guestTimezone]);

  const selectedTime = useMemo(() => {
    if (!selectedSlot) return null;

    return {
      day: formatDate(selectedSlot.startTimeUtc, guestTimezone),
      time: formatTime(selectedSlot.startTimeUtc, guestTimezone),
      range: `${formatTime(selectedSlot.startTimeUtc, guestTimezone)} - ${formatTime(selectedSlot.endTimeUtc, guestTimezone)}`,
    };
  }, [selectedSlot, guestTimezone]);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedSlot) return;

    setSubmitting(true);
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const nextGuest = {
        name: readText(form, "name"),
        email: readText(form, "email"),
        phone: readText(form, "phone"),
        note: readText(form, "note"),
      };
      const response = await apiRequest<BookingCodeResponse>(
        `/public/${hostSlug}/${eventSlug}/booking-codes`,
        {
          method: "POST",
          body: JSON.stringify({
            guestEmail: nextGuest.email,
            guestTimezone,
            startTimeUtc: selectedSlot.startTimeUtc,
          }),
        },
      );
      setGuest(nextGuest);
      setVerification(response);
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

  async function confirmBooking() {
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
      setError(
        caught instanceof Error ? caught.message : "Could not confirm booking",
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
      setCode("");
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

  function changeEmail() {
    setVerification(null);
    setCode("");
    setStep("details");
  }

  async function submitReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!reviewBookingId || !reviewToken) {
      return;
    }

    setReviewSubmitting(true);
    setError(null);

    try {
      const form = new FormData(event.currentTarget);
      await apiRequest("/public/reviews", {
        method: "POST",
        body: JSON.stringify({
          bookingId: reviewBookingId,
          token: reviewToken,
          rating: Number(readText(form, "rating")),
          comment: readText(form, "comment"),
        }),
      });
      setReviewSubmitted(true);
      setPublicEvent(
        await apiRequest<PublicEvent>(`/public/${hostSlug}/${eventSlug}`),
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not submit review",
      );
    } finally {
      setReviewSubmitting(false);
    }
  }

  if (loadingEvent) {
    return (
      <PublicState title="Loading booking page" text="Finding this event." />
    );
  }

  if (!publicEvent) {
    return (
      <PublicState
        title="Event not found"
        text={error ?? "This booking page is unavailable."}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#FFFBF7] text-[#111827] lg:grid lg:grid-cols-[400px_1fr]">
      <aside className="border-b border-[#EEE7DF] bg-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="border-b border-[#EEE7DF] px-6 py-4">
          <BrandLogo />
        </div>
        <div className="px-6 py-8">
          <div className="flex items-center gap-4 lg:block">
            <PublicAvatar
              name={publicEvent.host.name}
              imageUrl={publicEvent.host.profileImageUrl}
            />
            <div className="lg:mt-3">
              <p className="text-2xl font-bold">{publicEvent.host.name}</p>
              <p className="text-sm text-[#6B7280]">
                {publicEvent.host.headline ??
                  publicEvent.host.businessCategory ??
                  "Book a time"}
              </p>
              {publicEvent.reviewSummary.reviewCount > 0 ? (
                <p className="mt-3 text-sm text-amber-500">
                  {stars(publicEvent.reviewSummary.averageRating ?? 0)}{" "}
                  <span className="text-[#6B7280]">
                    {publicEvent.reviewSummary.averageRating} -{" "}
                    {publicEvent.reviewSummary.reviewCount} reviews
                  </span>
                </p>
              ) : null}
            </div>
          </div>
          {publicEvent.eventType.imageUrl ? (
            <div
              className="mt-6 aspect-[4/3] rounded-[22px] border border-[#EEE7DF] bg-cover bg-center"
              style={{
                backgroundImage: `url(${publicEvent.eventType.imageUrl})`,
              }}
            />
          ) : null}
          <div className="mt-8 rounded-[22px] border border-[#EEE7DF] bg-[#FFFBF7] p-5">
            <h1 className="text-xl font-bold">{publicEvent.eventType.title}</h1>
            <div className="mt-4 space-y-4 text-sm">
              <ServiceFact
                icon={Clock3}
                label="Duration"
                value={`${publicEvent.eventType.durationMinutes} minutes`}
              />
              <ServiceFact
                icon={MapPin}
                label="Location"
                value={
                  publicEvent.eventType.locationDetails ??
                  formatLocation(publicEvent.eventType.locationType)
                }
              />
              <ServiceFact
                icon={Check}
                label="What's included"
                value={
                  publicEvent.eventType.whatIncluded ??
                  "A focused, professional appointment"
                }
              />
              <ServiceFact
                icon={ShieldCheck}
                label="Notes"
                value={
                  publicEvent.host.whatToExpect ??
                  "Free cancellation up to 2h before"
                }
              />
            </div>
          </div>
          {publicEvent.eventType.description ? (
            <p className="mt-6 border-t border-[#EEE7DF] pt-4 text-sm leading-6 text-[#6B7280]">
              {publicEvent.eventType.description}
            </p>
          ) : null}
          {publicEvent.reviews.length > 0 ? (
            <div className="mt-8">
              <h3 className="font-bold">What guests say</h3>
              {publicEvent.reviews.slice(0, 3).map((review, index) => (
                <div
                  key={review.id}
                  className="mt-3 rounded-2xl border border-[#EEE7DF] bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-xl bg-[#7C4DFF] text-sm font-bold text-white">
                      {review.guestName.charAt(0).toUpperCase() ||
                        String(index + 1)}
                    </span>
                    <span className="text-xs text-amber-500">
                      {stars(review.rating)}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#6B7280]">
                    &quot;{review.comment}&quot;
                  </p>
                  <p className="mt-2 text-sm font-bold">{review.guestName}</p>
                </div>
              ))}
            </div>
          ) : null}
          {reviewBookingId && reviewToken ? (
            <ReviewPanel
              submitted={reviewSubmitted}
              submitting={reviewSubmitting}
              onSubmit={submitReview}
            />
          ) : null}
          {selectedTime ? (
            <div className="mt-10 border-t border-[#EEE7DF] pt-4">
              <p className="text-sm text-[#6B7280]">Selected time</p>
              <div className="mt-2 rounded-lg border border-[#FFB1A6] bg-[#FFF0EF] px-4 py-3">
                <p className="font-semibold">{selectedTime.day}</p>
                <p className="mt-1 text-sm text-[#6B7280]">
                  {selectedTime.range}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      <section className="px-6 py-8 lg:px-16 lg:py-14">
        <Stepper step={step} />
        {error ? (
          <div className="mb-5 mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
        {step === "slots" ? (
          <SlotsStep
            date={selectedDate}
            timezone={guestTimezone}
            slots={slots}
            loading={loadingSlots}
            onDateChange={setSelectedDate}
            onTimezoneChange={setGuestTimezone}
            onSelect={(slot) => {
              setSelectedSlot(slot);
              setStep("details");
            }}
          />
        ) : null}
        {step === "details" && selectedTime ? (
          <DetailsStep
            hostName={publicEvent.host.name}
            serviceTitle={publicEvent.eventType.title}
            duration={publicEvent.eventType.durationMinutes}
            location={
              publicEvent.eventType.locationDetails ??
              formatLocation(publicEvent.eventType.locationType)
            }
            selectedTime={selectedTime}
            guest={guest}
            submitting={submitting}
            onBack={() => setStep("slots")}
            onSubmit={requestCode}
          />
        ) : null}
        {step === "code" ? (
          <CodeStep
            email={guest.email}
            devCode={verification?.devCode}
            code={code}
            submitting={submitting}
            onCodeChange={setCode}
            onBack={() => setStep("details")}
            onChangeEmail={changeEmail}
            onResend={resendCode}
            onSuccess={confirmBooking}
          />
        ) : null}
        {step === "success" && selectedTime && selectedSlot ? (
          <SuccessStep
            eventTitle={publicEvent.eventType.title}
            hostName={publicEvent.host.name}
            email={guest.email}
            location={
              publicEvent.eventType.locationDetails ??
              formatLocation(publicEvent.eventType.locationType)
            }
            selectedTime={selectedTime}
            startTimeUtc={selectedSlot.startTimeUtc}
            endTimeUtc={selectedSlot.endTimeUtc}
            onRestart={() => {
              setSelectedSlot(null);
              setVerification(null);
              setCode("");
              setStep("slots");
            }}
          />
        ) : null}
      </section>
    </main>
  );
}

function SlotsStep({
  date,
  timezone,
  slots,
  loading,
  onDateChange,
  onTimezoneChange,
  onSelect,
}: {
  date: string;
  timezone: string;
  slots: AvailableSlot[];
  loading: boolean;
  onDateChange: (date: string) => void;
  onTimezoneChange: (timezone: string) => void;
  onSelect: (slot: AvailableSlot) => void;
}) {
  const dates = Array.from({ length: 14 }, (_, index) => {
    const value = new Date();
    value.setDate(value.getDate() + index);
    return toDateInput(value);
  });

  return (
    <div className="mt-12">
      <h2 className="text-[34px] font-bold leading-tight">Pick a time</h2>
      <p className="mt-2 text-base text-[#6B7280]">
        All times shown in {timezone}
      </p>
      <select
        value={timezone}
        onChange={(event) => onTimezoneChange(event.target.value)}
        className="mt-4 h-10 w-full max-w-[280px] rounded-lg border border-[#D1D5DB] bg-[#FFFBF7] px-3 text-sm text-[#6B7280]"
      >
        {[timezone, "Europe/Berlin", "America/New_York", "UTC"]
          .filter(unique)
          .map((value) => (
            <option key={value}>{value}</option>
          ))}
      </select>
      <div className="mt-5 grid gap-5 xl:grid-cols-[340px_1fr]">
        <div className="rounded-[22px] border border-[#EEE7DF] bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {dates.map((value) => (
              <button
                key={value}
                className={cn(
                  "h-14 rounded-xl border text-sm font-bold",
                  value === date
                    ? "border-[#FF5F63] bg-[#FF5F63] text-white"
                    : "border-[#D1D5DB] bg-white hover:border-[#FF5F63]",
                )}
                onClick={() => onDateChange(value)}
              >
                {formatShortDate(value)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-semibold">{formatFullDate(date)}</h3>
          <p className="mt-1 text-sm text-[#6B7280]">
            {loading
              ? "Checking availability..."
              : `${slots.length} slots available`}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {slots.map((slot) => (
              <button
                key={slot.startTimeUtc}
                onClick={() => onSelect(slot)}
                className="h-11 rounded-xl border border-[#D1D5DB] bg-white text-sm font-bold transition hover:border-[#FF5F63] hover:bg-[#FFF0EF]"
              >
                {formatTime(slot.startTimeUtc, timezone)}
              </button>
            ))}
          </div>
          {!loading && slots.length === 0 ? (
            <div className="mt-5 flex min-h-[102px] max-w-[480px] flex-col items-center justify-center rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] text-center">
              <p className="text-sm font-medium text-[#6B7280]">
                No times available
              </p>
              <p className="mt-1 text-sm text-[#B8C0CC]">
                Try another date above or check back after the host updates
                their schedule.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailsStep({
  hostName,
  serviceTitle,
  duration,
  location,
  selectedTime,
  guest,
  submitting,
  onBack,
  onSubmit,
}: {
  hostName: string;
  serviceTitle: string;
  duration: number;
  location: string;
  selectedTime: { day: string; time: string; range: string };
  guest: GuestDetails;
  submitting: boolean;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="mt-12 grid gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <h2 className="text-[34px] font-bold leading-tight">Your details</h2>
        <p className="mt-2 text-base text-[#6B7280]">
          Tell {hostName.split(" ")[0]} a little about yourself so they can
          prepare.
        </p>
        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          <PublicField
            label="Full name"
            name="name"
            placeholder="Your full name"
            defaultValue={guest.name}
          />
          <PublicField
            label="Email address"
            name="email"
            placeholder="you@example.com"
            type="email"
            defaultValue={guest.email}
          />
          <PublicField
            label="Phone number (optional)"
            name="phone"
            placeholder="+1 (555) 000-0000"
            defaultValue={guest.phone}
          />
          <label className="block">
            <span className="text-sm font-bold">
              Note for {hostName.split(" ")[0]}{" "}
              <span className="font-normal text-[#9CA3AF]">optional</span>
            </span>
            <textarea
              name="note"
              defaultValue={guest.note}
              rows={4}
              className="mt-2 w-full resize-none rounded-2xl border border-[#E8DED7] bg-white px-5 py-4 outline-none placeholder:text-[#9CA3AF] focus:border-[#FF5F63] focus:ring-4 focus:ring-[#FF5F63]/10"
              placeholder="Anything they should know before the appointment?"
            />
          </label>
          <Button
            className="h-14 w-full rounded-2xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] text-base font-bold text-white"
            disabled={submitting}
          >
            {submitting ? "Sending code..." : "Send verification code ->"}
          </Button>
          <p className="text-center text-sm leading-6 text-[#9CA3AF]">
            We&apos;ll email you a 6-digit code to confirm your booking.
          </p>
        </form>
      </div>
      <AppointmentPanel
        hostName={hostName}
        serviceTitle={serviceTitle}
        duration={duration}
        location={location}
        selectedTime={selectedTime}
        onBack={onBack}
      />
    </div>
  );
}

function CodeStep({
  email,
  devCode,
  code,
  submitting,
  onCodeChange,
  onBack,
  onChangeEmail,
  onResend,
  onSuccess,
}: {
  email: string;
  devCode?: string;
  code: string;
  submitting: boolean;
  onCodeChange: (code: string) => void;
  onBack: () => void;
  onChangeEmail: () => void;
  onResend: () => void;
  onSuccess: () => void;
}) {
  return (
    <div className="mt-12 max-w-[520px]">
      <h2 className="text-[34px] font-bold leading-tight">Check your email</h2>
      <div className="mt-6 flex items-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-[#FFF0EF] text-[#FF5F63]">
          <Mail className="size-6" />
        </div>
        <p className="text-sm text-[#6B7280]">
          We sent a 6-digit code to:
          <br />
          <span className="font-semibold text-[#111827]">{email}</span>
        </p>
      </div>
      {devCode ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Development code: {devCode}
        </div>
      ) : null}
      <input
        value={code}
        onChange={(event) =>
          onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
        className="mt-6 h-16 w-full max-w-[280px] rounded-2xl border border-[#D1D5DB] px-4 text-center text-3xl font-bold tracking-[0.3em] outline-none focus:border-[#FF5F63] focus:ring-4 focus:ring-[#FF5F63]/10"
        placeholder="000000"
      />
      <Button
        className="mt-6 block h-14 w-full max-w-[360px] rounded-2xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] font-bold text-white"
        onClick={onSuccess}
        disabled={submitting || code.length !== 6}
      >
        {submitting ? "Confirming..." : "Confirm booking"}
      </Button>
      <button
        className="mt-4 text-sm font-medium text-[#FF5F63]"
        onClick={onBack}
      >
        Back
      </button>
      <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium">
        <button className="text-[#FF5F63]" onClick={onResend} type="button">
          Resend code
        </button>
        <button className="text-[#6B7280]" onClick={onChangeEmail} type="button">
          Change email
        </button>
      </div>
    </div>
  );
}

function SuccessStep({
  eventTitle,
  hostName,
  email,
  location,
  selectedTime,
  startTimeUtc,
  endTimeUtc,
  onRestart,
}: {
  eventTitle: string;
  hostName: string;
  email: string;
  location: string;
  selectedTime: { day: string; range: string };
  startTimeUtc: string;
  endTimeUtc: string;
  onRestart: () => void;
}) {
  const calendarUrl = googleCalendarUrl({
    title: eventTitle,
    hostName,
    location,
    startTimeUtc,
    endTimeUtc,
  });

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="rounded-full bg-gradient-to-br from-[#FFE6E3] to-[#F0E6FF] p-5">
        <div className="flex size-20 items-center justify-center rounded-full bg-[#16A34A] text-white">
          <Check className="size-10" />
        </div>
      </div>
      <h2 className="mt-5 text-3xl font-bold">Your booking is confirmed</h2>
      <p className="mt-3 text-sm text-[#6B7280]">
        A confirmation has been sent to {email}
      </p>
      <div className="mt-8 w-full max-w-[520px] rounded-[22px] border border-[#EEE7DF] bg-white p-6 text-left shadow-sm">
        <Detail label="Service" value={eventTitle} />
        <Detail label="Host" value={hostName} />
        <Detail label="Date" value={selectedTime.day} />
        <Detail label="Time" value={selectedTime.range} />
        <Detail label="Location" value={location} />
      </div>
      <a
        href={calendarUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border border-[#E8DED7] bg-white px-5 text-sm font-bold text-[#111827] shadow-sm"
      >
        <CalendarPlus className="size-4 text-[#FF6267]" />
        Add to calendar
      </a>
      <button
        className="mt-4 text-sm font-medium text-[#FF5F63]"
        onClick={onRestart}
      >
        Book another time
      </button>
    </div>
  );
}

function Stepper({ step }: { step: BookingStep }) {
  const order: { id: BookingStep; label: string }[] = [
    { id: "slots", label: "Pick a time" },
    { id: "details", label: "Your details" },
    { id: "code", label: "Confirm" },
  ];
  const currentIndex = order.findIndex((item) => item.id === step);

  return (
    <div className="flex items-center gap-3 overflow-x-auto pb-1 lg:gap-5">
      {order.map((item, index) => {
        const complete = currentIndex > index || step === "success";
        const active = currentIndex === index;

        return (
          <div
            key={item.id}
            className="flex min-w-[150px] flex-1 items-center gap-3 lg:min-w-0 lg:gap-4"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold lg:size-10 lg:text-sm",
                complete
                  ? "bg-[#16C784] text-white"
                  : active
                    ? "bg-[#FF7A59] text-white"
                    : "bg-[#E8E3DD] text-[#9CA3AF]",
              )}
            >
              {complete ? <Check className="size-4" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-xs font-bold lg:text-sm",
                active ? "text-[#FF6267]" : "text-[#9CA3AF]",
              )}
            >
              {item.label}
            </span>
            {index < order.length - 1 ? (
              <span className="h-px flex-1 bg-[#E8E3DD]" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PublicAvatar({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl: string | null;
}) {
  if (imageUrl) {
    return (
      <div
        className="size-24 rounded-[28px] bg-cover bg-center"
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
    );
  }

  return (
    <div className="flex size-24 items-center justify-center rounded-[28px] bg-gradient-to-br from-[#FF6267] to-[#B450F4] text-4xl font-bold text-white">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function ServiceFact({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="grid grid-cols-[36px_1fr] gap-3">
      <span className="flex size-9 items-center justify-center rounded-xl bg-white text-[#FF6267]">
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block text-xs text-[#9CA3AF]">{label}</span>
        <span className="block font-bold">{value}</span>
      </span>
    </div>
  );
}

function AppointmentPanel({
  hostName,
  serviceTitle,
  duration,
  location,
  selectedTime,
  onBack,
}: {
  hostName: string;
  serviceTitle: string;
  duration: number;
  location: string;
  selectedTime: { day: string; range: string };
  onBack: () => void;
}) {
  return (
    <aside className="rounded-none border border-[#EEE7DF] bg-white p-6 xl:sticky xl:top-8 xl:self-start">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
        Your appointment
      </p>
      <div className="mt-5 flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#FF6267] to-[#B450F4] font-bold text-white">
          {hostName.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-bold">{hostName}</p>
          <p className="text-sm text-[#6B7280]">Bookvella host</p>
        </div>
      </div>
      <div className="mt-5 border-t border-[#EEE7DF] pt-5">
        <h3 className="text-xl font-bold">{serviceTitle}</h3>
        <p className="mt-3 flex items-center gap-2 font-bold">
          <span className="size-2 rounded-full bg-[#FF6267]" />
          {duration} min
        </p>
        <p className="mt-3 flex items-center gap-2 text-[#6B7280]">
          <span className="size-2 rounded-full bg-[#A855F7]" />
          {location}
        </p>
      </div>
      <div className="mt-5 border-t border-[#EEE7DF] pt-5">
        <p className="text-2xl font-bold">{selectedTime.day}</p>
        <p className="mt-1 text-[#6B7280]">{selectedTime.range}</p>
        <button
          type="button"
          className="mt-5 text-sm font-bold text-[#FF6267]"
          onClick={onBack}
        >
          &lt;- Change time
        </button>
      </div>
    </aside>
  );
}

function ReviewPanel({
  submitted,
  submitting,
  onSubmit,
}: {
  submitted: boolean;
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (submitted) {
    return (
      <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
        Thanks for the review. It will help future guests book with confidence.
      </div>
    );
  }

  return (
    <form
      className="mt-8 rounded-[22px] border border-[#EEE7DF] bg-white p-5 shadow-sm"
      onSubmit={onSubmit}
    >
      <h3 className="text-lg font-bold">Leave a review</h3>
      <p className="mt-1 text-sm text-[#6B7280]">
        Share a few words about your booking. Reviews are public when approved by
        the host.
      </p>
      <label className="mt-4 block">
        <span className="text-sm font-bold">Rating</span>
        <select
          name="rating"
          defaultValue="5"
          className="mt-2 h-11 w-full rounded-xl border border-[#E8DED7] bg-[#FFFBF7] px-3 text-sm outline-none focus:border-[#FF5F63]"
        >
          {[5, 4, 3, 2, 1].map((rating) => (
            <option key={rating} value={rating}>
              {stars(rating)} ({rating})
            </option>
          ))}
        </select>
      </label>
      <label className="mt-4 block">
        <span className="text-sm font-bold">Comment</span>
        <textarea
          name="comment"
          required
          maxLength={800}
          rows={4}
          placeholder="What should future guests know?"
          className="mt-2 w-full resize-none rounded-xl border border-[#E8DED7] bg-[#FFFBF7] px-4 py-3 text-sm outline-none placeholder:text-[#9CA3AF] focus:border-[#FF5F63]"
        />
      </label>
      <Button
        className="mt-4 h-11 w-full rounded-xl bg-[#FF6267] font-bold text-white"
        disabled={submitting}
      >
        {submitting ? "Submitting..." : "Submit review"}
      </Button>
    </form>
  );
}

function PublicState({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-[440px] rounded-xl border border-[#EEE7DF] bg-white p-8 shadow-sm">
        <BrandLogo />
        <h1 className="mt-8 text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-[#6B7280]">{text}</p>
      </div>
    </main>
  );
}

function PublicField({
  label,
  name,
  placeholder,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={name !== "phone"}
        className="mt-1 h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-sm outline-none placeholder:text-[#B8C0CC] focus:border-[#FF5F63] focus:ring-2 focus:ring-[#FF5F63]/15"
        placeholder={placeholder}
      />
    </label>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] py-2 text-sm">
      <span className="text-[#6B7280]">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function readText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
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

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatFullDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function guessTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function unique(value: string, index: number, array: string[]) {
  return array.indexOf(value) === index;
}

function formatLocation(locationType: string) {
  if (locationType === "PHONE") return "Phone call";
  if (locationType === "IN_PERSON") return "In person";
  return "Video call";
}

function stars(rating: number) {
  return "*****".slice(0, Math.max(0, Math.min(5, Math.round(rating))));
}

function googleCalendarUrl(input: {
  title: string;
  hostName: string;
  location: string;
  startTimeUtc: string;
  endTimeUtc: string;
}) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${input.title} with ${input.hostName}`,
    dates: `${formatCalendarTimestamp(input.startTimeUtc)}/${formatCalendarTimestamp(input.endTimeUtc)}`,
    location: input.location,
    details: "Booked with Bookvella.",
  });

  return `https://calendar.google.com/calendar/render?${params}`;
}

function formatCalendarTimestamp(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
