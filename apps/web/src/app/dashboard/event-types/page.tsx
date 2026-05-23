"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Calendar,
  Copy,
  Eye,
  EyeOff,
  Layers,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Scissors,
  Search,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  authedApiRequest,
  type EventType,
  type LocationType,
  type PublicUser,
  publicBookingUrl,
  uploadImage,
} from "@/lib/api";

const locationOptions: { value: LocationType; label: string }[] = [
  { value: "VIDEO", label: "Video call" },
  { value: "PHONE", label: "Phone call" },
  { value: "IN_PERSON", label: "In person" },
];

const cardPalettes = [
  {
    heroBg: "linear-gradient(135deg,#FFE0DA 0%,#FFD3A6 60%,#FFC9C2 100%)",
    avatarBg: "linear-gradient(135deg,#FF6267,#FF8A4C)",
    pricePill: "text-[#FF5F63]",
    copyText: "text-[#FF5F63] border-[#FFD2CE]",
    chip: "bg-[#FFF0EF] text-[#FF5F63]",
  },
  {
    heroBg: "linear-gradient(135deg,#F4EAFF 0%,#E1CFFA 60%,#D7CDF8 100%)",
    avatarBg: "linear-gradient(135deg,#A855F7,#7C4DFF)",
    pricePill: "text-[#A855F7]",
    copyText: "text-[#A855F7] border-[#E1CFFA]",
    chip: "bg-[#F4EAFF] text-[#A855F7]",
  },
  {
    heroBg: "linear-gradient(135deg,#D7F2EA 0%,#B6E4F2 60%,#CFE9E0 100%)",
    avatarBg: "linear-gradient(135deg,#10B981,#0D9488)",
    pricePill: "text-[#0D9488]",
    copyText: "text-[#0D9488] border-[#A7E5D3]",
    chip: "bg-[#E0F7EF] text-[#0D9488]",
  },
  {
    heroBg: "linear-gradient(135deg,#FFE9C7 0%,#FFD08A 60%,#FFC9C2 100%)",
    avatarBg: "linear-gradient(135deg,#F59E0B,#EA580C)",
    pricePill: "text-[#B45309]",
    copyText: "text-[#B45309] border-[#FDE68A]",
    chip: "bg-[#FEF3C7] text-[#B45309]",
  },
];

export default function EventTypesPage() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [events, setEvents] = useState<EventType[]>([]);
  const [editing, setEditing] = useState<EventType | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleting, setDeleting] = useState<EventType | null>(null);
  const [reactivating, setReactivating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const initial = useMemo(() => editing ?? undefined, [editing]);

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

  function openCreate() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(event: EventType) {
    setEditing(event);
    setDrawerOpen(true);
  }

  async function toggleActive(event: EventType, target: boolean) {
    setReactivating(event.id);
    try {
      const updated = await authedApiRequest<EventType>(
        `/event-types/${event.id}`,
        target
          ? { method: "PATCH", body: JSON.stringify({ isActive: true }) }
          : { method: "DELETE" },
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
      setReactivating(null);
    }
  }

  const filtered = events.filter((event) =>
    event.title.toLowerCase().includes(query.toLowerCase()),
  );
  const active = filtered.filter((event) => event.isActive);
  const inactive = filtered.filter((event) => !event.isActive);

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
          <p className="mt-2 text-sm text-[#6B7280]">
            The things guests can book with you. Each gets its own shareable
            link.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-5 text-[13px] font-bold text-white shadow-sm hover:brightness-105"
        >
          <Plus className="size-4" /> New service
        </button>
      </div>

      {error ? <InlineState title="Services unavailable" text={error} /> : null}
      {loading ? (
        <InlineState title="Loading services" text="Fetching your services." />
      ) : null}

      {!loading && !error && events.length === 0 ? (
        <EmptyState onCreate={openCreate} />
      ) : null}

      {!loading && !error && events.length > 0 ? (
        <>
          <div className="mt-7 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#EEE7DF] bg-white p-4 shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
            <div className="flex items-center gap-4 text-[13px]">
              <span className="text-[#6B7280]">
                <span className="font-bold text-[#0B1220] tabular-nums">
                  {events.length}
                </span>{" "}
                total
              </span>
              <span className="h-4 w-px bg-[#EEE7DF]" />
              <span className="text-[#16A34A]">
                <span className="font-bold tabular-nums">{active.length}</span>{" "}
                active
              </span>
              <span className="h-4 w-px bg-[#EEE7DF]" />
              <span className="text-[#9CA3AF]">
                <span className="font-bold tabular-nums">{inactive.length}</span>{" "}
                inactive
              </span>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search services…"
                className="h-9 w-[240px] rounded-lg border border-[#E5E7EB] bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#FF5F63] focus:shadow-[0_0_0_4px_rgba(255,95,99,0.15)]"
              />
            </div>
          </div>

          {active.length > 0 ? (
            <>
              <SectionHeading label="Active" count={active.length} />
              <div className="grid gap-4 md:grid-cols-2">
                {active.map((event, idx) => (
                  <ServiceCard
                    key={event.id}
                    event={event}
                    user={user}
                    palette={cardPalettes[idx % cardPalettes.length]}
                    onEdit={() => openEdit(event)}
                    onDeactivate={() => toggleActive(event, false)}
                    onDelete={() => setDeleting(event)}
                    busy={reactivating === event.id}
                  />
                ))}
              </div>
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
                    busy={reactivating === event.id}
                    onReactivate={() => toggleActive(event, true)}
                    onEdit={() => openEdit(event)}
                    onDelete={() => setDeleting(event)}
                  />
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}

      {drawerOpen ? (
        <EventTypeDrawer
          initial={initial}
          onClose={() => setDrawerOpen(false)}
          onSaved={(event) => {
            setEvents((current) =>
              initial
                ? current.map((item) => (item.id === event.id ? event : item))
                : [event, ...current],
            );
            setDrawerOpen(false);
            toast.success(initial ? "Service updated" : "Service created");
          }}
        />
      ) : null}

      {deleting ? (
        <DeleteConfirm
          event={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            await toggleActive(deleting, false);
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
      <h2 className="text-[12px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
        {label}
      </h2>
      <span className="text-[11px] text-[#9CA3AF] tabular-nums">{count}</span>
    </div>
  );
}

function ServiceCard({
  event,
  user,
  palette,
  onEdit,
  onDeactivate,
  onDelete,
  busy,
}: {
  event: EventType;
  user: PublicUser | null;
  palette: (typeof cardPalettes)[number];
  onEdit: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const fullLink = user ? publicBookingUrl(user.slug, event.slug) : "";
  const displayLink = fullLink.replace(/^https?:\/\//, "");
  const Icon = pickIcon(event.title);

  async function copyLink() {
    if (!fullLink) return;
    try {
      await navigator.clipboard.writeText(fullLink);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed");
    }
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-[#EEE7DF] bg-white shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
      <div className="relative h-28" style={{ background: palette.heroBg }}>
        <div
          className="absolute -bottom-6 left-5 flex size-14 items-center justify-center rounded-2xl text-white shadow-[0_12px_32px_-16px_rgba(17,24,39,0.20)]"
          style={{ background: palette.avatarBg }}
        >
          {event.imageUrl ? (
            <div
              className="size-full rounded-2xl bg-cover bg-center"
              style={{ backgroundImage: `url(${event.imageUrl})` }}
            />
          ) : (
            <Icon className="size-5" />
          )}
        </div>
        {event.priceAmount != null ? (
          <span
            className={`absolute right-4 top-4 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold backdrop-blur ${palette.pricePill}`}
          >
            {formatPrice(event.priceAmount, event.priceCurrency)}
          </span>
        ) : null}
      </div>
      <div className="px-5 pb-5 pt-9">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold">{event.title}</h3>
            <p className="mt-0.5 text-xs text-[#6B7280] tabular-nums">
              {event.durationMinutes} min ·{" "}
              {formatLocationLabel(event.locationType)}
              {event.locationDetails ? ` · ${event.locationDetails}` : ""}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E6F4EA] px-2.5 py-1 text-[11px] font-bold text-[#16A34A]">
            <span className="size-1.5 rounded-full bg-[#16A34A]" /> Active
          </span>
        </div>
        {event.description ? (
          <p className="mt-3 line-clamp-2 text-[13px] leading-[1.6] text-[#374151]">
            {event.description}
          </p>
        ) : null}

        {event.category ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${palette.chip}`}
            >
              {event.category}
            </span>
          </div>
        ) : null}

        {fullLink ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] px-3 py-2.5">
            <p className="truncate text-[11px] text-[#6B7280] tabular-nums">
              {displayLink}
            </p>
            <button
              type="button"
              onClick={copyLink}
              className={`inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-1 text-[11px] font-bold ${palette.copyText}`}
            >
              <Copy className="size-3" /> Copy
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEE7DF] pt-4">
          <p className="text-[11px] text-[#9CA3AF]">
            <span className="font-semibold tabular-nums text-[#0B1220]">
              {event.bufferBeforeMinutes + event.bufferAfterMinutes}
            </span>{" "}
            min buffer · created{" "}
            <span className="tabular-nums">
              {new Date(event.createdAt).toLocaleDateString()}
            </span>
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[12px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
            >
              <Pencil className="size-3.5" /> Edit
            </button>
            <button
              type="button"
              onClick={onDeactivate}
              disabled={busy}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-[12px] font-bold text-[#0B1220] hover:bg-[#F9FAFB] disabled:opacity-50"
            >
              <EyeOff className="size-3.5" /> Deactivate
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                aria-label="More"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280] hover:bg-[#F9FAFB]"
              >
                <MoreHorizontal className="size-4" />
              </button>
              {menuOpen ? (
                <div className="absolute bottom-[calc(100%+6px)] right-0 z-30 w-[220px] rounded-xl border border-[#EEE7DF] bg-white p-1.5 shadow-[0_24px_48px_-20px_rgba(17,24,39,0.16)]">
                  <button
                    type="button"
                    onClick={async () => {
                      await copyLink();
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-[#374151] hover:bg-[#FFFBF7] hover:text-[#0B1220]"
                  >
                    <Copy className="size-4 text-[#9CA3AF]" /> Copy link
                  </button>
                  <a
                    href={fullLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-[#374151] hover:bg-[#FFFBF7] hover:text-[#0B1220]"
                  >
                    <Eye className="size-4 text-[#9CA3AF]" /> View public page
                  </a>
                  <div className="my-1 h-px bg-[#EEE7DF]" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-[#B91C1C] hover:bg-[#FEF2F2]"
                  >
                    <Trash2 className="size-4 text-[#DC2626]" /> Deactivate &amp;
                    hide
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

function InactiveRow({
  event,
  busy,
  onReactivate,
  onEdit,
  onDelete,
}: {
  event: EventType;
  busy: boolean;
  onReactivate: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-[#EEE7DF] bg-white shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)] opacity-90">
      <div className="grid gap-0 sm:grid-cols-[160px_1fr_auto]">
        <div
          className="relative h-32 sm:h-auto"
          style={{
            background:
              "linear-gradient(135deg,#D7F2EA 0%,#B6E4F2 60%,#CFE9E0 100%)",
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center text-[28px] font-bold text-[#0D9488]">
            ★
          </div>
          <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-[#6B7280]">
            Hidden from public
          </div>
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold">{event.title}</h3>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F3F4F6] px-2.5 py-1 text-[11px] font-bold text-[#6B7280]">
              <span className="size-1.5 rounded-full bg-[#9CA3AF]" /> Inactive
            </span>
          </div>
          <p className="mt-1 text-xs text-[#6B7280] tabular-nums">
            {event.durationMinutes} min · {formatLocationLabel(event.locationType)}
            {event.priceAmount != null
              ? ` · ${formatPrice(event.priceAmount, event.priceCurrency)}`
              : ""}
          </p>
          {event.description ? (
            <p className="mt-2 text-sm text-[#6B7280]">{event.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 p-5">
          <button
            type="button"
            onClick={onReactivate}
            disabled={busy}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#FFD2CE] bg-[#FFF0EF] px-3 text-[12px] font-bold text-[#FF5F63] disabled:opacity-50"
          >
            <Eye className="size-3.5" /> Reactivate
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-3 text-[12px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
          >
            <Pencil className="size-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#6B7280]"
            aria-label="More"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-7 overflow-hidden rounded-2xl border border-[#EEE7DF] bg-white shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
      <div className="flex flex-col items-center px-6 py-16 text-center">
        <div className="relative">
          <div className="absolute inset-0 -m-3 rounded-[26px] bg-[#FFF0EF]" />
          <div className="relative flex size-20 items-center justify-center rounded-[20px] border border-[#FFD2CE] bg-white text-[#FF5F63] shadow-[0_12px_32px_-16px_rgba(17,24,39,0.08)]">
            <Layers className="size-9" />
          </div>
        </div>
        <h3 className="mt-7 text-[22px] font-bold">
          Create your first service
        </h3>
        <p className="mt-2 max-w-[440px] text-sm leading-[1.6] text-[#6B7280]">
          Services are what guests can book with you — a haircut, a coaching
          call, a session. Each gets its own page and a shareable link.
        </p>
        <button
          type="button"
          onClick={onCreate}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-5 text-[13px] font-bold text-white shadow-sm hover:brightness-105"
        >
          <Plus className="size-4" /> Create a service
        </button>
        <p className="mt-3 text-[11px] text-[#9CA3AF]">Takes about 60 seconds.</p>

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
    <div className="rounded-2xl border border-[#EEE7DF] bg-[#FFFBF7] p-4">
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
        Example · {kind}
      </p>
      <p className="mt-2 text-[13px] font-bold">{title}</p>
      <p className="text-[11px] text-[#6B7280] tabular-nums">{sub}</p>
    </div>
  );
}

function EventTypeDrawer({
  initial,
  onClose,
  onSaved,
}: {
  initial?: EventType;
  onClose: () => void;
  onSaved: (event: EventType) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const priceInput = readOptionalText(form, "priceInput");
    const priceCurrency = readText(form, "priceCurrency") || "USD";
    const priceAmount =
      priceInput !== null ? Math.round(parseFloat(priceInput) * 100) : null;

    const payload = {
      title: readText(form, "title"),
      slug: readOptionalText(form, "slug") ?? undefined,
      category: readOptionalText(form, "category"),
      imageUrl: imageUrl || null,
      description: readOptionalText(form, "description"),
      whatIncluded: readOptionalText(form, "whatIncluded"),
      locationDetails: readOptionalText(form, "locationDetails"),
      durationMinutes: readNumber(form, "durationMinutes"),
      bufferBeforeMinutes: readNumber(form, "bufferBeforeMinutes"),
      bufferAfterMinutes: readNumber(form, "bufferAfterMinutes"),
      locationType: readText(form, "locationType") as LocationType,
      isActive: form.get("isActive") === "on",
      priceAmount:
        priceAmount !== null && !Number.isNaN(priceAmount) ? priceAmount : null,
      priceCurrency,
    };

    try {
      const saved = await authedApiRequest<EventType>(
        initial ? `/event-types/${initial.id}` : "/event-types",
        {
          method: initial ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      onSaved(saved);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save service",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-[#0B1220]/45"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="ml-auto flex h-full w-full max-w-[760px] flex-col bg-[#FFFBF7] shadow-2xl">
        <header className="flex h-16 items-center justify-between border-b border-[#EEE7DF] bg-white px-8">
          <h3 className="text-xl font-bold">
            {initial ? "Edit service" : "Create a service"}
          </h3>
          <button type="button" onClick={onClose} aria-label="Close form">
            <X className="size-5 text-[#6B7280]" />
          </button>
        </header>
        <form
          className="flex flex-1 flex-col overflow-y-auto px-8 py-6"
          onSubmit={submit}
        >
          {error ? (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <div className="space-y-5">
            <FormPanel eyebrow="What service do you offer?">
              <Field
                label="Service name"
                name="title"
                placeholder="Fresh Cut Session"
                value={initial?.title}
              />
              <Field
                label="Category"
                name="category"
                placeholder="Barbering, coaching, tutoring..."
                value={initial?.category ?? ""}
              />
              <Field
                label="Description"
                name="description"
                placeholder="A focused session to discuss..."
                value={initial?.description ?? ""}
              />
              <Field
                label="What's included"
                name="whatIncluded"
                placeholder="Precision cut, styling, and finish"
                value={initial?.whatIncluded ?? ""}
              />
              <PriceField
                priceAmount={initial?.priceAmount ?? null}
                priceCurrency={initial?.priceCurrency ?? "USD"}
              />
              <ServiceImageUpload
                value={imageUrl}
                uploading={uploadingImage}
                onClear={() => setImageUrl("")}
                onChange={async (file) => {
                  setUploadingImage(true);
                  setError(null);
                  try {
                    const uploaded = await uploadImage(file);
                    setImageUrl(uploaded.url);
                    toast.success("Service image uploaded");
                  } catch (caught) {
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : "Could not upload image",
                    );
                  } finally {
                    setUploadingImage(false);
                  }
                }}
              />
            </FormPanel>
            <FormPanel eyebrow="Booking rules">
              <SelectNumber
                label="Duration"
                name="durationMinutes"
                value={initial?.durationMinutes ?? 30}
                options={[15, 30, 45, 60, 90]}
              />
              <div className="grid grid-cols-2 gap-3">
                <SelectNumber
                  label="Prep time"
                  name="bufferBeforeMinutes"
                  value={initial?.bufferBeforeMinutes ?? 0}
                  options={[0, 5, 10, 15, 30]}
                />
                <SelectNumber
                  label="Cleanup time"
                  name="bufferAfterMinutes"
                  value={initial?.bufferAfterMinutes ?? 0}
                  options={[0, 5, 10, 15, 30]}
                />
              </div>
            </FormPanel>
            <FormPanel eyebrow="Where does it happen?">
              <label className="block">
                <span className="text-sm font-bold">Location type</span>
                <select
                  name="locationType"
                  defaultValue={initial?.locationType ?? "VIDEO"}
                  className="mt-1 h-10 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm outline-none focus:border-[#FF5F63] focus:ring-2 focus:ring-[#FF5F63]/15"
                >
                  {locationOptions.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Location details"
                name="locationDetails"
                placeholder="Studio address, video link later, or phone call"
                value={initial?.locationDetails ?? ""}
              />
              <label className="flex items-center justify-between pt-1">
                <span className="text-sm font-bold">Public and bookable</span>
                <input
                  name="isActive"
                  type="checkbox"
                  defaultChecked={initial?.isActive ?? true}
                  className="size-5 accent-[#FF5F63]"
                />
              </label>
              {initial ? (
                <details className="rounded-xl border border-[#EEE7DF] bg-white px-4 py-3">
                  <summary className="cursor-pointer text-sm font-bold text-[#6B7280]">
                    Advanced — Edit public URL
                  </summary>
                  <div className="mt-3">
                    <Field
                      label="Public URL ending"
                      name="slug"
                      placeholder="fresh-cut"
                      value={initial.slug}
                    />
                  </div>
                </details>
              ) : null}
            </FormPanel>
          </div>
          <footer className="mt-auto grid grid-cols-2 gap-3 border-t border-[#EEE7DF] pt-4">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-lg bg-white font-semibold"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="h-10 rounded-lg bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] font-semibold text-white"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : initial
                  ? "Save changes"
                  : "Publish service"}
            </Button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

function ServiceImageUpload({
  value,
  uploading,
  onChange,
  onClear,
}: {
  value: string;
  uploading: boolean;
  onChange: (file: File) => void;
  onClear: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">Service picture</p>
          <p className="mt-1 text-xs text-[#6B7280]">
            Optional. JPG, PNG, WEBP, or GIF up to 5 MB.
          </p>
        </div>
        {value ? (
          <button
            type="button"
            className="text-xs font-bold text-[#FF6267]"
            onClick={onClear}
          >
            Remove
          </button>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {value ? (
          <div
            className="h-20 w-28 rounded-xl border border-[#E8DED7] bg-cover bg-center"
            style={{ backgroundImage: `url(${value})` }}
          />
        ) : (
          <div className="flex h-20 w-28 items-center justify-center rounded-xl border border-dashed border-[#E8DED7] bg-white text-xs font-bold text-[#B8C0CC]">
            No image
          </div>
        )}
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#FF6267] bg-white px-4 text-sm font-bold text-[#FF6267]">
          <Plus className="size-4" />
          {uploading ? "Uploading..." : "Choose image"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onChange(file);
            }}
          />
        </label>
      </div>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1220]/45 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[440px] rounded-2xl bg-white shadow-[0_24px_48px_-20px_rgba(17,24,39,0.30)]">
        <div className="flex items-start gap-4 p-6">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#FEE2E2] text-[#B91C1C]">
            <Trash2 className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-bold">Deactivate {event.title}?</h3>
            <p className="mt-1 text-[13px] text-[#6B7280]">
              This hides the service from your public page so no new bookings
              can be made. Existing bookings stay. You can reactivate it later.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto rounded-md p-1.5 text-[#9CA3AF] hover:bg-[#F9FAFB]"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[#EEE7DF] p-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center rounded-xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-bold text-[#0B1220] hover:bg-[#F9FAFB]"
          >
            Keep active
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
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#DC2626] px-4 text-[13px] font-bold text-white hover:bg-[#B91C1C] disabled:opacity-60"
          >
            <EyeOff className="size-4" /> {saving ? "Deactivating..." : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  value,
}: {
  label: string;
  name: string;
  placeholder: string;
  value?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <input
        name={name}
        defaultValue={value}
        placeholder={placeholder}
        className="mt-1 h-11 w-full rounded-xl border border-[#E8DED7] bg-[#FFFBF7] px-3 text-sm outline-none placeholder:text-[#B8C0CC] focus:border-[#FF5F63] focus:ring-2 focus:ring-[#FF5F63]/15"
      />
    </label>
  );
}

function FormPanel({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-[#EEE7DF] bg-white p-5">
      <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
        {eyebrow}
      </p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function SelectNumber({
  label,
  name,
  value,
  options,
}: {
  label: string;
  name: string;
  value: number;
  options: number[];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="mt-1 h-10 w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm outline-none focus:border-[#FF5F63] focus:ring-2 focus:ring-[#FF5F63]/15"
      >
        {options.map((option) => (
          <option value={option} key={option}>
            {option} minutes
          </option>
        ))}
      </select>
    </label>
  );
}

function PriceField({
  priceAmount,
  priceCurrency,
}: {
  priceAmount: number | null;
  priceCurrency: string;
}) {
  const defaultDollars =
    priceAmount != null ? (priceAmount / 100).toFixed(2) : "";

  return (
    <div>
      <span className="text-sm font-bold">Price</span>
      <p className="mb-2 text-xs text-[#9CA3AF]">
        Leave blank to show &ldquo;Price on request&rdquo;.
      </p>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-3 flex items-center text-sm text-[#9CA3AF]">
            $
          </span>
          <input
            name="priceInput"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            defaultValue={defaultDollars}
            className="h-11 w-full rounded-xl border border-[#E8DED7] bg-[#FFFBF7] pl-7 pr-3 text-sm outline-none placeholder:text-[#B8C0CC] focus:border-[#FF5F63] focus:ring-2 focus:ring-[#FF5F63]/15"
          />
        </div>
        <select
          name="priceCurrency"
          defaultValue={priceCurrency}
          className="h-11 rounded-xl border border-[#E8DED7] bg-[#FFFBF7] px-3 text-sm outline-none focus:border-[#FF5F63] focus:ring-2 focus:ring-[#FF5F63]/15"
        >
          {["USD", "EUR", "GBP", "CAD", "AUD"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
    </div>
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

function readText(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalText(form: FormData, key: string) {
  const value = readText(form, key);
  return value ? value : null;
}

function readNumber(form: FormData, key: string) {
  return Number(readText(form, key));
}

function formatLocationLabel(locationType: LocationType) {
  return (
    locationOptions.find((option) => option.value === locationType)?.label ??
    locationType
  );
}

function formatPrice(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function pickIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("cut") || t.includes("hair") || t.includes("barber")) return Scissors;
  if (t.includes("call") || t.includes("intro") || t.includes("coach")) return Zap;
  if (t.includes("session")) return Calendar;
  if (t.includes("address") || t.includes("studio")) return MapPin;
  return Layers;
}
