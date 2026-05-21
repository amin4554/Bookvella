"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarCheck, Check, Clock3, MapPin, UserRound } from "lucide-react";
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
};

const validSteps: BookingStep[] = ["slots", "details", "code", "success"];

export function PublicBooking({
  hostSlug,
  eventSlug,
  initialStep,
}: {
  hostSlug: string;
  eventSlug: string;
  initialStep?: string;
}) {
  const [step, setStep] = useState<BookingStep>(
    validSteps.includes(initialStep as BookingStep) ? (initialStep as BookingStep) : "slots",
  );
  const [publicEvent, setPublicEvent] = useState<PublicEvent | null>(null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => toDateInput(new Date()));
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);
  const [guestTimezone, setGuestTimezone] = useState(() => guessTimezone());
  const [guest, setGuest] = useState<GuestDetails>({ name: "", email: "", phone: "" });
  const [verification, setVerification] = useState<BookingCodeResponse | null>(null);
  const [code, setCode] = useState("");
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadEvent() {
      try {
        setPublicEvent(await apiRequest<PublicEvent>(`/public/${hostSlug}/${eventSlug}`));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "This booking page was not found");
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
        const start = (toDateInput(now) === selectedDate && now > dayStart ? now : dayStart).toISOString();
        const endDate = new Date(`${selectedDate}T00:00:00`);
        endDate.setDate(endDate.getDate() + 1);
        const query = new URLSearchParams({
          start,
          end: endDate.toISOString(),
          timezone: guestTimezone,
        });
        const available = await apiRequest<AvailableSlot[]>(`/public/${hostSlug}/${eventSlug}/slots?${query}`);
        setSlots(available.filter((slot) => new Date(slot.startTimeUtc) > now));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load available times");
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
      setError(caught instanceof Error ? caught.message : "Could not send verification code");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmBooking() {
    if (!selectedSlot || !verification) return;

    setSubmitting(true);
    setError(null);
    try {
      await apiRequest<HostBooking>(`/public/${hostSlug}/${eventSlug}/bookings`, {
        method: "POST",
        body: JSON.stringify({
          guestName: guest.name,
          guestEmail: guest.email,
          guestPhone: guest.phone || null,
          guestTimezone,
          startTimeUtc: selectedSlot.startTimeUtc,
          verificationId: verification.verificationId,
          verificationCode: code,
        }),
      });
      setStep("success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not confirm booking");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingEvent) {
    return <PublicState title="Loading booking page" text="Finding this event." />;
  }

  if (!publicEvent) {
    return <PublicState title="Event not found" text={error ?? "This booking page is unavailable."} />;
  }

  return (
    <main className="min-h-screen bg-white text-[#111827] lg:grid lg:grid-cols-[400px_1fr]">
      <aside className="border-b border-[#EEE7DF] bg-[#F8FAFC] lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="border-b border-[#EEE7DF] px-6 py-4">
          <BrandLogo />
        </div>
        <div className="px-6 py-6">
          <div className="flex items-center gap-4 lg:block">
            <div className="flex size-14 items-center justify-center rounded-full bg-[#FFF0EF] text-2xl font-semibold text-[#FF5F63]">
              {publicEvent.host.name.charAt(0).toUpperCase()}
            </div>
            <div className="lg:mt-3">
              <p className="font-semibold">{publicEvent.host.name}</p>
              <p className="text-sm text-[#6B7280]">Book a time</p>
            </div>
          </div>
          <div className="mt-5 border-t border-[#EEE7DF] pt-5">
            <h1 className="text-xl font-semibold">{publicEvent.eventType.title}</h1>
            <div className="mt-4 space-y-3 text-sm text-[#6B7280]">
              <p className="flex items-center gap-2">
                <Clock3 className="size-4" />
                {publicEvent.eventType.durationMinutes} minutes
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="size-4" />
                {formatLocation(publicEvent.eventType.locationType)}
              </p>
              <p className="flex items-center gap-2">
                <UserRound className="size-4" />
                Your timezone: {guestTimezone}
              </p>
            </div>
          </div>
          {publicEvent.eventType.description ? (
            <p className="mt-6 border-t border-[#EEE7DF] pt-4 text-sm leading-5 text-[#6B7280]">
              {publicEvent.eventType.description}
            </p>
          ) : null}
          {selectedTime ? (
            <div className="mt-10 border-t border-[#EEE7DF] pt-4">
              <p className="text-sm text-[#6B7280]">Selected time</p>
              <div className="mt-2 rounded-lg border border-[#FFB1A6] bg-[#FFF0EF] px-4 py-3">
                <p className="font-semibold">{selectedTime.day}</p>
                <p className="mt-1 text-sm text-[#6B7280]">{selectedTime.range}</p>
              </div>
            </div>
          ) : null}
        </div>
      </aside>

      <section className="px-6 py-8 lg:px-8 lg:py-10">
        {error ? (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
            selectedTime={selectedTime}
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
            onSuccess={confirmBooking}
          />
        ) : null}
        {step === "success" && selectedTime ? (
          <SuccessStep
            eventTitle={publicEvent.eventType.title}
            hostName={publicEvent.host.name}
            email={guest.email}
            selectedTime={selectedTime}
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
    <div>
      <h2 className="text-xl font-semibold">Select a date &amp; time</h2>
      <p className="mt-2 text-sm text-[#6B7280]">All times shown in {timezone}</p>
      <select
        value={timezone}
        onChange={(event) => onTimezoneChange(event.target.value)}
        className="mt-4 h-10 w-full max-w-[280px] rounded-lg border border-[#D1D5DB] bg-[#FFFBF7] px-3 text-sm text-[#6B7280]"
      >
        {[timezone, "Europe/Berlin", "America/New_York", "UTC"].filter(unique).map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <div className="mt-5 grid gap-5 xl:grid-cols-[340px_1fr]">
        <div className="rounded-xl border border-[#EEE7DF] bg-white p-5 shadow-sm">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {dates.map((value) => (
              <button
                key={value}
                className={cn(
                  "h-14 rounded-lg border text-sm font-medium",
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
            {loading ? "Checking availability..." : `${slots.length} slots available`}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {slots.map((slot) => (
              <button
                key={slot.startTimeUtc}
                onClick={() => onSelect(slot)}
                className="h-10 rounded-lg border border-[#D1D5DB] bg-white text-sm font-medium transition hover:border-[#FF5F63]"
              >
                {formatTime(slot.startTimeUtc, timezone)}
              </button>
            ))}
          </div>
          {!loading && slots.length === 0 ? (
            <div className="mt-5 flex min-h-[102px] max-w-[480px] flex-col items-center justify-center rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] text-center">
              <p className="text-sm font-medium text-[#6B7280]">No times available</p>
              <p className="mt-1 text-sm text-[#B8C0CC]">Try selecting a different date.</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DetailsStep({
  selectedTime,
  submitting,
  onBack,
  onSubmit,
}: {
  selectedTime: { day: string; time: string };
  submitting: boolean;
  onBack: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="max-w-[502px]">
      <h2 className="text-xl font-semibold">Your details</h2>
      <p className="mt-2 text-sm text-[#6B7280]">Enter your information to confirm the booking.</p>
      <div className="mt-5 flex items-center gap-4 rounded-lg border border-[#FFB1A6] bg-[#FFF0EF] px-4 py-3">
        <div className="flex size-8 items-center justify-center rounded-full bg-[#FF5F63] text-white">
          <CalendarCheck className="size-4" />
        </div>
        <div>
          <p className="font-semibold">{selectedTime.day} - {selectedTime.time}</p>
        </div>
      </div>
      <form className="mt-5 space-y-3" onSubmit={onSubmit}>
        <PublicField label="Full name" name="name" placeholder="Your full name" />
        <PublicField label="Email address" name="email" placeholder="you@example.com" type="email" />
        <PublicField label="Phone number (optional)" name="phone" placeholder="+1 (555) 000-0000" />
        <Button className="h-12 w-full rounded-lg bg-[#FF5F63] font-semibold text-white" disabled={submitting}>
          {submitting ? "Sending code..." : "Send verification code"}
        </Button>
        <button type="button" className="text-sm font-medium text-[#FF5F63]" onClick={onBack}>
          Back to time selection
        </button>
      </form>
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
  onSuccess,
}: {
  email: string;
  devCode?: string;
  code: string;
  submitting: boolean;
  onCodeChange: (code: string) => void;
  onBack: () => void;
  onSuccess: () => void;
}) {
  return (
    <div className="max-w-[500px]">
      <h2 className="text-2xl font-semibold">Check your email</h2>
      <div className="mt-6 flex items-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-[#FFF0EF] text-[#FF5F63]">
          <CalendarCheck className="size-6" />
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
        onChange={(event) => onCodeChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        className="mt-5 h-14 w-full max-w-[220px] rounded-lg border border-[#D1D5DB] px-4 text-center text-2xl font-semibold tracking-[0.3em] outline-none focus:border-[#FF5F63]"
        placeholder="000000"
      />
      <Button
        className="mt-6 block h-12 w-full max-w-[360px] rounded-lg bg-[#FF5F63] font-semibold text-white"
        onClick={onSuccess}
        disabled={submitting || code.length !== 6}
      >
        {submitting ? "Confirming..." : "Confirm booking"}
      </Button>
      <button className="mt-4 text-sm font-medium text-[#FF5F63]" onClick={onBack}>
        Back
      </button>
    </div>
  );
}

function SuccessStep({
  eventTitle,
  hostName,
  email,
  selectedTime,
  onRestart,
}: {
  eventTitle: string;
  hostName: string;
  email: string;
  selectedTime: { day: string; range: string };
  onRestart: () => void;
}) {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center text-center">
      <div className="flex size-22 items-center justify-center rounded-full bg-[#16A34A] text-white">
        <Check className="size-10" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold">Your booking is confirmed</h2>
      <p className="mt-3 text-sm text-[#6B7280]">A confirmation has been sent to {email}</p>
      <div className="mt-8 w-full max-w-[480px] rounded-xl border border-[#EEE7DF] bg-white p-6 text-left shadow-sm">
        <Detail label="Event" value={eventTitle} />
        <Detail label="Host" value={hostName} />
        <Detail label="Date" value={selectedTime.day} />
        <Detail label="Time" value={selectedTime.range} />
      </div>
      <button className="mt-4 text-sm font-medium text-[#FF5F63]" onClick={onRestart}>
        Book another time
      </button>
    </div>
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
  type = "text",
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
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
