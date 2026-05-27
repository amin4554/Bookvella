"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarCheck2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  AtSign,
  Globe,
  Link as LinkIcon,
  ListChecks,
  MapPin,
  Maximize2,
  Phone as PhoneIcon,
  Scissors,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { LegalFooter } from "@/components/legal-footer";
import { apiRequest } from "@/lib/api";
import type {
  AvailableSlot,
  LocationType,
  PriceType,
  PublicHostProfile,
} from "@/lib/api";

type ServiceItem = PublicHostProfile["services"][number];

const PALETTES = [
  {
    heroBg: "linear-gradient(135deg,#FFE0DA 0%,#FFD3A6 60%,#FFC9C2 100%)",
    ink: "text-brand",
  },
  {
    heroBg: "linear-gradient(135deg,#F4EAFF 0%,#E1CFFA 60%,#D7CDF8 100%)",
    ink: "text-purple",
  },
  {
    heroBg: "linear-gradient(135deg,#D7F2EA 0%,#B6E4F2 60%,#CFE9E0 100%)",
    ink: "text-success-teal",
  },
  {
    heroBg: "linear-gradient(135deg,#FFE9C7 0%,#FFD08A 60%,#FFC9C2 100%)",
    ink: "text-warning",
  },
];

export function PublicHostProfileView({ data }: { data: PublicHostProfile }) {
  const { host, services, reviewSummary, reviews, stats } = data;
  const initial = (host.name || "?").charAt(0).toUpperCase();

  const verifiedMonth = new Date(host.createdAt).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const dist = reviewSummary.distribution;
  const total = reviewSummary.reviewCount;
  function pct(n: number) {
    if (total === 0) return 0;
    return Math.max(0.5, (n / total) * 100);
  }

  // Service-detail preview modal. Guests click a service to open this before
  // committing to the booking flow — gives them gallery, includes, prep notes,
  // filtered reviews, and the next available slot in one shot.
  const [activeService, setActiveService] = useState<ServiceItem | null>(null);
  const openServiceDetail = useCallback(
    (service: ServiceItem) => setActiveService(service),
    [],
  );
  const closeServiceDetail = useCallback(() => setActiveService(null), []);

  async function share() {
    const url =
      typeof window !== "undefined" ? window.location.href : `/${host.slug}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: host.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied");
      } catch {
        toast.error("Could not share");
      }
    }
  }

  return (
    <div className="min-h-screen bg-surface-page text-ink-strong">
      {/* slim top bar */}
      <header className="border-b border-line-cream bg-surface-card">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo/icon.svg"
              alt=""
              className="size-7 rounded-md"
            />
            <span className="text-[14px] font-bold tracking-tight">
              Bookvella
            </span>
          </Link>
          <p className="text-[12px] text-ink-muted">
            Powered by Bookvella ·{" "}
            <Link
              href="/register"
              className="font-semibold text-ink-strong hover:underline"
            >
              Create your free page
            </Link>
          </p>
        </div>
      </header>

      {/* cover + identity hero */}
      <section className="relative">
        <div
          className="h-[220px] md:h-[260px]"
          style={{
            background: host.coverImageUrl
              ? `url(${host.coverImageUrl}) center/cover`
              : "radial-gradient(60% 60% at 10% 0%, rgba(255,255,255,0.20) 0%, transparent 60%), radial-gradient(60% 60% at 100% 100%, rgba(255,201,124,0.40) 0%, transparent 60%), linear-gradient(135deg,#FF6267 0%,#FF8252 35%,#C661E0 75%,#A855F7 100%)",
          }}
        />
        <div className="mx-auto -mt-20 max-w-[1200px] px-5">
          <div className="rounded-[28px] border border-line-cream bg-surface-card p-6 shadow-[0_1px_0_rgba(17,24,39,0.04),0_12px_32px_-16px_rgba(17,24,39,0.10)] md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex items-start gap-5">
                <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-br from-brand-coral via-purple-vivid to-purple-strong text-[32px] font-bold text-white shadow-[0_1px_0_rgba(17,24,39,0.04),0_28px_64px_-32px_rgba(255,95,99,0.30)] md:size-28">
                  {host.profileImageUrl ? (
                    <div
                      className="size-full bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${host.profileImageUrl})`,
                      }}
                    />
                  ) : (
                    initial
                  )}
                </div>
                <div className="leading-tight">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1
                      className="text-[34px] font-extrabold md:text-[42px]"
                      style={{ letterSpacing: "-0.03em", lineHeight: "1" }}
                    >
                      {host.name}
                    </h1>
                    <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
                      Active
                    </span>
                  </div>
                  {host.headline ? (
                    <p className="mt-2 text-[15px] text-ink-body">
                      {host.headline}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {host.businessCategory ? (
                      <Chip>
                        <Scissors className="size-3.5 text-brand" />
                        {host.businessCategory}
                      </Chip>
                    ) : null}
                    {host.location ? (
                      <Chip>
                        <MapPin className="size-3.5 text-ink-muted" />
                        {host.location}
                      </Chip>
                    ) : null}
                    {reviewSummary.reviewCount > 0 &&
                    reviewSummary.averageRating != null ? (
                      <Chip>
                        <Stars rating={reviewSummary.averageRating} />
                        <span className="tabular-nums">
                          {reviewSummary.averageRating.toFixed(1)} ·{" "}
                          {reviewSummary.reviewCount}{" "}
                          {reviewSummary.reviewCount === 1
                            ? "review"
                            : "reviews"}
                        </span>
                      </Chip>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={share}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-line-soft bg-surface-card px-4 text-[13px] font-bold hover:bg-surface-soft"
                >
                  <Share2 className="size-4" /> Share
                </button>
                <a
                  href="#services"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange px-5 text-[13px] font-bold text-white shadow-sm hover:brightness-105"
                >
                  Book a service <ArrowDown className="size-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* body */}
      <section className="mx-auto max-w-[1200px] px-5 py-12 lg:gap-12 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:gap-12">
          {/* LEFT */}
          <div className="space-y-10">
            {/* about */}
            {host.about ? (
              <div>
                <div className="flex items-end justify-between">
                  <h2
                    className="text-[24px] font-extrabold md:text-[28px]"
                    style={{ letterSpacing: "-0.03em", lineHeight: "1" }}
                  >
                    About {firstName(host.name)}
                  </h2>
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                    Bio
                  </span>
                </div>
                <p className="mt-4 max-w-[620px] text-[15px] leading-[1.7] text-ink-body">
                  {host.about}
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <StatCard
                    icon={<Clock className="size-4" />}
                    tint="bg-brand-tint-100 text-brand"
                    label="Typical visit"
                    value={typicalVisit(services)}
                  />
                  <StatCard
                    icon={<BadgeCheck className="size-4" />}
                    tint="bg-purple-tint text-purple"
                    label="Verified host since"
                    value={verifiedMonth}
                  />
                  <StatCard
                    icon={<CalendarCheck2 className="size-4" />}
                    tint="bg-success-tint-soft text-success-teal"
                    label="Completed bookings"
                    value={
                      stats.completedBookings === 0
                        ? "—"
                        : `${stats.completedBookings.toLocaleString()}+`
                    }
                  />
                </div>
              </div>
            ) : null}

            {/* what to expect */}
            {host.whatToExpect ? (
              <div className="rounded-2xl border border-line-cream bg-surface-card p-6 shadow-[0_1px_0_rgba(17,24,39,0.04),0_12px_32px_-16px_rgba(17,24,39,0.10)]">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-brand-tint-100 text-brand">
                    <Sparkles className="size-4" />
                  </span>
                  <h3 className="text-base font-bold">What to expect</h3>
                </div>
                <ExpectationList text={host.whatToExpect} />
              </div>
            ) : null}

            {/* services */}
            <div id="services">
              <div className="flex items-end justify-between">
                <h2
                  className="text-[24px] font-extrabold md:text-[28px]"
                  style={{ letterSpacing: "-0.03em", lineHeight: "1" }}
                >
                  Services
                </h2>
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                  {services.length} active
                </span>
              </div>

              {services.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-line-cream bg-surface-card p-8 text-center text-sm text-ink-soft">
                  No bookable services yet. Check back soon.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {services.map((service, idx) => (
                    <ServiceRow
                      key={service.id}
                      service={service}
                      palette={PALETTES[idx % PALETTES.length]}
                      featured={service.isFeatured && idx === 0}
                      onOpen={() => openServiceDetail(service)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* reviews */}
            {reviewSummary.reviewCount > 0 ? (
              <div>
                <div className="flex items-end justify-between">
                  <div>
                    <h2
                      className="text-[24px] font-extrabold md:text-[28px]"
                      style={{ letterSpacing: "-0.03em", lineHeight: "1" }}
                    >
                      Reviews
                    </h2>
                    <p className="mt-1 text-[13px] text-ink-soft">
                      <Stars rating={reviewSummary.averageRating ?? 0} />{" "}
                      <span className="font-bold tabular-nums text-ink-strong">
                        {reviewSummary.averageRating?.toFixed(1)}
                      </span>{" "}
                      ·{" "}
                      <span className="tabular-nums">
                        {reviewSummary.reviewCount} verified{" "}
                        {reviewSummary.reviewCount === 1 ? "review" : "reviews"}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-line-cream bg-surface-card p-5 shadow-[0_1px_0_rgba(17,24,39,0.04),0_12px_32px_-16px_rgba(17,24,39,0.10)]">
                  <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                    <div className="flex flex-col items-center justify-center text-center">
                      <p
                        className="text-[44px] font-extrabold"
                        style={{ letterSpacing: "-0.03em", lineHeight: "1" }}
                      >
                        {reviewSummary.averageRating?.toFixed(1) ?? "—"}
                      </p>
                      <p className="text-[14px] text-warning-amber">
                        <Stars rating={reviewSummary.averageRating ?? 0} />
                      </p>
                      <p className="mt-1 text-[12px] tabular-nums text-ink-soft">
                        {reviewSummary.reviewCount} reviews
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {([5, 4, 3, 2, 1] as const).map((star) => (
                        <div key={star} className="flex items-center gap-3">
                          <span className="w-6 text-right text-[11px] font-bold tabular-nums text-ink-muted">
                            {star}★
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line-subtle">
                            <div
                              className="h-full bg-warning-amber"
                              style={{
                                width: `${pct(dist[String(star) as keyof typeof dist] ?? 0)}%`,
                              }}
                            />
                          </div>
                          <span className="w-10 text-right text-[11px] tabular-nums text-ink-soft">
                            {dist[String(star) as keyof typeof dist] ?? 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {reviews.slice(0, 4).map((review, idx) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      tint={REVIEW_TINTS[idx % REVIEW_TINTS.length]}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {/* RIGHT: sticky booking panel */}
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-2xl border border-line-cream bg-surface-card p-5 shadow-[0_1px_0_rgba(17,24,39,0.04),0_12px_32px_-16px_rgba(17,24,39,0.10)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                Book directly
              </p>
              <h3 className="mt-2 text-[18px] font-bold">
                Pick a service to start
              </h3>
              <p className="mt-1 text-[13px] text-ink-soft">
                All times shown in your local timezone.
              </p>

              {services.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {services.map((service, idx) => (
                    <button
                      key={service.id}
                      type="button"
                      onClick={() => openServiceDetail(service)}
                      className={
                        idx === 0
                          ? "flex w-full items-center justify-between rounded-xl border border-brand-tint-400 bg-brand-tint-50 px-3.5 py-3 text-left hover:bg-brand-tint-100"
                          : "flex w-full items-center justify-between rounded-xl border border-line-cream bg-surface-card px-3.5 py-3 text-left hover:bg-surface-page"
                      }
                    >
                      <div className="leading-tight">
                        <p className="text-[13px] font-bold">{service.title}</p>
                        <p className="text-[11px] tabular-nums text-ink-soft">
                          {service.durationMinutes} min
                          {formatPriceLabel(service) ? (
                            <> · {formatPriceLabel(service)}</>
                          ) : null}
                        </p>
                      </div>
                      <ChevronRight
                        className={
                          idx === 0
                            ? "size-4 text-brand"
                            : "size-4 text-ink-muted"
                        }
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-line-cream bg-surface-page px-3.5 py-4 text-center text-[12px] text-ink-soft">
                  No active services yet.
                </p>
              )}

              <div className="mt-4 rounded-xl border border-line-cream bg-surface-page p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                  Trust &amp; safety
                </p>
                <ul className="mt-2 space-y-1.5 text-[12px] leading-[1.5] text-ink-body">
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 size-3.5 text-success" />{" "}
                    Every booking is email-verified
                  </li>
                  <li className="flex items-start gap-2">
                    <LinkIcon className="mt-0.5 size-3.5 text-purple" />{" "}
                    Secure cancellation links in confirmations
                  </li>
                  <li className="flex items-start gap-2">
                    <CalendarCheck2 className="mt-0.5 size-3.5 text-brand" />{" "}
                    Add-to-calendar links after you book
                  </li>
                </ul>
              </div>
            </div>

            {host.instagramUrl ||
            host.websiteUrl ||
            host.location ? (
              <div className="mt-4 rounded-2xl border border-line-cream bg-surface-card p-5 shadow-[0_1px_0_rgba(17,24,39,0.04),0_12px_32px_-16px_rgba(17,24,39,0.10)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                  Find {firstName(host.name)}
                </p>
                <div className="mt-3 space-y-2">
                  {host.instagramUrl ? (
                    <a
                      href={host.instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-line-cream bg-surface-card px-3 py-2.5 hover:bg-surface-page"
                    >
                      <span className="flex size-8 items-center justify-center rounded-lg bg-brand-tint-100 text-brand">
                        <AtSign className="size-4" />
                      </span>
                      <span className="truncate text-[13px] font-semibold">
                        {stripInstagramPrefix(host.instagramUrl)}
                      </span>
                    </a>
                  ) : null}
                  {host.websiteUrl ? (
                    <a
                      href={host.websiteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-line-cream bg-surface-card px-3 py-2.5 hover:bg-surface-page"
                    >
                      <span className="flex size-8 items-center justify-center rounded-lg bg-purple-tint text-purple">
                        <Globe className="size-4" />
                      </span>
                      <span className="truncate text-[13px] font-semibold">
                        {stripUrlScheme(host.websiteUrl)}
                      </span>
                    </a>
                  ) : null}
                  {host.location ? (
                    <div className="flex items-center gap-3 rounded-xl border border-line-cream bg-surface-card px-3 py-2.5">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-success-tint-soft text-success-teal">
                        <MapPin className="size-4" />
                      </span>
                      <span className="truncate text-[13px] font-semibold">
                        {host.location}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      <LegalFooter note={`${firstName(host.name)}'s page is hosted here.`} />

      {activeService ? (
        <ServiceDetailModal
          hostSlug={host.slug}
          service={activeService}
          reviews={reviews.filter(
            (r) => r.eventTypeTitle === activeService.title,
          )}
          onClose={closeServiceDetail}
        />
      ) : null}
    </div>
  );
}

const REVIEW_TINTS = [
  "linear-gradient(135deg,#A855F7,#7C4DFF)",
  "linear-gradient(135deg,#10B981,#0D9488)",
  "linear-gradient(135deg,#F97316,#EA580C)",
  "linear-gradient(135deg,#EC4899,#A855F7)",
];

function ServiceDetailModal({
  hostSlug,
  service,
  reviews,
  onClose,
}: {
  hostSlug: string;
  service: ServiceItem;
  reviews: PublicHostProfile["reviews"];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [nextSlot, setNextSlot] = useState<AvailableSlot | null>(null);
  const [slotState, setSlotState] = useState<"loading" | "ready" | "none">(
    "loading",
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const galleryImages = useMemo(() => servicePhotoUrls(service), [service]);
  const lightboxImage =
    lightboxIndex === null ? null : (galleryImages[lightboxIndex] ?? null);

  // ESC closes the photo viewer first, then the service modal.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (lightboxIndex !== null) {
          setLightboxIndex(null);
          return;
        }
        onClose();
      }

      if (lightboxIndex === null || galleryImages.length < 2) return;

      if (event.key === "ArrowLeft") {
        setLightboxIndex((index) =>
          index === null
            ? index
            : (index - 1 + galleryImages.length) % galleryImages.length,
        );
      }

      if (event.key === "ArrowRight") {
        setLightboxIndex((index) =>
          index === null ? index : (index + 1) % galleryImages.length,
        );
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [galleryImages.length, lightboxIndex, onClose]);

  // Pull the next available slot inside the booking horizon so guests see a
  // concrete "Next available" line before committing to the booking flow.
  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const start = new Date();
        const end = new Date(start.getTime() + 21 * 86_400_000);
        const guestTimezone =
          typeof Intl !== "undefined"
            ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
            : "UTC";
        const params = new URLSearchParams({
          start: start.toISOString(),
          end: end.toISOString(),
          timezone: guestTimezone,
        });
        const slots = await apiRequest<AvailableSlot[]>(
          `/public/${encodeURIComponent(hostSlug)}/${encodeURIComponent(service.slug)}/slots?${params.toString()}`,
        );
        if (!alive) return;
        if (slots.length > 0) {
          setNextSlot(slots[0]);
          setSlotState("ready");
        } else {
          setSlotState("none");
        }
      } catch {
        if (alive) setSlotState("none");
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [hostSlug, service.slug]);

  const initialFromTitle = (service.title || "?").charAt(0).toUpperCase();
  const includedLines = useMemo(
    () => splitIntoLines(service.whatIncluded),
    [service.whatIncluded],
  );
  const priceLabel = formatPriceLabel(service);
  const bookHref = `/${encodeURIComponent(hostSlug)}/${encodeURIComponent(service.slug)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-detail-title"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-strong/55 backdrop-blur-sm md:items-center md:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="flex max-h-[94vh] w-full max-w-[920px] flex-col rounded-t-[24px] bg-surface-card shadow-[0_-24px_64px_-16px_rgba(11,18,32,0.35)] md:max-h-[90vh] md:rounded-[24px]"
      >
        {/* Header strip */}
        <div className="flex items-center justify-between gap-3 border-b border-line-cream px-5 py-3.5 md:px-7">
          <div className="flex min-w-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-brand">
              Service detail
            </span>
            <p className="hidden truncate text-[12px] tabular-nums text-ink-muted sm:block">
              bookvella.com/{hostSlug}/{service.slug}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-line-soft bg-surface-card text-ink-soft hover:bg-surface-soft"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto">
          {/* Hero + gallery */}
          <div className="px-5 pt-5 md:px-7 md:pt-7">
            {galleryImages.length > 0 ? (
              <ServicePhotoGallery
                images={galleryImages}
                title={service.title}
                onOpen={setLightboxIndex}
              />
            ) : (
              <div
                className="relative h-[220px] overflow-hidden rounded-[14px] md:h-[320px]"
                style={{ background: PALETTES[0].heroBg }}
                role="img"
                aria-label={`${service.title} photo placeholder`}
              >
                <div className="absolute inset-0 flex items-center justify-center text-[40px] font-extrabold text-brand">
                  {initialFromTitle}
                </div>
              </div>
            )}
          </div>

          {/* Title row */}
          <div className="mt-6 px-5 md:px-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id="service-detail-title"
                  className="text-[26px] font-extrabold md:text-[32px]"
                  style={{ letterSpacing: "-0.03em", lineHeight: "1" }}
                >
                  {service.title}
                </h2>
                <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-ink-body">
                  <Chip>
                    <Clock className="size-3.5 text-ink-muted" />
                    {service.durationMinutes} min
                  </Chip>
                  <Chip>
                    {locationGlyph(service.locationType)}
                    {service.locationDetails ||
                      formatLocationLabel(service.locationType)}
                  </Chip>
                  {reviews.length > 0 ? (
                    <Chip>
                      <Stars
                        rating={
                          reviews.reduce((s, r) => s + r.rating, 0) /
                          reviews.length
                        }
                      />
                      <span className="tabular-nums">
                        {(
                          reviews.reduce((s, r) => s + r.rating, 0) /
                          reviews.length
                        ).toFixed(1)}{" "}
                        · {reviews.length}{" "}
                        {reviews.length === 1 ? "review" : "reviews"}
                      </span>
                    </Chip>
                  ) : null}
                </div>
              </div>
              {priceLabel ? (
                <div className="text-right">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    Price
                  </p>
                  <p
                    className="text-[28px] font-extrabold md:text-[32px]"
                    style={{
                      color: "var(--color-brand)",
                      letterSpacing: "-0.03em",
                      lineHeight: "1",
                    }}
                  >
                    {priceLabel}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          {/* Description */}
          {service.description ? (
            <div className="mt-6 px-5 md:px-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                About this service
              </p>
              <p className="mt-2 text-[15px] leading-[1.7] text-ink-body">
                {service.description}
              </p>
            </div>
          ) : null}

          {/* Includes + before-you-arrive */}
          {(includedLines.length > 0 || service.preparationNotes) ? (
            <div className="mt-6 grid gap-4 px-5 md:grid-cols-2 md:px-7">
              {includedLines.length > 0 ? (
                <div className="rounded-2xl border border-line-cream bg-surface-page p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-surface-card text-success">
                      <ListChecks className="size-4" />
                    </span>
                    <p className="text-[13px] font-bold">What&apos;s included</p>
                  </div>
                  <ul className="mt-3 space-y-2 text-[13.5px] text-ink-body">
                    {includedLines.map((line, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-success" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {service.preparationNotes ? (
                <div className="rounded-2xl border border-line-cream bg-surface-page p-5">
                  <div className="flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-surface-card text-brand">
                      <Sparkles className="size-4" />
                    </span>
                    <p className="text-[13px] font-bold">Before you arrive</p>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-[13.5px] leading-[1.65] text-ink-body">
                    {service.preparationNotes}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Meta strip — cancellation tile removed per host policy. */}
          <div className="mt-4 px-5 md:px-7">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <MetaTile
                label="Duration"
                value={`${service.durationMinutes} minutes`}
              />
              <MetaTile
                label="Format"
                value={formatLocationLabel(service.locationType)}
              />
              <MetaTile label="Confirmation" value="Email verified" />
            </div>
          </div>

          {/* Reviews for this service */}
          {reviews.length > 0 ? (
            <div className="mt-6 px-5 md:px-7">
              <div className="flex items-end justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                  Reviews for this service
                </p>
                <p className="text-[11px] tabular-nums text-ink-muted">
                  {reviews.length}{" "}
                  {reviews.length === 1 ? "review" : "reviews"}
                </p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {reviews.slice(0, 4).map((review, idx) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    tint={REVIEW_TINTS[idx % REVIEW_TINTS.length]}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {/* Next available slot teaser */}
          <div className="mb-6 mt-6 px-5 md:px-7">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-line-cream bg-surface-page p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-surface-card text-success">
                  <CalendarCheck2 className="size-4" />
                </span>
                <div className="leading-tight">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
                    Next available
                  </p>
                  <p className="text-[14px] font-bold tabular-nums">
                    {slotState === "loading"
                      ? "Checking availability…"
                      : slotState === "none" || !nextSlot
                        ? "Pick a time to see open slots"
                        : formatSlotLabel(nextSlot)}
                  </p>
                </div>
              </div>
              <p className="hidden text-[11px] text-ink-muted sm:block">
                Times shown in your timezone
              </p>
            </div>
          </div>
        </div>

        {/* Sticky footer CTA */}
        <div className="flex items-center justify-between gap-3 border-t border-line-cream bg-surface-card px-5 py-3.5 md:px-7">
          <div className="leading-tight">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
              You&apos;re booking
            </p>
            <p className="text-[13.5px] font-bold">
              {service.title}
              {priceLabel ? ` · ${priceLabel}` : ""}
            </p>
          </div>
          <Link
            href={bookHref}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-brand-coral to-brand-orange px-5 text-[13px] font-bold text-white shadow-sm hover:brightness-105"
          >
            Continue to book <ArrowRight className="size-4" />
          </Link>
        </div>

        {lightboxImage ? (
          <PhotoLightbox
            images={galleryImages}
            activeIndex={lightboxIndex ?? 0}
            title={service.title}
            onClose={() => setLightboxIndex(null)}
            onChange={setLightboxIndex}
          />
        ) : null}
      </div>
    </div>
  );
}

function ServicePhotoGallery({
  images,
  title,
  onOpen,
}: {
  images: string[];
  title: string;
  onOpen: (index: number) => void;
}) {
  if (images.length === 1) {
    return (
      <GalleryPhotoButton
        url={images[0]}
        title={title}
        index={0}
        variant="single"
        onOpen={onOpen}
      />
    );
  }

  return (
    <div className="grid gap-2 md:grid-cols-[1.45fr_1fr]">
      <GalleryPhotoButton
        url={images[0]}
        title={title}
        index={0}
        variant="hero"
        onOpen={onOpen}
      />
      <div
        className={
          images.length > 2
            ? "grid grid-cols-2 gap-2 md:grid-cols-1 md:grid-rows-2"
            : "grid gap-2"
        }
      >
        {images.slice(1, 3).map((url, offset) => {
          const index = offset + 1;
          return (
            <GalleryPhotoButton
              key={`${url}-${index}`}
              url={url}
              title={title}
              index={index}
              variant="thumb"
              showViewAll={index === 2 && images.length > 3}
              total={images.length}
              onOpen={onOpen}
            />
          );
        })}
      </div>
    </div>
  );
}

function GalleryPhotoButton({
  url,
  title,
  index,
  variant,
  showViewAll = false,
  total = 0,
  onOpen,
}: {
  url: string;
  title: string;
  index: number;
  variant: "single" | "hero" | "thumb";
  showViewAll?: boolean;
  total?: number;
  onOpen: (index: number) => void;
}) {
  const isLarge = variant !== "thumb";

  return (
    <button
      type="button"
      aria-label={`Open ${title} photo ${index + 1}`}
      onClick={() => onOpen(index)}
      className={`group relative overflow-hidden rounded-[14px] bg-line-subtle text-left shadow-[0_1px_0_rgba(17,24,39,0.04)] outline-none ring-offset-2 ring-offset-white transition focus-visible:ring-2 focus-visible:ring-brand ${
        variant === "single"
          ? "h-[240px] w-full md:h-[360px]"
          : isLarge
            ? "h-[220px] md:h-[320px]"
            : "h-[112px] min-h-[112px] md:h-full"
      }`}
    >
      <span
        className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.03]"
        style={{ backgroundImage: `url(${url})` }}
        role="img"
        aria-label={`${title} photo ${index + 1}`}
      />
      <span className="absolute inset-0 bg-gradient-to-t from-ink-strong/35 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
      {isLarge ? (
        <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-surface-card/95 px-3 py-2 text-[12px] font-bold text-ink-strong shadow-sm backdrop-blur">
          <Maximize2 className="size-3.5" />
          Open photo
        </span>
      ) : null}
      {showViewAll ? (
        <span className="absolute inset-0 grid place-items-center bg-ink-strong/45 text-[12px] font-bold text-white backdrop-blur-[1px]">
          View all {total} photos
        </span>
      ) : null}
    </button>
  );
}

function PhotoLightbox({
  images,
  activeIndex,
  title,
  onClose,
  onChange,
}: {
  images: string[];
  activeIndex: number;
  title: string;
  onClose: () => void;
  onChange: (index: number) => void;
}) {
  const activeImage = images[activeIndex];
  const hasMany = images.length > 1;

  function move(delta: number) {
    onChange((activeIndex + delta + images.length) % images.length);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-ink-strong/95 p-4 text-white md:p-6"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-bold">{title}</p>
          <p className="text-[12px] text-white/60">
            Photo {activeIndex + 1} of {images.length}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close photo viewer"
          onClick={onClose}
          className="inline-flex size-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="relative mt-4 flex flex-1 items-center justify-center overflow-hidden">
        {hasMany ? (
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(event) => {
              event.stopPropagation();
              move(-1);
            }}
            className="absolute left-0 z-10 inline-flex size-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur hover:bg-white/20 md:left-2"
          >
            <ChevronLeft className="size-5" />
          </button>
        ) : null}

        <div
          className="h-full max-h-full w-full rounded-2xl bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${activeImage})` }}
          role="img"
          aria-label={`${title} photo ${activeIndex + 1}`}
          onClick={(event) => event.stopPropagation()}
        />

        {hasMany ? (
          <button
            type="button"
            aria-label="Next photo"
            onClick={(event) => {
              event.stopPropagation();
              move(1);
            }}
            className="absolute right-0 z-10 inline-flex size-11 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur hover:bg-white/20 md:right-2"
          >
            <ChevronRight className="size-5" />
          </button>
        ) : null}
      </div>

      {hasMany ? (
        <div
          className="mt-4 flex justify-center gap-2 overflow-x-auto pb-1"
          onClick={(event) => event.stopPropagation()}
        >
          {images.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              aria-label={`Show photo ${index + 1}`}
              onClick={() => onChange(index)}
              className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border bg-cover bg-center transition ${
                index === activeIndex
                  ? "border-surface-card opacity-100"
                  : "border-white/20 opacity-60 hover:opacity-90"
              }`}
              style={{ backgroundImage: `url(${url})` }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MetaTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line-cream bg-surface-card p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p className="mt-0.5 text-[13.5px] font-bold tabular-nums">{value}</p>
    </div>
  );
}

function splitIntoLines(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^[-*•]\s*/, ""))
    .filter(Boolean);
}

function servicePhotoUrls(service: ServiceItem): string[] {
  const seen = new Set<string>();
  return [service.imageUrl, ...service.galleryImageUrls].filter(
    (url): url is string => {
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    },
  );
}

function formatSlotLabel(slot: AvailableSlot): string {
  // `startTimeGuest` is an ISO-like "YYYY-MM-DDTHH:MM:SS" string in the guest's
  // timezone (no Z suffix). Parse pieces directly so we don't shift back to UTC.
  const m =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(slot.startTimeGuest);
  if (!m) return new Date(slot.startTimeUtc).toLocaleString();
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const date = new Date(year, month, day);
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const monthLabel = date.toLocaleDateString("en-US", { month: "short" });
  return `${weekday}, ${day} ${monthLabel} · ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function ServiceRow({
  service,
  palette,
  featured,
  onOpen,
}: {
  service: ServiceItem;
  palette: (typeof PALETTES)[number];
  featured: boolean;
  onOpen: () => void;
}) {
  const locationIcon = locationGlyph(service.locationType);
  return (
    <article className="overflow-hidden rounded-2xl border border-line-cream bg-surface-card shadow-[0_1px_0_rgba(17,24,39,0.04),0_12px_32px_-16px_rgba(17,24,39,0.10)]">
      <div className="grid gap-0 sm:grid-cols-[140px_1fr_auto]">
        <div
          className="relative h-32 sm:h-auto"
          style={{
            background: service.imageUrl
              ? `url(${service.imageUrl}) center/cover`
              : palette.heroBg,
          }}
        >
          {!service.imageUrl ? (
            <div
              className={`absolute inset-0 flex items-center justify-center text-[28px] font-bold ${palette.ink}`}
            >
              ✦
            </div>
          ) : null}
          {featured ? (
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-surface-card/90 px-2 py-1 text-[10px] font-bold text-warning backdrop-blur">
              <Star className="size-3 fill-warning-amber text-warning-amber" /> Featured
            </span>
          ) : null}
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[18px] font-bold">{service.title}</h3>
            <span className="rounded-full bg-success-mint px-2 py-0.5 text-[10px] font-bold text-success">
              Active
            </span>
          </div>
          {service.description ? (
            <p className="mt-1.5 line-clamp-2 text-[13px] text-ink-soft">
              {service.description}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-ink-body">
            <Chip>
              <Clock className="size-3.5 text-ink-muted" />
              {service.durationMinutes} min
            </Chip>
            <Chip>
              {locationIcon}
              {service.locationDetails ||
                formatLocationLabel(service.locationType)}
            </Chip>
            {formatPriceLabel(service) ? (
              <Chip>
                <Banknote className="size-3.5 text-ink-muted" />
                {formatPriceLabel(service)}
              </Chip>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col items-stretch justify-center gap-2 p-5 sm:items-end">
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">
            Availability
          </p>
          <p className="text-[14px] font-bold">Pick a time</p>
          <button
            type="button"
            onClick={onOpen}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-bold ${
              featured
                ? "bg-gradient-to-r from-brand-coral to-brand-orange text-white shadow-sm"
                : "border border-ink-strong bg-surface-card text-ink-strong hover:bg-ink-strong hover:text-surface-card"
            }`}
          >
            View &amp; book <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function ReviewCard({
  review,
  tint,
}: {
  review: PublicHostProfile["reviews"][number];
  tint: string;
}) {
  const initial = (review.guestName || "?").charAt(0).toUpperCase();
  return (
    <article className="rounded-2xl border border-line-cream bg-surface-card p-5 shadow-[0_1px_0_rgba(17,24,39,0.04),0_12px_32px_-16px_rgba(17,24,39,0.10)]">
      <div className="flex items-center gap-3">
        <div
          className="flex size-10 items-center justify-center rounded-xl text-[12px] font-bold text-white"
          style={{ background: tint }}
        >
          {initial}
        </div>
        <div className="flex-1 leading-tight">
          <p className="text-[13px] font-bold">{review.guestName}</p>
          <p className="text-[11px] tabular-nums text-ink-muted">
            {review.eventTypeTitle} · {relativeTime(review.createdAt)}
          </p>
        </div>
        <span className="text-[12px] text-warning-amber">
          <Stars rating={review.rating} />
        </span>
      </div>
      <p className="mt-3 text-[14px] leading-[1.6] text-ink-body">
        &ldquo;{review.comment}&rdquo;
      </p>
    </article>
  );
}

function StatCard({
  icon,
  tint,
  label,
  value,
}: {
  icon: React.ReactNode;
  tint: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-line-cream bg-surface-card p-4">
      <div
        className={`flex size-9 items-center justify-center rounded-xl ${tint}`}
      >
        {icon}
      </div>
      <p className="mt-3 text-[12px] font-bold uppercase tracking-wider text-ink-muted">
        {label}
      </p>
      <p className="text-[14px] font-bold">{value}</p>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line-warm bg-surface-card px-2.5 py-1 text-[12px] font-semibold text-ink-body">
      {children}
    </span>
  );
}

function ExpectationList({ text }: { text: string }) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    return (
      <p className="mt-5 text-[14px] leading-[1.6] text-ink-body">{text}</p>
    );
  }
  return (
    <ul className="mt-5 space-y-3 text-[14px] leading-[1.6] text-ink-body">
      {lines.map((line, idx) => (
        <li key={idx} className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span aria-label={`${filled} out of 5 stars`} className="text-warning-amber">
      {"★".repeat(filled)}
      <span className="text-line-soft">{"★".repeat(5 - filled)}</span>
    </span>
  );
}

function locationGlyph(type: LocationType) {
  if (type === "VIDEO") return <Video className="size-3.5 text-ink-muted" />;
  if (type === "PHONE")
    return <PhoneIcon className="size-3.5 text-ink-muted" />;
  return <MapPin className="size-3.5 text-ink-muted" />;
}

function formatLocationLabel(type: LocationType) {
  if (type === "VIDEO") return "Video call";
  if (type === "PHONE") return "Phone call";
  return "In person";
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  CAD: "$",
  AUD: "$",
};

function formatPriceLabel(service: ServiceItem): string | null {
  return formatPrice({
    priceType: service.priceType,
    priceAmount: service.priceAmount,
    priceMaxAmount: service.priceMaxAmount,
    priceCurrency: service.priceCurrency,
  });
}

function formatPrice({
  priceType,
  priceAmount,
  priceMaxAmount,
  priceCurrency,
}: {
  priceType: PriceType;
  priceAmount: number | null;
  priceMaxAmount: number | null;
  priceCurrency: string;
}): string | null {
  if (priceType === "FREE") return null;
  const symbol = CURRENCY_SYMBOLS[priceCurrency] ?? "$";
  function money(cents: number) {
    return cents % 100 === 0
      ? `${symbol}${cents / 100}`
      : `${symbol}${(cents / 100).toFixed(2)}`;
  }
  if (priceType === "RANGE" && priceAmount != null && priceMaxAmount != null) {
    return `${money(priceAmount)} – ${money(priceMaxAmount)}`;
  }
  if (priceAmount == null) return null;
  if (priceType === "FROM") return `From ${money(priceAmount)}`;
  return money(priceAmount);
}

function typicalVisit(services: ServiceItem[]): string {
  if (services.length === 0) return "—";
  const durations = services.map((s) => s.durationMinutes);
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  if (min === max) return `${min} minutes`;
  return `${min} – ${max} minutes`;
}

function firstName(name: string): string {
  return name.split(/\s+/)[0] || name;
}

function stripInstagramPrefix(value: string) {
  if (!value) return "@host";
  const m = value.match(/instagram\.com\/(@?[^/?#]+)/i);
  if (m) return m[1].startsWith("@") ? m[1] : `@${m[1]}`;
  if (value.startsWith("@")) return value;
  return `@${value.replace(/^https?:\/\//, "")}`;
}

function stripUrlScheme(value: string) {
  return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const day = 86_400_000;
  if (diff < day) return "today";
  if (diff < 2 * day) return "yesterday";
  if (diff < 7 * day) return `${Math.floor(diff / day)} days ago`;
  if (diff < 30 * day) return `${Math.floor(diff / (7 * day))} weeks ago`;
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))} months ago`;
  return `${Math.floor(diff / (365 * day))} years ago`;
}
