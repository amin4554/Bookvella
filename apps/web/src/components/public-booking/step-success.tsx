"use client";

import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  Check,
  Download,
  Info,
  MailCheck,
  MapPin,
  Scissors,
  UserRound,
} from "lucide-react";
import type { PublicEvent } from "@/lib/api";
import {
  downloadIcs,
  formatFullDateKey,
  formatGuestTime,
  formatLocationLabel,
  googleCalendarUrl,
} from "./helpers";

type Props = {
  data: PublicEvent;
  email: string;
  timezone: string;
  selectedDateKey: string;
  selectedStartUtc: string;
  selectedEndUtc: string;
};

export function StepSuccess({
  data,
  email,
  timezone,
  selectedDateKey,
  selectedStartUtc,
  selectedEndUtc,
}: Props) {
  const startLabel = formatGuestTime(selectedStartUtc, timezone);
  const dayLabel = formatFullDateKey(selectedDateKey);
  const locationLabel =
    data.eventType.locationDetails ??
    formatLocationLabel(data.eventType.locationType);
  const calendarHref = googleCalendarUrl({
    title: data.eventType.title,
    hostName: data.host.name,
    location: locationLabel,
    startTimeUtc: selectedStartUtc,
    endTimeUtc: selectedEndUtc,
  });

  return (
    <section className="mx-auto max-w-[560px] py-6 text-center">
      <div
        className="mx-auto grid size-20 place-items-center rounded-full"
        style={{
          background:
            "linear-gradient(135deg,#10B981 0%,#0EA5E9 100%)",
        }}
      >
        <Check className="size-9 text-white" strokeWidth={3} />
      </div>
      <h1
        className="mt-6 text-[40px] font-extrabold md:text-[52px]"
        style={{ letterSpacing: "-0.03em", lineHeight: "1" }}
      >
        You&apos;re all booked!
      </h1>
      <p className="mt-3 text-[14.5px] leading-[1.55] text-ink-soft">
        Your appointment with {data.host.name.split(/\s+/)[0]} is confirmed. A
        confirmation email is on its way to{" "}
        <strong className="text-ink-strong">{email}</strong> right now.
      </p>

      <div className="mt-8 rounded-2xl border border-line-cream bg-surface-card p-6 text-left shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          Booking details
        </p>

        <div className="mt-5 space-y-4">
          <DetailRow
            tint="bg-brand-tint-100 text-brand"
            icon={<CalendarDays className="size-5" />}
            label="Date & time"
            value={`${dayLabel} — ${startLabel}`}
          />
          <DetailRow
            tint="bg-purple-tint text-purple-strong"
            icon={<Scissors className="size-5" />}
            label="Service"
            value={`${data.eventType.title} · ${data.eventType.durationMinutes} minutes`}
          />
          <DetailRow
            tint="bg-success-tint-soft text-success-teal"
            icon={<MapPin className="size-5" />}
            label="Location"
            value={locationLabel}
          />
          <DetailRow
            tint="bg-success-tint-strong text-success-strong"
            icon={<MailCheck className="size-5" />}
            label="Confirmation sent to"
            value={email}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a
          href={calendarHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line-soft bg-surface-card px-5 text-[14px] font-bold text-ink-strong hover:bg-surface-soft"
        >
          <CalendarPlus className="size-4" /> Add to Google Calendar
        </a>
        <button
          type="button"
          onClick={() =>
            downloadIcs({
              title: data.eventType.title,
              hostName: data.host.name,
              location: locationLabel,
              startTimeUtc: selectedStartUtc,
              endTimeUtc: selectedEndUtc,
            })
          }
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line-soft bg-surface-card px-5 text-[14px] font-bold text-ink-strong hover:bg-surface-soft"
        >
          <Download className="size-4" /> Download .ics
        </button>
      </div>
      <Link
        href={`/${data.host.slug}`}
        className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-coral to-brand-orange px-5 text-[14px] font-bold text-white shadow-[0_12px_24px_-10px_rgba(255,95,99,0.5)] hover:brightness-105"
      >
        <UserRound className="size-4" /> Visit {data.host.name.split(/\s+/)[0]}
        &apos;s page
      </Link>

      <div className="mt-6 flex items-start gap-3 rounded-2xl border border-line-cream bg-surface-page p-4 text-left">
        <Info className="mt-0.5 size-4 text-ink-muted" />
        <p className="text-[12.5px] leading-[1.55] text-ink-soft">
          Plans change — you can cancel for free up to 2 hours before. Your
          confirmation email has a one-click cancellation link, no login needed.
        </p>
      </div>
    </section>
  );
}

function DetailRow({
  tint,
  icon,
  label,
  value,
}: {
  tint: string;
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className={`grid size-10 place-items-center rounded-xl ${tint}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[12px] text-ink-muted">{label}</p>
        <p className="truncate text-[15px] font-bold">{value}</p>
      </div>
    </div>
  );
}
