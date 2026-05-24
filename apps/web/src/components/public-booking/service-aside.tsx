"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock,
  Info,
  Lock,
  MailCheck,
  MapPin,
  Phone,
  Scissors,
  Tag,
  Timer,
  UserRound,
  Video,
} from "lucide-react";
import type { PublicEvent } from "@/lib/api";
import { buildPriceLabel, formatLocationLabel, splitLines } from "./helpers";

export function ServiceAside({ data }: { data: PublicEvent }) {
  const { host, eventType, reviews, reviewSummary } = data;
  const included = splitLines(eventType.whatIncluded);
  const priceLabel = buildPriceLabel({
    priceType: eventType.priceType,
    priceAmount: eventType.priceAmount,
    priceMaxAmount: eventType.priceMaxAmount,
    priceCurrency: eventType.priceCurrency,
  });

  return (
    <aside
      className="space-y-5 md:sticky md:top-[80px] md:max-h-[calc(100vh-100px)] md:self-start md:overflow-y-auto md:pr-5 md:[scrollbar-gutter:stable] md:[scrollbar-width:thin]"
    >
      <Link
        href={`/${host.slug}`}
        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#6B7280] hover:text-[#0B1220]"
      >
        <ArrowLeft className="size-3.5" />
        {host.name.split(/\s+/)[0]}&apos;s profile
      </Link>

      {/* Main photo */}
      <div
        className="relative h-[200px] overflow-hidden rounded-2xl"
        style={{
          background: eventType.imageUrl
            ? `url(${eventType.imageUrl}) center/cover`
            : "linear-gradient(135deg,#FFE0DA 0%,#FFD3A6 60%,#FFC9C2 100%)",
        }}
      >
        {!eventType.imageUrl ? (
          <div className="absolute inset-0 grid place-items-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-white/70 text-[#FF5F63] backdrop-blur">
              <Scissors className="size-6" />
            </span>
          </div>
        ) : null}
      </div>

      {/* Title + price + meta */}
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1
            className="text-[26px] font-extrabold"
            style={{ letterSpacing: "-0.03em", lineHeight: "1.05" }}
          >
            {eventType.title}
          </h1>
          <p className="text-[20px] font-bold text-[#FF5F63]">{priceLabel}</p>
        </div>
        {eventType.category ? (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#E8DED7] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#374151]">
            <Tag className="size-3.5 text-[#9CA3AF]" />
            {eventType.category}
          </span>
        ) : null}
        {eventType.description ? (
          <p className="mt-3 text-[13.5px] leading-[1.6] text-[#374151]">
            {eventType.description}
          </p>
        ) : null}
        <ul className="mt-4 space-y-2 text-[13px]">
          <li className="flex items-center gap-2.5">
            <Clock className="size-4 text-[#FF5F63]" />
            <span>
              <strong>{eventType.durationMinutes} minutes</strong> · ends after
              one session
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <LocationIcon type={eventType.locationType} />
            <span>
              {formatLocationLabel(eventType.locationType)}
              {eventType.locationDetails ? (
                <>
                  {" · "}
                  <strong>{eventType.locationDetails}</strong>
                </>
              ) : null}
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <UserRound className="size-4 text-[#0D9488]" />
            <span>One guest per session</span>
          </li>
          {eventType.bufferBeforeMinutes + eventType.bufferAfterMinutes > 0 ? (
            <li className="flex items-center gap-2.5">
              <Timer className="size-4 text-[#A855F7]" />
              <span>
                {formatBuffer(
                  eventType.bufferBeforeMinutes,
                  eventType.bufferAfterMinutes,
                )}
              </span>
            </li>
          ) : null}
          <li className="flex items-center gap-2.5">
            <MailCheck className="size-4 text-[#10B981]" />
            <span>Email-verified booking · one-click cancel link</span>
          </li>
        </ul>
      </div>

      {included.length > 0 ? (
        <div className="rounded-2xl border border-[#EEE7DF] bg-white p-4">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
            What&apos;s included
          </p>
          <ul className="mt-3 space-y-2 text-[13px]">
            {included.slice(0, 6).map((item, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <Check className="mt-1 size-3.5 shrink-0 text-[#16A34A]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {eventType.galleryImageUrls && eventType.galleryImageUrls.length > 0 ? (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
            More photos
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {eventType.galleryImageUrls.slice(0, 6).map((url, idx) => (
              <div
                key={idx}
                className="aspect-square overflow-hidden rounded-lg border border-[#EEE7DF] bg-cover bg-center"
                style={{ backgroundImage: `url(${url})` }}
              />
            ))}
          </div>
        </div>
      ) : null}

      {eventType.preparationNotes ? (
        <div className="rounded-2xl border border-[#FCC9C5] bg-[#FFF7F5] p-4">
          <div className="flex items-center gap-2">
            <Info className="size-4 text-[#FF5F63]" />
            <p className="text-[12.5px] font-bold">Before your appointment</p>
          </div>
          <p className="mt-2 text-[12.5px] leading-[1.6] text-[#374151]">
            {eventType.preparationNotes}
          </p>
        </div>
      ) : null}

      {/* Host bio */}
      <div className="rounded-2xl border border-[#EEE7DF] bg-white p-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
          Your host
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div
            className="flex size-11 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#FF6267] via-[#C661E0] to-[#7C4DFF] text-[15px] font-bold text-white"
            style={
              host.profileImageUrl
                ? {
                    backgroundImage: `url(${host.profileImageUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : undefined
            }
          >
            {!host.profileImageUrl
              ? host.name.charAt(0).toUpperCase()
              : null}
          </div>
          <div className="min-w-0">
            <p className="text-[14px] font-bold">{host.name}</p>
            <p className="text-[12px] text-[#6B7280]">
              {host.headline ?? host.businessCategory ?? "Bookvella host"}
            </p>
          </div>
        </div>
        {reviewSummary.reviewCount > 0 ? (
          <div className="mt-3 flex items-center gap-2 text-[12px]">
            <span className="text-amber-500">
              {"★".repeat(
                Math.max(
                  0,
                  Math.min(5, Math.round(reviewSummary.averageRating ?? 0)),
                ),
              )}
            </span>
            <span className="font-bold tabular-nums">
              {(reviewSummary.averageRating ?? 0).toFixed(1)}
            </span>
            <span className="tabular-nums text-[#9CA3AF]">
              · {reviewSummary.reviewCount}{" "}
              {reviewSummary.reviewCount === 1 ? "review" : "reviews"}
            </span>
          </div>
        ) : null}
      </div>

      {reviews.length > 0 ? (
        <div>
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9CA3AF]">
              Recent reviews
            </p>
            <Link
              href={`/${host.slug}#reviews`}
              className="text-[11px] font-bold text-[#FF5F63] hover:underline"
            >
              See all
            </Link>
          </div>
          <div className="mt-3 space-y-2">
            {reviews.slice(0, 2).map((review) => (
              <div
                key={review.id}
                className="rounded-xl border border-[#EEE7DF] bg-white p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF6267] via-[#C661E0] to-[#7C4DFF] text-[11px] font-bold text-white">
                      {(review.guestName || "?").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-[12.5px] font-bold leading-tight">
                        {review.guestName}
                      </p>
                      <p className="text-[10px] text-[#9CA3AF]">
                        {eventType.title} · {relativeTime(review.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-amber-500">
                    {"★".repeat(
                      Math.max(0, Math.min(5, Math.round(review.rating))),
                    )}
                  </span>
                </div>
                <p className="mt-2 text-[12.5px] leading-snug text-[#374151]">
                  &ldquo;{review.comment}&rdquo;
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-2.5 rounded-xl border border-[#EEE7DF] bg-[#FFFBF7] p-3 text-[11.5px] leading-snug text-[#6B7280]">
        <Lock className="mt-0.5 size-3.5 shrink-0 text-[#0D9488]" />
        <p>
          Your details are shared only with {host.name.split(/\s+/)[0]} to
          confirm your booking. We never display them publicly.
        </p>
      </div>
    </aside>
  );
}

function LocationIcon({ type }: { type: PublicEvent["eventType"]["locationType"] }) {
  if (type === "VIDEO") return <Video className="size-4 text-[#A855F7]" />;
  if (type === "PHONE") return <Phone className="size-4 text-[#A855F7]" />;
  return <MapPin className="size-4 text-[#A855F7]" />;
}

function formatBuffer(before: number, after: number): string {
  if (before > 0 && after > 0) {
    return `${before} min before · ${after} min cleanup after`;
  }
  if (before > 0) return `${before} min prep time before`;
  return `${after} min cleanup after`;
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
