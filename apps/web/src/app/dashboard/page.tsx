"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Copy,
  ExternalLink,
  Grid2X2,
  Plus,
  Table2,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
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
            caught instanceof Error
              ? caught.message
              : "Could not load dashboard",
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
        <StateBlock title="Dashboard unavailable" text={error} />
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell active="Dashboard" title="Dashboard">
        <StateBlock
          title="Loading dashboard"
          text="Fetching your bookings, services, and availability."
        />
      </AppShell>
    );
  }

  const activeEvents = data.eventTypes.filter((event) => event.isActive);
  const thisWeekCount = data.bookings.filter((booking) =>
    isThisWeek(booking.startTimeUtc, data.loadedAt),
  ).length;
  const firstPublicLink = activeEvents[0]
    ? publicBookingUrl(data.user.slug, activeEvents[0].slug)
    : null;

  return (
    <AppShell
      active="Dashboard"
      title="Dashboard"
      userInitial={data.user.name.charAt(0).toUpperCase()}
    >
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[40px] font-bold leading-tight tracking-normal text-[#111827]">
              Good morning, {data.user.name.split(" ")[0]}
            </h2>
            <p className="mt-1 text-lg text-[#6B7280]">
              {formatLongDate(data.loadedAt)} - here is your day at a glance
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href={firstPublicLink ?? "/dashboard/event-types"}
              className="inline-flex h-14 items-center gap-2 rounded-2xl border border-[#E8DED7] bg-white px-7 text-base font-bold shadow-sm"
            >
              <ExternalLink className="size-4" />
              View public page
            </Link>
            <Link
              href="/dashboard/event-types"
              className="inline-flex h-14 items-center gap-2 rounded-2xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-7 text-base font-bold text-white"
            >
              <Plus className="size-4" />
              New service
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-10 rounded-[28px] bg-gradient-to-r from-[#FF6267] via-[#FF8A4C] to-[#A855F7] p-8 text-white lg:flex lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-white/80">
            Today
          </p>
          <h3 className="mt-3 text-[34px] font-bold leading-tight">
            You have {upcoming.length} appointments coming up
          </h3>
          <p className="mt-2 text-lg text-white/90">
            {upcoming[0]
              ? `Your next one starts ${formatDateTime(upcoming[0].startTimeUtc, data.user.timezone)}.`
              : "Create a service and share your booking link to get started."}
          </p>
        </div>
        <div className="mt-8 grid grid-cols-3 gap-4 lg:mt-0">
          <HeroStat value={String(upcoming.length)} label="Upcoming" />
          <HeroStat value={String(thisWeekCount)} label="This week" />
          <HeroStat value={String(activeEvents.length)} label="Services" />
        </div>
      </section>

      <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Clock3}
          value={String(thisWeekCount)}
          label="Bookings this week"
          hint="Confirmed and cancelled"
        />
        <Metric
          icon={Table2}
          value={String(upcoming.length)}
          label="Upcoming"
          hint={
            upcoming[0]
              ? formatDateTime(upcoming[0].startTimeUtc, data.user.timezone)
              : "No upcoming bookings"
          }
          tone="purple"
        />
        <Metric
          icon={CalendarDays}
          value={String(activeEvents.length)}
          label="Active services"
          hint={`${data.eventTypes.length} total`}
          tone="green"
        />
        <Metric
          icon={Grid2X2}
          value={String(data.availability.length)}
          label="Schedule ranges"
          hint={
            data.availability.length ? "Booking schedule set" : "Not configured"
          }
          tone="amber"
        />
      </section>

      <section className="mt-9">
        <div className="mb-0 flex items-center justify-between rounded-t-[24px] border border-[#EEE7DF] bg-white px-6 py-5">
          <h3 className="text-xl font-bold">Upcoming bookings</h3>
          <Link
            href="/dashboard/bookings"
            className="text-sm font-bold text-[#FF5F63]"
          >
            View all
          </Link>
        </div>
        <div className="overflow-hidden rounded-b-[24px] border-x border-b border-[#EEE7DF] bg-white shadow-sm">
          <div className="grid grid-cols-[1.2fr_1.2fr_1.2fr_120px] bg-[#FFFBF7] px-6 py-4 text-xs font-bold uppercase tracking-wide text-[#9CA3AF] max-md:hidden">
            <span>Guest</span>
            <span>Event</span>
            <span>Date &amp; Time</span>
            <span>Status</span>
          </div>
          {upcoming.slice(0, 4).map((booking) => (
            <div
              key={booking.id}
              className="grid items-center gap-3 border-t border-[#EEE7DF] px-6 py-4 text-sm md:grid-cols-[1.2fr_1.2fr_1.2fr_120px]"
            >
              <GuestCell name={booking.guestName} email={booking.guestEmail} />
              <div>
                <p className="font-medium">{booking.eventType.title}</p>
                <p className="text-xs text-[#6B7280] md:hidden">
                  {formatDateTime(booking.startTimeUtc, data.user.timezone)}
                </p>
              </div>
              <p className="text-[#6B7280] max-md:hidden">
                {formatDateTime(booking.startTimeUtc, data.user.timezone)}
              </p>
              <StatusBadge status="confirmed">Confirmed</StatusBadge>
            </div>
          ))}
          {upcoming.length === 0 ? (
            <div className="border-t border-[#EEE7DF] px-6 py-8 text-sm text-[#6B7280]">
              No upcoming bookings yet.
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-9">
        <h3 className="mb-4 text-xl font-bold">Quick actions</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <QuickAction
            href="/dashboard/event-types"
            icon={Plus}
            title="Create service"
            text="Add a bookable offer"
          />
          <QuickAction
            href="/dashboard/availability"
            icon={CalendarDays}
            title="Edit schedule"
            text="Update your bookable hours"
          />
          <button
            className="flex min-h-[76px] items-center gap-3 rounded-lg border border-[#EEE7DF] bg-white p-4 text-left shadow-sm transition hover:border-[#FF5F63]/40"
            onClick={() => {
              if (!firstPublicLink) {
                toast.error("Create an active service first");
                return;
              }
              navigator.clipboard.writeText(firstPublicLink);
              toast.success("Booking link copied");
            }}
          >
            <ActionIcon icon={Copy} />
            <ActionCopy
              title="Copy booking link"
              text="Share your public link"
            />
          </button>
          <QuickAction
            href="/dashboard/bookings"
            icon={Clock3}
            title="View all bookings"
            text="See your full history"
          />
        </div>
      </section>
    </AppShell>
  );
}

function StateBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-[24px] border border-[#EEE7DF] bg-white p-8 shadow-sm">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-[#6B7280]">{text}</p>
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-[120px] rounded-[20px] bg-white/18 px-6 py-5 text-center backdrop-blur">
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm font-bold text-white/80">{label}</p>
    </div>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
  hint,
  tone = "teal",
}: {
  icon: React.ElementType;
  value: string;
  label: string;
  hint: string;
  tone?: "teal" | "amber" | "green" | "purple";
}) {
  const bg =
    tone === "amber"
      ? "bg-[#FEF3C7] text-[#F59E0B]"
      : tone === "green"
        ? "bg-[#CCFBF1] text-[#14B8A6]"
        : tone === "purple"
          ? "bg-[#F0E6FF] text-[#A855F7]"
          : "bg-[#FFF0EF] text-[#FF5F63]";
  return (
    <div className="rounded-[24px] border border-[#EEE7DF] bg-white p-6 shadow-sm">
      <div className="flex h-full flex-col items-start gap-5">
        <div
          className={`flex size-12 items-center justify-center rounded-2xl ${bg}`}
        >
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-3xl font-bold leading-none">{value}</p>
          <p className="mt-1 text-sm text-[#6B7280]">{label}</p>
          <p className="mt-0.5 text-xs text-[#6B7280]">{hint}</p>
        </div>
      </div>
    </div>
  );
}

function GuestCell({ name, email }: { name: string; email: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C4DFF] to-[#A855F7] text-sm font-bold text-white">
        {name[0]}
      </div>
      <div>
        <p className="font-semibold">{name}</p>
        <p className="text-xs text-[#6B7280]">{email}</p>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  text,
}: {
  href: string;
  icon: React.ElementType;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[92px] items-center gap-4 rounded-[20px] border border-[#EEE7DF] bg-white p-5 text-left shadow-sm transition hover:border-[#FF5F63]/40"
    >
      <ActionIcon icon={icon} />
      <ActionCopy title={title} text={text} />
    </Link>
  );
}

function ActionIcon({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <span className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#FF6267] to-[#FF8A4C] text-white">
      <Icon className="size-4" />
    </span>
  );
}

function ActionCopy({ title, text }: { title: string; text: string }) {
  return (
    <span>
      <span className="block text-sm font-bold">{title}</span>
      <span className="block text-xs text-[#6B7280]">{text}</span>
    </span>
  );
}

function formatLongDate(value: number) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
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
