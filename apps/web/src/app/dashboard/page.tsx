"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  Layers,
  Lightbulb,
  MessageSquareQuote,
  Plus,
  ShieldCheck,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import {
  authedApiRequest,
  type AvailabilityRule,
  type EventType,
  type HostBooking,
  type PublicUser,
  publicBookingUrl,
} from "@/lib/api";

type DashboardData = {
  user: PublicUser;
  eventTypes: EventType[];
  availability: AvailabilityRule[];
  bookings: HostBooking[];
  loadedAt: number;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [user, eventTypes, availability, bookings] = await Promise.all([
          authedApiRequest<PublicUser>("/auth/me"),
          authedApiRequest<EventType[]>("/event-types"),
          authedApiRequest<AvailabilityRule[]>("/availability/rules"),
          authedApiRequest<HostBooking[]>("/bookings"),
        ]);

        if (active) {
          setData({
            user,
            eventTypes,
            availability,
            bookings,
            loadedAt: Date.now(),
          });
        }
      } catch (caught) {
        if (active) {
          setError(
            caught instanceof Error ? caught.message : "Could not load dashboard",
          );
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  const upcoming = useMemo(() => {
    const now = data?.loadedAt ?? 0;
    return (data?.bookings ?? [])
      .filter((booking) => booking.status === "CONFIRMED")
      .filter((booking) => new Date(booking.startTimeUtc).getTime() >= now)
      .sort(
        (left, right) =>
          new Date(left.startTimeUtc).getTime() -
          new Date(right.startTimeUtc).getTime(),
      );
  }, [data]);

  if (error) {
    return (
      <AppShell active="Dashboard" title="Dashboard">
        <ErrorBlock title="Dashboard unavailable" text={error} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell active="Dashboard" title="Dashboard">
        <ErrorBlock
          title="Loading dashboard"
          text="Fetching your bookings, services, and availability."
        />
      </AppShell>
    );
  }

  const activeEvents = data.eventTypes.filter((event) => event.isActive);
  const todayBookings = upcoming.filter((booking) =>
    isToday(booking.startTimeUtc, data.loadedAt, data.user.timezone),
  );
  const thisWeekCount = data.bookings.filter((booking) =>
    isThisWeek(booking.startTimeUtc, data.loadedAt),
  ).length;
  const firstActiveEvent = activeEvents[0];
  const publicProfileLink = publicProfileUrl(data.user.slug);
  const firstServiceBookingLink = firstActiveEvent
    ? publicBookingUrl(data.user.slug, firstActiveEvent.slug)
    : null;
  const hostFirstName = data.user.name.split(" ")[0] || "there";
  const hasSetup = activeEvents.length > 0 && data.availability.length > 0;

  return (
    <AppShell
      active="Dashboard"
      title="Dashboard"
      userInitial={data.user.name.charAt(0).toUpperCase()}
      bookingCount={upcoming.length}
    >
      {hasSetup ? (
        <ActiveDashboard
          hostFirstName={hostFirstName}
          loadedAt={data.loadedAt}
          todayBookings={todayBookings}
          upcoming={upcoming}
          thisWeekCount={thisWeekCount}
          activeEventsCount={activeEvents.length}
          publicProfileLink={publicProfileLink}
          firstServiceBookingLink={firstServiceBookingLink}
          timezone={data.user.timezone}
        />
      ) : (
        <SetupDashboard
          hostFirstName={hostFirstName}
          hasServices={activeEvents.length > 0}
          hasSchedule={data.availability.length > 0}
          publicProfileLink={publicProfileLink}
        />
      )}
    </AppShell>
  );
}

function ActiveDashboard({
  hostFirstName,
  loadedAt,
  todayBookings,
  upcoming,
  thisWeekCount,
  activeEventsCount,
  publicProfileLink,
  firstServiceBookingLink,
  timezone,
}: {
  hostFirstName: string;
  loadedAt: number;
  todayBookings: HostBooking[];
  upcoming: HostBooking[];
  thisWeekCount: number;
  activeEventsCount: number;
  publicProfileLink: string;
  firstServiceBookingLink: string | null;
  timezone: string;
}) {
  const firstToday = todayBookings[0] ?? upcoming[0];
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="text-[36px] font-extrabold md:text-[42px]"
            style={{ letterSpacing: "-0.03em", lineHeight: "1.02" }}
          >
            {timeGreeting(hostFirstName)} <span aria-hidden>👋</span>
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            {formatLongDate(loadedAt)} — here&apos;s your day at a glance.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={publicProfileLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-soft bg-surface-card px-4 text-[13px] font-bold text-ink-strong hover:bg-surface-soft"
          >
            <ExternalLink className="size-4" /> View public page
          </a>
          <Link
            href="/dashboard/services"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange px-4 text-[13px] font-bold text-white shadow-sm hover:brightness-105"
          >
            <Plus className="size-4" /> New service
          </Link>
        </div>
      </div>

      <HeroBand
        loadedAt={loadedAt}
        todayCount={todayBookings.length}
        firstBooking={firstToday}
        thisWeekCount={thisWeekCount}
        timezone={timezone}
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={CalendarCheck2}
          iconBg="bg-brand-tint-100 text-brand"
          value={String(thisWeekCount)}
          label="Bookings this week"
          delta={{ tone: "good", text: "+12%" }}
        />
        <Stat
          icon={Star}
          iconBg="bg-purple-tint text-purple"
          value="4.9"
          label="Average rating"
          delta={{ tone: "good", text: "+3%" }}
        />
        <Stat
          icon={Layers}
          iconBg="bg-success-tint-soft text-success-teal"
          value={String(activeEventsCount)}
          label="Services"
          delta={{ tone: "neutral", text: "Active" }}
        />
        <Stat
          icon={MessageSquareQuote}
          iconBg="bg-warning-tint text-warning"
          value={String(upcoming.length)}
          label="Upcoming bookings"
          delta={{ tone: "neutral", text: "Confirmed" }}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.55fr_1fr]">
        <UpcomingTable bookings={upcoming.slice(0, 4)} timezone={timezone} />
        <div className="space-y-5">
          <TodaySchedule bookings={todayBookings} timezone={timezone} />
          <CalendarSyncCard />
          <QuickActions
            publicProfileLink={publicProfileLink}
            firstServiceBookingLink={firstServiceBookingLink}
          />
        </div>
      </div>
    </>
  );
}

function HeroBand({
  loadedAt,
  todayCount,
  firstBooking,
  thisWeekCount,
  timezone,
}: {
  loadedAt: number;
  todayCount: number;
  firstBooking: HostBooking | undefined;
  thisWeekCount: number;
  timezone: string;
}) {
  return (
    <div
      className="relative mt-7 overflow-hidden rounded-[24px] p-7 text-white shadow-sm lg:p-9"
      style={{
        background:
          "linear-gradient(120deg,#FF6267 0%,#FF8252 35%,#C661E0 75%,#A855F7 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute -right-12 -top-12 size-72 rounded-full opacity-20"
        style={{ background: "radial-gradient(closest-side,#fff,transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-16 right-20 size-56 rounded-full opacity-20"
        style={{ background: "radial-gradient(closest-side,#fff,transparent 70%)" }}
      />

      <div className="relative grid items-center gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/85">
            Today — {formatWeekday(loadedAt)}
          </p>
          <h2
            className="mt-2 text-[34px] font-extrabold md:text-[44px]"
            style={{ letterSpacing: "-0.03em", lineHeight: "1.02" }}
          >
            You have <span className="tabular-nums">{todayCount}</span>{" "}
            appointment{todayCount === 1 ? "" : "s"} today.
          </h2>
          <p className="mt-3 max-w-[520px] text-sm leading-[1.6] text-white/90">
            {firstBooking ? (
              <>
                Your first one starts at{" "}
                <strong className="font-bold tabular-nums text-white">
                  {formatTime(firstBooking.startTimeUtc, timezone)}
                </strong>{" "}
                — {firstBooking.guestName.split(" ")[0]} is coming in for{" "}
                {firstBooking.eventType.title}.
              </>
            ) : (
              <>Nothing on the books today — perfect time to share your link.</>
            )}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <GlassStat value={String(todayCount)} label="Today" />
          <GlassStat value={String(thisWeekCount)} label="This week" />
          <GlassStat value="4.9" label="Avg rating" />
        </div>
      </div>
    </div>
  );
}

function GlassStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/15 p-4 text-center backdrop-blur">
      <p className="text-[26px] font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-white/85">
        {label}
      </p>
    </div>
  );
}

function Stat({
  icon: Icon,
  iconBg,
  value,
  label,
  delta,
}: {
  icon: React.ElementType;
  iconBg: string;
  value: string;
  label: string;
  delta?: { tone: "good" | "bad" | "neutral"; text: string };
}) {
  const deltaClass =
    delta?.tone === "good"
      ? "bg-success-mint text-success"
      : delta?.tone === "bad"
        ? "bg-danger-tint-strong text-danger"
        : "bg-line-subtle text-ink-soft";
  return (
    <div className="rounded-2xl border border-line-cream bg-surface-card p-5 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)]">
      <div className="flex items-start justify-between">
        <div className={`flex size-9 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className="size-4" />
        </div>
        {delta ? (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${deltaClass}`}>
            {delta.text}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-[28px] font-bold tabular-nums">{value}</p>
      <p className="text-xs text-ink-soft">{label}</p>
    </div>
  );
}

function UpcomingTable({
  bookings,
  timezone,
}: {
  bookings: HostBooking[];
  timezone: string;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line-cream bg-surface-card shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)]">
      <div className="flex items-center justify-between border-b border-line-cream px-5 py-4">
        <div>
          <p className="text-[15px] font-bold">Upcoming bookings</p>
          <p className="text-[11px] text-ink-muted">
            Next 7 days · all services
          </p>
        </div>
        <Link
          href="/dashboard/bookings"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand"
        >
          View all <ArrowRight className="size-3.5" />
        </Link>
      </div>
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-line-cream bg-surface-page text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          <tr>
            <th className="px-5 py-2.5">Guest</th>
            <th className="px-3 py-2.5">Service</th>
            <th className="px-3 py-2.5">Date &amp; time</th>
            <th className="px-3 py-2.5">Status</th>
            <th className="px-5 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-line-cream">
          {bookings.map((booking) => (
            <tr key={booking.id} className="hover:bg-surface-page">
              <td className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={booking.guestName} />
                  <div className="leading-tight">
                    <p className="font-bold">{booking.guestName}</p>
                    <p className="text-[11px] text-ink-muted">
                      {booking.guestEmail}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3">
                <span className="inline-flex rounded-full bg-brand-tint-100 px-2.5 py-1 text-[11px] font-bold text-brand">
                  {booking.eventType.title}
                </span>
              </td>
              <td className="px-3 tabular-nums">
                <p className="font-semibold">
                  {formatDateTime(booking.startTimeUtc, timezone)}
                </p>
                <p className="text-[11px] text-ink-muted">
                  {booking.eventType.durationMinutes} min
                </p>
              </td>
              <td className="px-3">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success-mint px-2.5 py-1 text-[11px] font-bold text-success">
                  <span className="size-1.5 rounded-full bg-success" />{" "}
                  Confirmed
                </span>
              </td>
              <td className="px-5 text-right">
                <Link
                  href="/dashboard/bookings"
                  className="rounded-lg border border-line-soft px-3 py-1.5 text-[12px] font-bold hover:bg-surface-soft"
                >
                  Manage
                </Link>
              </td>
            </tr>
          ))}
          {bookings.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-8 text-sm text-ink-soft">
                No upcoming bookings yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
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

function TodaySchedule({
  bookings,
  timezone,
}: {
  bookings: HostBooking[];
  timezone: string;
}) {
  return (
    <div className="rounded-2xl border border-line-cream bg-surface-card p-5 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)]">
      <p className="text-[15px] font-bold">Today&apos;s schedule</p>
      <p className="text-[11px] text-ink-muted">
        {bookings.length} appointment{bookings.length === 1 ? "" : "s"}
      </p>

      <div className="mt-4 space-y-3">
        {bookings.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-cream bg-surface-page p-4 text-center text-xs text-ink-muted">
            No bookings today.
          </p>
        ) : null}
        {bookings.map((booking, idx) => (
          <div
            key={booking.id}
            className={
              idx === 0
                ? "flex items-center gap-3 rounded-xl border border-brand-tint-400 bg-brand-tint-50 p-3"
                : "flex items-center gap-3 rounded-xl border border-line-cream bg-surface-page p-3"
            }
          >
            <TimeBadge
              value={formatTime(booking.startTimeUtc, timezone)}
              accent={idx === 0 ? "var(--color-brand)" : "var(--color-purple)"}
            />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-bold">
                {booking.guestName}
              </p>
              <p className="truncate text-[11px] text-ink-soft">
                {booking.eventType.title} · {booking.eventType.durationMinutes} min
              </p>
            </div>
            <span className="size-2 rounded-full bg-success" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TimeBadge({ value, accent }: { value: string; accent: string }) {
  const [time, period] = value.split(/\s+/);
  return (
    <div
      className="flex h-11 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-surface-card"
      style={{ color: accent }}
    >
      <span className="text-[11px] font-bold leading-none tabular-nums">
        {time}
      </span>
      {period ? (
        <span className="mt-0.5 text-[9px] font-bold leading-none">
          {period}
        </span>
      ) : null}
    </div>
  );
}

function CalendarSyncCard() {
  return (
    <div className="rounded-2xl border border-line-cream bg-surface-card p-5 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)]">
      <div className="flex items-start gap-3">
        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-line-subtle text-ink-muted">
          <CalendarCheck2 className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[13px] font-bold">Calendar sync</p>
            <span className="rounded-full bg-success-tint px-1.5 py-0.5 text-[10px] font-bold text-success-strong">
              Ready
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-ink-soft">
            Connect Google or Outlook so Bookvella checks conflicts and writes
            new bookings automatically.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-ink-body">
            <span className="inline-flex items-center gap-1 rounded-full border border-line-cream bg-surface-card px-2 py-0.5">
              <Eye className="size-3 text-ink-muted" /> Check conflicts
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-line-cream bg-surface-card px-2 py-0.5">
              <CalendarPlus className="size-3 text-ink-muted" /> Add new bookings
            </span>
          </div>
        </div>
        <Link
          href="/dashboard/settings#calendar"
          className="shrink-0 rounded-md p-1.5 text-ink-muted hover:text-ink-strong"
          aria-label="Open calendar settings"
        >
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <p className="mt-3 border-t border-line-cream pt-3 text-[11px] text-ink-muted">
        <ShieldCheck className="inline size-3 align-[-2px] text-success" />{" "}
        Guests never see your private events — only that a time is busy.
      </p>
    </div>
  );
}

function QuickActions({
  publicProfileLink,
  firstServiceBookingLink,
}: {
  publicProfileLink: string;
  firstServiceBookingLink: string | null;
}) {
  async function copyLink() {
    if (!firstServiceBookingLink) {
      toast.error("Create an active service first");
      return;
    }
    try {
      await navigator.clipboard.writeText(firstServiceBookingLink);
      toast.success("Booking link copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <div className="rounded-2xl border border-line-cream bg-surface-card p-5 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)]">
      <p className="text-[15px] font-bold">Quick actions</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={copyLink}
          className="flex flex-col items-start gap-3 rounded-xl border border-line-cream bg-surface-page p-4 text-left transition hover:border-brand/40"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange text-white">
            <Copy className="size-4" />
          </span>
          <span className="text-[13px] font-bold">Copy booking link</span>
        </button>
        <Link
          href="/dashboard/services"
          className="flex flex-col items-start gap-3 rounded-xl border border-line-cream bg-surface-page p-4 text-left transition hover:border-brand/40"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple to-purple-strong text-white">
            <Plus className="size-4" />
          </span>
          <span className="text-[13px] font-bold">New service</span>
        </Link>
        <Link
          href="/dashboard/availability"
          className="flex flex-col items-start gap-3 rounded-xl border border-line-cream bg-surface-page p-4 text-left transition hover:border-brand/40"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-success-bright to-success-teal text-white">
            <CalendarClock className="size-4" />
          </span>
          <span className="text-[13px] font-bold">Edit availability</span>
        </Link>
        <a
          href={publicProfileLink}
          target="_blank"
          rel="noreferrer"
          className="flex flex-col items-start gap-3 rounded-xl border border-line-cream bg-surface-page p-4 text-left transition hover:border-brand/40"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-warning-amber to-orange-600 text-white">
            <ExternalLink className="size-4" />
          </span>
          <span className="text-[13px] font-bold">View public page</span>
        </a>
      </div>
    </div>
  );
}

function SetupDashboard({
  hostFirstName,
  hasServices,
  hasSchedule,
  publicProfileLink,
}: {
  hostFirstName: string;
  hasServices: boolean;
  hasSchedule: boolean;
  publicProfileLink: string;
}) {
  const completed = [true, hasServices, hasSchedule, false].filter(Boolean)
    .length;
  const percent = (completed / 4) * 100;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="text-[36px] font-extrabold md:text-[42px]"
            style={{ letterSpacing: "-0.03em", lineHeight: "1.02" }}
          >
            Welcome to Bookvella, {hostFirstName}!
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            You&apos;re a few steps away from sharing your booking link with the
            world.
          </p>
        </div>
        <a
          href={publicProfileLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-xl border border-line-soft bg-surface-card px-4 text-[13px] font-bold text-ink-strong hover:bg-surface-soft"
        >
          <ExternalLink className="size-4" /> Preview public page
        </a>
      </div>

      <div
        className="relative mt-7 overflow-hidden rounded-[24px] p-7 text-white shadow-sm lg:p-9"
        style={{
          background:
            "linear-gradient(120deg,#FF6267 0%,#FF8252 35%,#C661E0 75%,#A855F7 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 size-72 rounded-full opacity-20"
          style={{ background: "radial-gradient(closest-side,#fff,transparent 70%)" }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold text-white backdrop-blur">
            <span className="size-1.5 rounded-full bg-success-bright" /> Getting
            started
          </span>
          <h2
            className="mt-5 text-[32px] font-extrabold md:text-[40px]"
            style={{ letterSpacing: "-0.03em", lineHeight: "1.02" }}
          >
            Let&apos;s get your profile ready.
          </h2>
          <p className="mt-3 max-w-[560px] text-sm leading-[1.6] text-white/90">
            Four quick steps and you&apos;ll have a polished page ready to share.
            Should take less than five minutes.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-line-cream bg-surface-card p-6 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.10)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[16px] font-bold">Set up your profile</p>
            <p className="text-xs text-ink-soft">
              Complete these steps before sharing your link.
            </p>
          </div>
          <div className="min-w-[180px]">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              <span>Progress</span>
              <span>
                {completed} of 4 complete
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-line-subtle">
              <div
                className="h-full bg-gradient-to-r from-brand-coral to-brand-orange"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StepCard
            state="done"
            label="Personalize profile"
            text="Photo, name, and short bio so guests know who they're booking with."
          />
          <StepCard
            state={hasServices ? "done" : "up-next"}
            label="Create first service"
            text="Add the service you offer — name, duration, and what's included."
          />
          <StepCard
            state={hasSchedule ? "done" : hasServices ? "up-next" : "soon"}
            label="Set booking schedule"
            text="Choose when guests can book you. Use a preset or customize your hours."
          />
          <StepCard
            state={hasServices && hasSchedule ? "up-next" : "soon"}
            label="Share your link"
            text="Copy your public booking link and share it on Instagram, WhatsApp, or your bio."
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link
            href={
              hasServices
                ? hasSchedule
                  ? "/dashboard/profile"
                  : "/dashboard/availability"
                : "/dashboard/services"
            }
            className="inline-flex h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange px-5 text-sm font-bold text-white shadow-sm hover:brightness-105"
          >
            Continue setup <ArrowRight className="size-4" />
          </Link>
          <a
            href={publicProfileLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded-xl border border-line-soft bg-surface-card px-5 text-sm font-bold text-ink-strong hover:bg-surface-soft"
          >
            <ExternalLink className="size-4" /> Preview public page
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-warning-border bg-surface-amber p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-warning-tint text-warning">
              <Lightbulb className="size-4" />
            </span>
            <div>
              <p className="text-sm font-bold">
                Tip — write your services like a menu
              </p>
              <p className="mt-1.5 text-[12px] leading-[1.55] text-warning-strong/80">
                Use a name guests will immediately understand. &ldquo;60-min
                massage&rdquo; or &ldquo;1-on-1 coaching call&rdquo; reads better
                than internal codes.
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-purple-border bg-purple-wash p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-purple-wash-strong text-purple-strong">
              <ShieldCheck className="size-4" />
            </span>
            <div>
              <p className="text-sm font-bold">Every booking is email-verified</p>
              <p className="mt-1.5 text-[12px] leading-[1.55] text-ink-soft">
                Guests confirm with a 6-digit code before a slot is held. No
                bots, no fake bookings, no ghost calendar.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StepCard({
  state,
  label,
  text,
}: {
  state: "done" | "up-next" | "soon";
  label: string;
  text: string;
}) {
  if (state === "done") {
    return (
      <div className="relative rounded-[18px] border border-success-border bg-success-tint p-5">
        <div className="flex items-start justify-between">
          <span className="flex size-9 items-center justify-center rounded-xl bg-success text-white">
            <Check className="size-4" />
          </span>
          <span className="rounded-full bg-success-tint-strong px-2 py-1 text-[10px] font-bold text-success-deep">
            Done
          </span>
        </div>
        <p className="mt-5 text-sm font-bold text-success-deep">{label}</p>
        <p className="mt-1.5 text-[12px] leading-[1.55] text-success-strong/80">
          {text}
        </p>
      </div>
    );
  }
  if (state === "up-next") {
    return (
      <div className="relative rounded-[18px] border border-brand-tint-300 bg-danger-warm-tint p-5">
        <div className="flex items-start justify-between">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange text-xs font-bold text-white">
            →
          </span>
          <span className="rounded-full border border-brand-tint-300 bg-surface-card px-2 py-1 text-[10px] font-bold text-brand">
            Up next
          </span>
        </div>
        <p className="mt-5 text-sm font-bold text-brand">{label}</p>
        <p className="mt-1.5 text-[12px] leading-[1.55] text-ink-soft">{text}</p>
      </div>
    );
  }
  return (
    <div className="relative rounded-[18px] border border-line-cream bg-surface-page p-5 text-ink-soft">
      <div className="flex items-start justify-between">
        <span className="flex size-9 items-center justify-center rounded-xl bg-line-subtle text-xs font-bold text-ink-muted">
          •
        </span>
        <span className="rounded-full bg-line-subtle px-2 py-1 text-[10px] font-bold text-ink-muted">
          Soon
        </span>
      </div>
      <p className="mt-5 text-sm font-bold">{label}</p>
      <p className="mt-1.5 text-[12px] leading-[1.55]">{text}</p>
    </div>
  );
}

function ErrorBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[24px] border border-line-cream bg-surface-card p-8 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-ink-soft">{text}</p>
    </div>
  );
}

function timeGreeting(firstName: string) {
  const hour = new Date().getHours();
  if (hour < 12) return `Good morning, ${firstName}`;
  if (hour < 17) return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

function formatLongDate(value: number) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatWeekday(value: number) {
  return new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(
    new Date(value),
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

function publicProfileUrl(hostSlug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";
  return `${appUrl.replace(/\/$/, "")}/${hostSlug}`;
}

function isThisWeek(value: string, referenceMs: number) {
  const date = new Date(value);
  const now = new Date(referenceMs);
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return date >= start && date < end;
}

function isToday(value: string, referenceMs: number, timeZone: string) {
  const date = new Date(value);
  const ref = new Date(referenceMs);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(date) === fmt.format(ref);
}
