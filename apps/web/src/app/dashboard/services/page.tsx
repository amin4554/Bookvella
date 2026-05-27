"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Calendar,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Grid2x2,
  Layers,
  List as ListIcon,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Scissors,
  Search,
  Share2,
  Star,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import {
  authedApiRequest,
  type EventType,
  type LocationType,
  type PublicUser,
  publicBookingUrl,
} from "@/lib/api";

const cardPalettes = [
  {
    heroBg: "linear-gradient(135deg,#FFE0DA 0%,#FFD3A6 60%,#FFC9C2 100%)",
    avatarBg: "linear-gradient(135deg,#FF6267,#FF8A4C)",
    pricePill: "text-brand",
    copyText: "text-brand border-brand-tint-400",
    chip: "bg-brand-tint-100 text-brand",
  },
  {
    heroBg: "linear-gradient(135deg,#F4EAFF 0%,#E1CFFA 60%,#D7CDF8 100%)",
    avatarBg: "linear-gradient(135deg,#A855F7,#7C4DFF)",
    pricePill: "text-purple",
    copyText: "text-purple border-purple-border",
    chip: "bg-purple-tint text-purple",
  },
  {
    heroBg: "linear-gradient(135deg,#D7F2EA 0%,#B6E4F2 60%,#CFE9E0 100%)",
    avatarBg: "linear-gradient(135deg,#10B981,#0D9488)",
    pricePill: "text-success-teal",
    copyText: "text-success-teal border-success-aqua-border",
    chip: "bg-success-tint-soft text-success-teal",
  },
  {
    heroBg: "linear-gradient(135deg,#FFE9C7 0%,#FFD08A 60%,#FFC9C2 100%)",
    avatarBg: "linear-gradient(135deg,#F59E0B,#EA580C)",
    pricePill: "text-warning",
    copyText: "text-warning border-warning-border",
    chip: "bg-warning-tint text-warning",
  },
];

export default function ServicesPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [deleting, setDeleting] = useState<EventType | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [me, eventTypes] = await Promise.all([
          authedApiRequest<PublicUser>("/auth/me"),
          authedApiRequest<EventType[]>("/event-types"),
        ]);
        setUser(me);
        setEvents(eventTypes);
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Could not load services",
        );
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = events.filter((event) =>
    event.title.toLowerCase().includes(query.toLowerCase()),
  );
  const active = filtered.filter((event) => event.isActive);
  const inactive = filtered.filter((event) => !event.isActive);

  async function toggleActive(event: EventType, target: boolean) {
    setBusyId(event.id);
    try {
      const updated = await authedApiRequest<EventType>(
        `/event-types/${event.id}`,
        { method: "PATCH", body: JSON.stringify({ isActive: target }) },
      );
      setEvents((current) =>
        current.map((e) => (e.id === updated.id ? updated : e)),
      );
      toast.success(target ? "Service reactivated" : "Service deactivated");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not update service",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function deleteService(event: EventType) {
    setBusyId(event.id);
    try {
      await authedApiRequest<{ success: boolean }>(`/event-types/${event.id}`, {
        method: "DELETE",
      });
      setEvents((current) => current.filter((e) => e.id !== event.id));
      toast.success("Service deleted");
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Could not delete service",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell
      active="Services"
      title="Services"
      userInitial={user?.name.charAt(0).toUpperCase() ?? "B"}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1
            className="text-[36px] font-extrabold md:text-[42px]"
            style={{ letterSpacing: "-0.03em", lineHeight: "1.02" }}
          >
            Services
          </h1>
          <p className="mt-2 text-sm text-ink-soft">
            The things guests can book with you. Each gets its own shareable
            link.
          </p>
        </div>
        <Link
          href="/dashboard/services/new"
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange px-5 text-[13px] font-bold text-white shadow-sm hover:brightness-105"
        >
          <Plus className="size-4" /> New service
        </Link>
      </div>

      {error ? <InlineState title="Services unavailable" text={error} /> : null}
      {loading ? (
        <InlineState title="Loading services" text="Fetching your services." />
      ) : null}

      {!loading && !error && events.length === 0 ? <EmptyState /> : null}

      {!loading && !error && events.length > 0 ? (
        <>
          <div className="mb-5 mt-7 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line-cream bg-surface-card p-4 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
            <div className="flex items-center gap-4 text-[13px]">
              <span className="text-ink-soft">
                <span className="font-bold text-ink-strong tabular-nums">
                  {events.length}
                </span>{" "}
                total
              </span>
              <span className="h-4 w-px bg-line-cream" />
              <span className="text-success">
                <span className="font-bold tabular-nums">{active.length}</span>{" "}
                active
              </span>
              <span className="h-4 w-px bg-line-cream" />
              <span className="text-ink-muted">
                <span className="font-bold tabular-nums">{inactive.length}</span>{" "}
                inactive
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search services…"
                  className="h-9 w-[240px] rounded-lg border border-line-soft bg-surface-card pl-9 pr-3 text-[13px] outline-none focus:border-brand focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
                />
              </div>
              <div className="inline-flex rounded-lg border border-line-soft bg-surface-card p-0.5">
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-label="Grid view"
                  aria-pressed={view === "grid"}
                  className={`rounded-md px-2.5 py-1 ${view === "grid" ? "bg-ink-strong text-surface-card" : "text-ink-muted"}`}
                >
                  <Grid2x2 className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-label="List view"
                  aria-pressed={view === "list"}
                  className={`rounded-md px-2.5 py-1 ${view === "list" ? "bg-ink-strong text-surface-card" : "text-ink-muted"}`}
                >
                  <ListIcon className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {active.length > 0 ? (
            <>
              <SectionHeading label="Active" count={active.length} />
              {view === "grid" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {active.map((event, idx) => (
                    <ServiceCard
                      key={event.id}
                      event={event}
                      user={user}
                      palette={cardPalettes[idx % cardPalettes.length]}
                      busy={busyId === event.id}
                      onDeactivate={() => toggleActive(event, false)}
                      onDelete={() => setDeleting(event)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {active.map((event) => (
                    <CompactRow
                      key={event.id}
                      event={event}
                      user={user}
                      busy={busyId === event.id}
                      onDeactivate={() => toggleActive(event, false)}
                      onDelete={() => setDeleting(event)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : null}

          {inactive.length > 0 ? (
            <>
              <SectionHeading
                label="Inactive"
                count={inactive.length}
                className="mt-10"
              />
              <div className="space-y-3">
                {inactive.map((event) => (
                  <InactiveRow
                    key={event.id}
                    event={event}
                    busy={busyId === event.id}
                    onReactivate={() => toggleActive(event, true)}
                    onDelete={() => setDeleting(event)}
                  />
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {deleting ? (
        <DeleteConfirm
          event={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteService(deleting);
            setDeleting(null);
          }}
        />
      ) : null}
    </AppShell>
  );
}

function SectionHeading({
  label,
  count,
  className,
}: {
  label: string;
  count: number;
  className?: string;
}) {
  return (
    <div className={`mb-3 flex items-baseline gap-3 px-1 ${className ?? ""}`}>
      <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </h2>
      <span className="text-[11px] text-ink-muted tabular-nums">{count}</span>
    </div>
  );
}

function ServiceCard({
  event,
  user,
  palette,
  busy,
  onDeactivate,
  onDelete,
}: {
  event: EventType;
  user: PublicUser | null;
  palette: (typeof cardPalettes)[number];
  busy: boolean;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fullLink = user ? publicBookingUrl(user.slug, event.slug) : "";
  const displayLink = fullLink.replace(/^https?:\/\//, "");
  const iconNode = renderServiceIcon(event.title, event.locationType);

  async function copyLink() {
    if (!fullLink) return;
    try {
      await navigator.clipboard.writeText(fullLink);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  // Close the action menu when clicking outside.
  useEffect(() => {
    if (!menuOpen) return;
    function close(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (!target.closest(`[data-svc-menu="${event.target ? "" : ""}"]`)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <article className="overflow-hidden rounded-2xl border border-line-cream bg-surface-card shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
      <div className="relative h-28" style={{ background: palette.heroBg }}>
        <div
          className="absolute -bottom-6 left-5 flex size-14 items-center justify-center overflow-hidden rounded-2xl text-white shadow-[0_12px_32px_-16px_rgba(17,24,39,0.20)]"
          style={{ background: palette.avatarBg }}
        >
          {event.imageUrl ? (
            <div
              className="size-full bg-cover bg-center"
              style={{ backgroundImage: `url(${event.imageUrl})` }}
            />
          ) : (
            iconNode
          )}
        </div>
        {event.isFeatured ? (
          <span className="absolute left-24 top-4 inline-flex items-center gap-1 rounded-full bg-warning-tint px-2 py-1 text-[10px] font-bold text-warning">
            <Star className="size-3 fill-warning-amber text-warning-amber" /> Featured
          </span>
        ) : null}
        <PricePill
          priceType={event.priceType}
          priceAmount={event.priceAmount}
          priceMaxAmount={event.priceMaxAmount}
          priceCurrency={event.priceCurrency}
          className={`absolute right-4 top-4 ${palette.pricePill}`}
        />
      </div>
      <div className="px-5 pb-5 pt-9">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold">{event.title}</h3>
            <p className="mt-0.5 text-xs text-ink-soft tabular-nums">
              {event.durationMinutes} min ·{" "}
              {formatLocationLabel(event.locationType)}
              {event.locationDetails ? ` · ${event.locationDetails}` : ""}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success-mint px-2.5 py-1 text-[11px] font-bold text-success">
            <span className="size-1.5 rounded-full bg-success" /> Active
          </span>
        </div>
        {event.description ? (
          <p className="mt-3 line-clamp-2 text-[13px] leading-[1.6] text-ink-body">
            {event.description}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-1.5">
          {event.category ? (
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${palette.chip}`}
            >
              {event.category}
            </span>
          ) : null}
          {event.directLinkOnly ? (
            <span className="rounded-full bg-line-subtle px-2.5 py-1 text-[11px] font-bold text-ink-body">
              Direct link only
            </span>
          ) : null}
        </div>

        {fullLink ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-line-cream bg-surface-page px-3 py-2.5">
            <p className="truncate text-[11px] text-ink-soft tabular-nums">
              {displayLink}
            </p>
            <button
              type="button"
              onClick={copyLink}
              className={`inline-flex items-center gap-1.5 rounded-md border bg-surface-card px-2 py-1 text-[11px] font-bold ${palette.copyText}`}
            >
              <Copy className="size-3" /> Copy
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line-cream pt-4">
          <p className="text-[11px] text-ink-muted">
            <span className="font-semibold tabular-nums text-ink-strong">
              {event.bufferBeforeMinutes + event.bufferAfterMinutes}
            </span>{" "}
            min buffer · created{" "}
            <span className="tabular-nums">
              {new Date(event.createdAt).toLocaleDateString()}
            </span>
          </p>
          <div className="flex items-center gap-1.5">
            <Link
              href={`/dashboard/services/${event.id}/edit`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-soft bg-surface-card px-2.5 text-[12px] font-bold text-ink-strong hover:bg-surface-soft"
            >
              <Pencil className="size-3.5" /> Edit
            </Link>
            <button
              type="button"
              onClick={onDeactivate}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line-soft bg-surface-card px-2.5 text-[12px] font-bold text-ink-strong hover:bg-surface-soft disabled:opacity-50"
            >
              <EyeOff className="size-3.5" /> Deactivate
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((value) => !value);
                }}
                aria-label="More"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-line-soft bg-surface-card text-ink-soft hover:bg-surface-soft"
              >
                <MoreHorizontal className="size-4" />
              </button>
              {menuOpen ? (
                <div className="absolute bottom-[calc(100%+6px)] right-0 z-30 w-[220px] rounded-xl border border-line-cream bg-surface-card p-1.5 shadow-[0_24px_48px_-20px_rgba(17,24,39,0.16)]">
                  <button
                    type="button"
                    onClick={async () => {
                      await copyLink();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-ink-body hover:bg-surface-page hover:text-ink-strong"
                  >
                    <Share2 className="size-4 text-ink-muted" /> Copy share link
                  </button>
                  <a
                    href={fullLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-ink-body hover:bg-surface-page hover:text-ink-strong"
                  >
                    <ExternalLink className="size-4 text-ink-muted" /> View on
                    public page
                  </a>
                  <div className="my-1 h-px bg-line-cream" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-danger hover:bg-danger-tint"
                  >
                    <Trash2 className="size-4 text-danger-strong" /> Delete service
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function CompactRow({
  event,
  user,
  busy,
  onDeactivate,
  onDelete,
}: {
  event: EventType;
  user: PublicUser | null;
  busy: boolean;
  onDeactivate: () => void;
  onDelete: () => void;
}) {
  const fullLink = user ? publicBookingUrl(user.slug, event.slug) : "";
  return (
    <article className="flex flex-wrap items-center gap-4 rounded-2xl border border-line-cream bg-surface-card px-4 py-3 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.06)]">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold">{event.title}</p>
        <p className="mt-0.5 text-[12px] text-ink-soft tabular-nums">
          {event.durationMinutes} min · {formatLocationLabel(event.locationType)}{" "}
          ·{" "}
          <PricePillText
            priceType={event.priceType}
            priceAmount={event.priceAmount}
            priceMaxAmount={event.priceMaxAmount}
            priceCurrency={event.priceCurrency}
          />
        </p>
      </div>
      {fullLink ? (
        <p className="hidden truncate text-[11px] text-ink-muted sm:block sm:max-w-[260px] tabular-nums">
          {fullLink.replace(/^https?:\/\//, "")}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Link
          href={`/dashboard/services/${event.id}/edit`}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-soft bg-surface-card px-3 text-[12px] font-bold text-ink-strong"
        >
          <Pencil className="size-3.5" /> Edit
        </Link>
        <button
          type="button"
          onClick={onDeactivate}
          disabled={busy}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-soft bg-surface-card px-3 text-[12px] font-bold text-ink-soft disabled:opacity-50"
        >
          <EyeOff className="size-3.5" /> Deactivate
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          aria-label="Delete service"
          className="inline-flex size-9 items-center justify-center rounded-lg border border-danger-border bg-surface-card text-danger hover:bg-danger-tint disabled:opacity-50"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </article>
  );
}

function InactiveRow({
  event,
  busy,
  onReactivate,
  onDelete,
}: {
  event: EventType;
  busy: boolean;
  onReactivate: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-line-cream bg-surface-card opacity-90 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
      <div className="grid gap-0 sm:grid-cols-[160px_1fr_auto]">
        <div
          className="relative h-32 sm:h-auto"
          style={{
            background:
              "linear-gradient(135deg,#D7F2EA 0%,#B6E4F2 60%,#CFE9E0 100%)",
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center text-[28px] font-bold text-success-teal">
            ★
          </div>
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-surface-card/90 px-2 py-1 text-[10px] font-bold text-ink-soft">
            Hidden from public
          </div>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold">{event.title}</h3>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-line-subtle px-2.5 py-1 text-[11px] font-bold text-ink-soft">
              <span className="size-1.5 rounded-full bg-ink-muted" /> Inactive
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-soft tabular-nums">
            {event.durationMinutes} min ·{" "}
            {formatLocationLabel(event.locationType)} ·{" "}
            <PricePillText
              priceType={event.priceType}
              priceAmount={event.priceAmount}
              priceMaxAmount={event.priceMaxAmount}
              priceCurrency={event.priceCurrency}
            />
          </p>
          {event.description ? (
            <p className="mt-2 text-sm text-ink-soft">{event.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 p-5">
          <button
            type="button"
            onClick={onReactivate}
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-brand-tint-400 bg-brand-tint-100 px-3 text-[12px] font-bold text-brand disabled:opacity-50"
          >
            <Eye className="size-3.5" /> Reactivate
          </button>
          <Link
            href={`/dashboard/services/${event.id}/edit`}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-line-soft bg-surface-card px-3 text-[12px] font-bold text-ink-strong hover:bg-surface-soft"
          >
            <Pencil className="size-3.5" /> Edit
          </Link>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete"
            className="inline-flex size-9 items-center justify-center rounded-lg border border-line-soft bg-surface-card text-ink-soft"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="mt-7 overflow-hidden rounded-2xl border border-line-cream bg-surface-card shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <div className="relative">
          <div className="absolute inset-0 -m-3 rounded-[26px] bg-brand-tint-100" />
          <div className="relative flex size-20 items-center justify-center rounded-[20px] border border-brand-tint-400 bg-surface-card text-brand shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
            <Layers className="size-9" />
          </div>
        </div>
        <h3 className="mt-7 text-[22px] font-bold">
          Create your first service
        </h3>
        <p className="mt-2 max-w-[440px] text-sm leading-[1.6] text-ink-soft">
          Services are what guests can book with you — a haircut, a coaching
          call, a session. Each gets its own page and a shareable link.
        </p>
        <Link
          href="/dashboard/services/new"
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange px-5 text-[13px] font-bold text-white shadow-sm hover:brightness-105"
        >
          <Plus className="size-4" /> Create a service
        </Link>
        <p className="mt-3 text-[11px] text-ink-muted">
          Takes about 60 seconds.
        </p>

        <div className="mt-10 grid w-full max-w-[820px] gap-3 text-left sm:grid-cols-3">
          <ExampleCard
            kind="Barber"
            title="Fresh Cut Session"
            sub="45 min · £40 · In person"
          />
          <ExampleCard
            kind="Coach"
            title="Intro discovery call"
            sub="30 min · Free · Video call"
          />
          <ExampleCard
            kind="Trainer"
            title="1:1 PT session"
            sub="60 min · £55 · I travel to you"
          />
        </div>
      </div>
    </div>
  );
}

function ExampleCard({
  kind,
  title,
  sub,
}: {
  kind: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-line-cream bg-surface-page p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
        Example · {kind}
      </p>
      <p className="mt-2 text-[13px] font-bold">{title}</p>
      <p className="text-[11px] text-ink-soft tabular-nums">{sub}</p>
    </div>
  );
}

function DeleteConfirm({
  event,
  onClose,
  onConfirm,
}: {
  event: EventType;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-strong/45 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[440px] rounded-2xl bg-surface-card shadow-[0_24px_48px_-20px_rgba(17,24,39,0.30)]">
        <div className="flex items-start gap-4 p-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-danger-tint-strong text-danger">
            <Trash2 className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold">Delete {event.title}?</h3>
            <p className="mt-1 text-[13px] text-ink-soft">
              This removes the service from your dashboard and public booking
              pages. Existing booking history stays attached for records, but
              the service cannot be restored from this page.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-md p-1.5 text-ink-muted hover:bg-surface-soft"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-line-cream p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-line-soft bg-surface-card px-4 text-[13px] font-bold text-ink-strong hover:bg-surface-soft"
          >
            Keep service
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onConfirm();
              } finally {
                setSaving(false);
              }
            }}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-danger-strong px-4 text-[13px] font-bold text-white hover:bg-danger disabled:opacity-60"
          >
            <Trash2 className="size-4" /> {saving ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PricePill({
  priceType,
  priceAmount,
  priceMaxAmount,
  priceCurrency,
  className,
}: {
  priceType: EventType["priceType"];
  priceAmount: number | null;
  priceMaxAmount: number | null;
  priceCurrency: string;
  className?: string;
}) {
  const label = formatPriceLabel({
    priceType,
    priceAmount,
    priceMaxAmount,
    priceCurrency,
  });
  if (!label) return null;
  return (
    <span
      className={`rounded-full bg-surface-card/90 px-2.5 py-1 text-[10px] font-bold backdrop-blur ${className ?? ""}`}
    >
      {label}
    </span>
  );
}

function PricePillText({
  priceType,
  priceAmount,
  priceMaxAmount,
  priceCurrency,
}: {
  priceType: EventType["priceType"];
  priceAmount: number | null;
  priceMaxAmount: number | null;
  priceCurrency: string;
}) {
  return (
    <span className="font-semibold text-ink-strong">
      {formatPriceLabel({
        priceType,
        priceAmount,
        priceMaxAmount,
        priceCurrency,
      }) ?? "No price tag"}
    </span>
  );
}

function InlineState({ title, text }: { title: string; text: string }) {
  return (
    <div className="mt-6 rounded-xl border border-line-cream bg-surface-card p-6 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-ink-soft">{text}</p>
    </div>
  );
}

function formatLocationLabel(locationType: LocationType) {
  switch (locationType) {
    case "VIDEO":
      return "Video call";
    case "PHONE":
      return "Phone call";
    case "IN_PERSON":
      return "In person";
    default:
      return locationType;
  }
}

export function formatPriceLabel({
  priceType,
  priceAmount,
  priceMaxAmount,
  priceCurrency,
}: {
  priceType: EventType["priceType"];
  priceAmount: number | null;
  priceMaxAmount: number | null;
  priceCurrency: string;
}): string | null {
  if (priceType === "FREE") return null;
  if (priceType === "RANGE" && priceAmount != null && priceMaxAmount != null) {
    return `${formatMoney(priceAmount, priceCurrency)} – ${formatMoney(priceMaxAmount, priceCurrency)}`;
  }
  if (priceAmount == null) return null;
  const base = formatMoney(priceAmount, priceCurrency);
  if (priceType === "FROM") return `From ${base}`;
  return base;
}

function formatMoney(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function renderServiceIcon(title: string, locationType: LocationType) {
  const t = title.toLowerCase();
  if (t.includes("cut") || t.includes("hair") || t.includes("barber"))
    return <Scissors className="size-5" />;
  if (t.includes("call") || t.includes("intro") || t.includes("coach"))
    return <Zap className="size-5" />;
  if (locationType === "IN_PERSON") return <MapPin className="size-5" />;
  return <Calendar className="size-5" />;
}
