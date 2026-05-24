"use client";

import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Banknote,
  CalendarCheck2,
  CheckCircle2,
  ChevronRight,
  Clock,
  AtSign,
  Globe,
  Link as LinkIcon,
  MapPin,
  Phone as PhoneIcon,
  Scissors,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { LegalFooter } from "@/components/legal-footer";
import type { LocationType, PriceType, PublicHostProfile } from "@/lib/api";

type ServiceItem = PublicHostProfile["services"][number];

const PALETTES = [
  {
    heroBg: "linear-gradient(135deg,#FFE0DA 0%,#FFD3A6 60%,#FFC9C2 100%)",
    ink: "text-[#FF5F63]",
  },
  {
    heroBg: "linear-gradient(135deg,#F4EAFF 0%,#E1CFFA 60%,#D7CDF8 100%)",
    ink: "text-[#A855F7]",
  },
  {
    heroBg: "linear-gradient(135deg,#D7F2EA 0%,#B6E4F2 60%,#CFE9E0 100%)",
    ink: "text-[#0D9488]",
  },
  {
    heroBg: "linear-gradient(135deg,#FFE9C7 0%,#FFD08A 60%,#FFC9C2 100%)",
    ink: "text-[#B45309]",
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
    <div className="min-h-screen bg-[#FFFBF7] text-[#0B1220]">
      {/* slim top bar */}
      <header className="border-b border-[#EEE7DF] bg-white">
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
          <p className="text-[12px] text-[#9CA3AF]">
            Powered by Bookvella ·{" "}
            <Link
              href="/register"
              className="font-semibold text-[#0B1220] hover:underline"
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
          <div className="rounded-[28px] border border-[#EEE7DF] bg-white p-6 shadow-[0_1px_0_rgba(17,24,39,0.04),0_12px_32px_-16px_rgba(17,24,39,0.10)] md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div className="flex items-start gap-5">
                <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-br from-[#FF6267] via-[#C661E0] to-[#7C4DFF] text-[32px] font-bold text-white shadow-[0_1px_0_rgba(17,24,39,0.04),0_28px_64px_-32px_rgba(255,95,99,0.30)] md:size-28">
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
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF0EF] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#FF5F63]">
                      Active
                    </span>
                  </div>
                  {host.headline ? (
                    <p className="mt-2 text-[15px] text-[#374151]">
                      {host.headline}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {host.businessCategory ? (
                      <Chip>
                        <Scissors className="size-3.5 text-[#FF5F63]" />
                        {host.businessCategory}
                      </Chip>
                    ) : null}
                    {host.location ? (
                      <Chip>
                        <MapPin className="size-3.5 text-[#9CA3AF]" />
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
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-[13px] font-bold hover:bg-[#F9FAFB]"
                >
                  <Share2 className="size-4" /> Share
                </button>
                <a
                  href="#services"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] px-5 text-[13px] font-bold text-white shadow-sm hover:brightness-105"
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
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
                    Bio
                  </span>
                </div>
                <p className="mt-4 max-w-[620px] text-[15px] leading-[1.7] text-[#374151]">
                  {host.about}
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  <StatCard
                    icon={<Clock className="size-4" />}
                    tint="bg-[#FFF0EF] text-[#FF5F63]"
                    label="Typical visit"
                    value={typicalVisit(services)}
                  />
                  <StatCard
                    icon={<BadgeCheck className="size-4" />}
                    tint="bg-[#F4EAFF] text-[#A855F7]"
                    label="Verified host since"
                    value={verifiedMonth}
                  />
                  <StatCard
                    icon={<CalendarCheck2 className="size-4" />}
                    tint="bg-[#E0F7EF] text-[#0D9488]"
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
              <div className="rounded-2xl border border-[#EEE7DF] bg-white p-6 shadow-[0_1px_0_rgba(17,24,39,0.04),0_12px_32px_-16px_rgba(17,24,39,0.10)]">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-[#FFF0EF] text-[#FF5F63]">
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
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
                  {services.length} active
                </span>
              </div>

              {services.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-[#EEE7DF] bg-white p-8 text-center text-sm text-[#6B7280]">
                  No bookable services yet. Check back soon.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {services.map((service, idx) => (
                    <ServiceRow
                      key={service.id}
                      service={service}
                      palette={PALETTES[idx % PALETTES.length]}
                      hostSlug={host.slug}
                      featured={service.isFeatured && idx === 0}
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
                    <p className="mt-1 text-[13px] text-[#6B7280]">
                      <Stars rating={reviewSummary.averageRating ?? 0} />{" "}
                      <span className="font-bold tabular-nums text-[#0B1220]">
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

                <div className="mt-5 rounded-2xl border border-[#EEE7DF] bg-white p-5 shadow-[0_1px_0_rgba(17,24,39,0.04),0_12px_32px_-16px_rgba(17,24,39,0.10)]">
                  <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                    <div className="flex flex-col items-center justify-center text-center">
                      <p
                        className="text-[44px] font-extrabold"
                        style={{ letterSpacing: "-0.03em", lineHeight: "1" }}
                      >
                        {reviewSummary.averageRating?.toFixed(1) ?? "—"}
                      </p>
                      <p className="text-[14px] text-amber-500">
                        <Stars rating={reviewSummary.averageRating ?? 0} />
                      </p>
                      <p className="mt-1 text-[12px] tabular-nums text-[#6B7280]">
                        {reviewSummary.reviewCount} reviews
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      {([5, 4, 3, 2, 1] as const).map((star) => (
                        <div key={star} className="flex items-center gap-3">
                          <span className="w-6 text-right text-[11px] font-bold tabular-nums text-[#9CA3AF]">
                            {star}★
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F3F4F6]">
                            <div
                              className="h-full bg-amber-400"
                              style={{
                                width: `${pct(dist[String(star) as keyof typeof dist] ?? 0)}%`,
                              }}
                            />
                          </div>
                          <span className="w-10 text-right text-[11px] tabular-nums text-[#6B7280]">
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
            <div className="rounded-2xl border border-[#EEE7DF] bg-white p-5 shadow-[0_1px_0_rgba(17,24,39,0.04),0_12px_32px_-16px_rgba(17,24,39,0.10)]">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
                Book directly
              </p>
              <h3 className="mt-2 text-[18px] font-bold">
                Pick a service to start
              </h3>
              <p className="mt-1 text-[13px] text-[#6B7280]">
                All times in your local timezone. Free cancellation up to 2h
                before.
              </p>

              {services.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {services.map((service, idx) => (
                    <Link
                      key={service.id}
                      href={`/${host.slug}/${service.slug}`}
                      className={
                        idx === 0
                          ? "flex items-center justify-between rounded-xl border border-[#FFD2CE] bg-[#FFF7F5] px-3.5 py-3 hover:bg-[#FFF0EF]"
                          : "flex items-center justify-between rounded-xl border border-[#EEE7DF] bg-white px-3.5 py-3 hover:bg-[#FFFBF7]"
                      }
                    >
                      <div className="leading-tight">
                        <p className="text-[13px] font-bold">{service.title}</p>
                        <p className="text-[11px] tabular-nums text-[#6B7280]">
                          {service.durationMinutes} min ·{" "}
                          {formatPriceLabel(service) ?? "Free / on request"}
                        </p>
                      </div>
                      <ChevronRight
                        className={
                          idx === 0
                            ? "size-4 text-[#FF5F63]"
                            : "size-4 text-[#9CA3AF]"
                        }
                      />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-[#EEE7DF] bg-[#FFFBF7] px-3.5 py-4 text-center text-[12px] text-[#6B7280]">
                  No active services yet.
                </p>
              )}

              <div className="mt-4 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-3.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                  Trust &amp; safety
                </p>
                <ul className="mt-2 space-y-1.5 text-[12px] leading-[1.5] text-[#374151]">
                  <li className="flex items-start gap-2">
                    <ShieldCheck className="mt-0.5 size-3.5 text-[#16A34A]" />{" "}
                    Every booking is email-verified
                  </li>
                  <li className="flex items-start gap-2">
                    <LinkIcon className="mt-0.5 size-3.5 text-[#A855F7]" />{" "}
                    Secure cancellation links in confirmations
                  </li>
                  <li className="flex items-start gap-2">
                    <CalendarCheck2 className="mt-0.5 size-3.5 text-[#FF5F63]" />{" "}
                    Add-to-calendar links after you book
                  </li>
                </ul>
              </div>
            </div>

            {host.instagramUrl ||
            host.websiteUrl ||
            host.location ? (
              <div className="mt-4 rounded-2xl border border-[#EEE7DF] bg-white p-5 shadow-[0_1px_0_rgba(17,24,39,0.04),0_12px_32px_-16px_rgba(17,24,39,0.10)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
                  Find {firstName(host.name)}
                </p>
                <div className="mt-3 space-y-2">
                  {host.instagramUrl ? (
                    <a
                      href={host.instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-[#EEE7DF] bg-white px-3 py-2.5 hover:bg-[#FFFBF7]"
                    >
                      <span className="flex size-8 items-center justify-center rounded-lg bg-[#FFF0EF] text-[#FF5F63]">
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
                      className="flex items-center gap-3 rounded-xl border border-[#EEE7DF] bg-white px-3 py-2.5 hover:bg-[#FFFBF7]"
                    >
                      <span className="flex size-8 items-center justify-center rounded-lg bg-[#F4EAFF] text-[#A855F7]">
                        <Globe className="size-4" />
                      </span>
                      <span className="truncate text-[13px] font-semibold">
                        {stripUrlScheme(host.websiteUrl)}
                      </span>
                    </a>
                  ) : null}
                  {host.location ? (
                    <div className="flex items-center gap-3 rounded-xl border border-[#EEE7DF] bg-white px-3 py-2.5">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-[#E0F7EF] text-[#0D9488]">
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
    </div>
  );
}

const REVIEW_TINTS = [
  "linear-gradient(135deg,#A855F7,#7C4DFF)",
  "linear-gradient(135deg,#10B981,#0D9488)",
  "linear-gradient(135deg,#F97316,#EA580C)",
  "linear-gradient(135deg,#EC4899,#A855F7)",
];

function ServiceRow({
  service,
  palette,
  hostSlug,
  featured,
}: {
  service: ServiceItem;
  palette: (typeof PALETTES)[number];
  hostSlug: string;
  featured: boolean;
}) {
  const locationIcon = locationGlyph(service.locationType);
  return (
    <article className="overflow-hidden rounded-2xl border border-[#EEE7DF] bg-white shadow-[0_1px_0_rgba(17,24,39,0.04),0_12px_32px_-16px_rgba(17,24,39,0.10)]">
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
            <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold text-[#B45309] backdrop-blur">
              <Star className="size-3 fill-[#F59E0B] text-[#F59E0B]" /> Featured
            </span>
          ) : null}
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[18px] font-bold">{service.title}</h3>
            <span className="rounded-full bg-[#E6F4EA] px-2 py-0.5 text-[10px] font-bold text-[#16A34A]">
              Active
            </span>
          </div>
          {service.description ? (
            <p className="mt-1.5 line-clamp-2 text-[13px] text-[#6B7280]">
              {service.description}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-[#374151]">
            <Chip>
              <Clock className="size-3.5 text-[#9CA3AF]" />
              {service.durationMinutes} min
            </Chip>
            <Chip>
              {locationIcon}
              {service.locationDetails ||
                formatLocationLabel(service.locationType)}
            </Chip>
            {formatPriceLabel(service) ? (
              <Chip>
                <Banknote className="size-3.5 text-[#9CA3AF]" />
                {formatPriceLabel(service)}
              </Chip>
            ) : (
              <Chip>
                <Banknote className="size-3.5 text-[#9CA3AF]" />
                Free / on request
              </Chip>
            )}
          </div>
        </div>
        <div className="flex flex-col items-stretch justify-center gap-2 p-5 sm:items-end">
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
            Availability
          </p>
          <p className="text-[14px] font-bold">Pick a time</p>
          <Link
            href={`/${hostSlug}/${service.slug}`}
            className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-[13px] font-bold ${
              featured
                ? "bg-gradient-to-r from-[#FF6267] to-[#FF8A4C] text-white shadow-sm"
                : "border border-[#0B1220] bg-white text-[#0B1220] hover:bg-[#0B1220] hover:text-white"
            }`}
          >
            Book this <ArrowRight className="size-4" />
          </Link>
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
    <article className="rounded-2xl border border-[#EEE7DF] bg-white p-5 shadow-[0_1px_0_rgba(17,24,39,0.04),0_12px_32px_-16px_rgba(17,24,39,0.10)]">
      <div className="flex items-center gap-3">
        <div
          className="flex size-10 items-center justify-center rounded-xl text-[12px] font-bold text-white"
          style={{ background: tint }}
        >
          {initial}
        </div>
        <div className="flex-1 leading-tight">
          <p className="text-[13px] font-bold">{review.guestName}</p>
          <p className="text-[11px] tabular-nums text-[#9CA3AF]">
            {review.eventTypeTitle} · {relativeTime(review.createdAt)}
          </p>
        </div>
        <span className="text-[12px] text-amber-500">
          <Stars rating={review.rating} />
        </span>
      </div>
      <p className="mt-3 text-[14px] leading-[1.6] text-[#374151]">
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
    <div className="rounded-2xl border border-[#EEE7DF] bg-white p-4">
      <div
        className={`flex size-9 items-center justify-center rounded-xl ${tint}`}
      >
        {icon}
      </div>
      <p className="mt-3 text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF]">
        {label}
      </p>
      <p className="text-[14px] font-bold">{value}</p>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E8DED7] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#374151]">
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
      <p className="mt-5 text-[14px] leading-[1.6] text-[#374151]">{text}</p>
    );
  }
  return (
    <ul className="mt-5 space-y-3 text-[14px] leading-[1.6] text-[#374151]">
      {lines.map((line, idx) => (
        <li key={idx} className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#16A34A]" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span aria-label={`${filled} out of 5 stars`} className="text-amber-500">
      {"★".repeat(filled)}
      <span className="text-[#E5E7EB]">{"★".repeat(5 - filled)}</span>
    </span>
  );
}

function locationGlyph(type: LocationType) {
  if (type === "VIDEO") return <Video className="size-3.5 text-[#9CA3AF]" />;
  if (type === "PHONE")
    return <PhoneIcon className="size-3.5 text-[#9CA3AF]" />;
  return <MapPin className="size-3.5 text-[#9CA3AF]" />;
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
