import {
  BadRequestException,
  GoneException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { CalendarService } from '../calendar/calendar.service';
import {
  addLocalDays,
  assertTimeZone,
  compareLocalDates,
  formatZonedIso,
  getZonedParts,
  localDayOfWeek,
  zonedTimeToUtc,
} from '../common/time-zone';
import { PrismaService } from '../prisma/prisma.service';
import type { AvailableSlot, GetAvailableSlotsInput } from './scheduling.types';

const MAX_RANGE_DAYS = 31;

type OverrideBlock = { startMinute: number; endMinute: number };

@Injectable()
export class SchedulingService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly calendarService?: CalendarService,
  ) {}

  async getPublicEvent(hostSlug: string, eventSlug: string) {
    const eventType = await this.prisma.eventType.findFirst({
      where: {
        slug: eventSlug,
        isActive: true,
        deletedAt: null,
        user: {
          slug: hostSlug,
          isActive: true,
        },
      },
      include: {
        user: true,
        reviews: {
          where: { isVisible: true },
          select: {
            id: true,
            guestName: true,
            rating: true,
            comment: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        },
      },
    });

    if (!eventType) {
      throw new NotFoundException('Public event not found');
    }

    // Compute stats across ALL visible reviews, not just the first 8 that were
    // returned for display. Using aggregate avoids a full table scan in JS.
    const reviewAgg = await this.prisma.review.aggregate({
      where: { eventTypeId: eventType.id, isVisible: true },
      _count: { id: true },
      _avg: { rating: true },
    });

    const reviewCount = reviewAgg._count.id;
    const averageRating =
      reviewCount > 0 ? Number((reviewAgg._avg.rating ?? 0).toFixed(1)) : null;

    return {
      host: {
        name: eventType.user.name,
        businessDisplayName: eventType.user.businessDisplayName,
        slug: eventType.user.slug,
        timezone: eventType.user.timezone,
        profileImageUrl: eventType.user.profileImageUrl,
        coverImageUrl: eventType.user.coverImageUrl,
        headline: eventType.user.headline,
        businessCategory: eventType.user.businessCategory,
        location: eventType.user.location,
        about: eventType.user.about,
        whatToExpect: eventType.user.whatToExpect,
        websiteUrl: eventType.user.websiteUrl,
        instagramUrl: eventType.user.instagramUrl,
      },
      eventType: {
        id: eventType.id,
        slug: eventType.slug,
        title: eventType.title,
        category: eventType.category,
        imageUrl: eventType.imageUrl,
        galleryImageUrls: eventType.galleryImageUrls,
        description: eventType.description,
        whatIncluded: eventType.whatIncluded,
        preparationNotes: eventType.preparationNotes,
        locationDetails: eventType.locationDetails,
        durationMinutes: eventType.durationMinutes,
        bufferBeforeMinutes: eventType.bufferBeforeMinutes,
        bufferAfterMinutes: eventType.bufferAfterMinutes,
        locationType: eventType.locationType,
        priceAmount: eventType.priceAmount,
        priceMaxAmount: eventType.priceMaxAmount,
        priceCurrency: eventType.priceCurrency,
        priceType: eventType.priceType,
        isFeatured: eventType.isFeatured,
      },
      reviews: eventType.reviews.map((review) => ({
        id: review.id,
        guestName: review.guestName,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
      })),
      reviewSummary: {
        averageRating,
        reviewCount,
      },
    };
  }

  async getPublicHostProfile(hostSlug: string) {
    const host = await this.prisma.user.findUnique({
      where: { slug: hostSlug },
      include: {
        eventTypes: {
          where: { isActive: true, directLinkOnly: false, deletedAt: null },
          orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!host) {
      throw new NotFoundException('Public host not found');
    }

    if (!host.isActive) {
      throw new GoneException('Public profile is currently unavailable');
    }

    if (host.isProfileHidden) {
      throw new NotFoundException('Public host not found');
    }

    // Review aggregates across ALL visible reviews for the host, plus a
    // breakdown by star count so the public profile can render a distribution
    // bar without loading every row.
    const [reviewAgg, byRating, recentReviews, completedBookings] =
      await Promise.all([
        this.prisma.review.aggregate({
          where: { hostUserId: host.id, isVisible: true },
          _count: { id: true },
          _avg: { rating: true },
        }),
        this.prisma.review.groupBy({
          by: ['rating'],
          where: { hostUserId: host.id, isVisible: true },
          _count: { _all: true },
        }),
        this.prisma.review.findMany({
          where: { hostUserId: host.id, isVisible: true },
          orderBy: { createdAt: 'desc' },
          take: 6,
          include: { eventType: { select: { title: true } } },
        }),
        this.prisma.booking.count({
          where: { hostUserId: host.id, status: 'CONFIRMED' },
        }),
      ]);

    const reviewCount = reviewAgg._count.id;
    const averageRating =
      reviewCount > 0 ? Number((reviewAgg._avg.rating ?? 0).toFixed(1)) : null;

    const distribution: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    for (const row of byRating) {
      const rating = Math.max(1, Math.min(5, Math.round(row.rating))) as
        | 1
        | 2
        | 3
        | 4
        | 5;
      distribution[rating] += row._count._all;
    }

    return {
      host: {
        name: host.name,
        businessDisplayName: host.businessDisplayName,
        slug: host.slug,
        timezone: host.timezone,
        profileImageUrl: host.profileImageUrl,
        coverImageUrl: host.coverImageUrl,
        headline: host.headline,
        businessCategory: host.businessCategory,
        location: host.location,
        about: host.about,
        whatToExpect: host.whatToExpect,
        websiteUrl: host.websiteUrl,
        instagramUrl: host.instagramUrl,
        createdAt: host.createdAt.toISOString(),
      },
      services: host.eventTypes.map((service) => ({
        id: service.id,
        slug: service.slug,
        title: service.title,
        category: service.category,
        imageUrl: service.imageUrl,
        galleryImageUrls: service.galleryImageUrls,
        description: service.description,
        whatIncluded: service.whatIncluded,
        preparationNotes: service.preparationNotes,
        durationMinutes: service.durationMinutes,
        bufferBeforeMinutes: service.bufferBeforeMinutes,
        bufferAfterMinutes: service.bufferAfterMinutes,
        locationType: service.locationType,
        locationDetails: service.locationDetails,
        priceAmount: service.priceAmount,
        priceMaxAmount: service.priceMaxAmount,
        priceCurrency: service.priceCurrency,
        priceType: service.priceType,
        isFeatured: service.isFeatured,
      })),
      reviewSummary: {
        averageRating,
        reviewCount,
        distribution,
      },
      reviews: recentReviews.map((review) => ({
        id: review.id,
        guestName: review.guestName,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
        eventTypeTitle: review.eventType.title,
      })),
      stats: {
        completedBookings,
      },
    };
  }

  async getAvailableSlots(input: GetAvailableSlotsInput) {
    const guestTimezone = input.guestTimezone?.trim() || 'UTC';
    assertValidTimeZone(guestTimezone, 'guestTimezone');

    const { start, end } = parseDateRange(input.start, input.end);
    const eventType = await this.prisma.eventType.findFirst({
      where: {
        slug: input.eventSlug,
        isActive: true,
        deletedAt: null,
        user: {
          slug: input.hostSlug,
          isActive: true,
        },
      },
      include: {
        availability: {
          include: {
            rules: true,
          },
        },
        user: {
          include: {
            availabilityRules: true,
          },
        },
      },
    });

    if (!eventType) {
      throw new NotFoundException('Public event not found');
    }

    // Load host-wide (eventTypeId IS NULL) and this-service overrides together
    // so per-service exceptions can layer on top of host-wide ones for the
    // same calendar day.
    const overrideRows = await this.prisma.availabilityOverride.findMany({
      where: {
        userId: eventType.userId,
        date: { gte: start, lte: end },
        OR: [{ eventTypeId: null }, { eventTypeId: eventType.id }],
      },
    });

    assertValidTimeZone(eventType.user.timezone, 'host timezone');

    const host = eventType.user;
    // Booking-rules settings — fall back to sensible defaults when the user
    // record is missing these (e.g. in unit-test mocks).
    const minNoticeMinutes = numberOr(host.minNoticeMinutes, 0);
    const bookingHorizonDays = numberOr(host.bookingHorizonDays, null);
    const slotIntervalMinutes = numberOr(
      host.slotIntervalMinutes,
      eventType.durationMinutes,
    );
    const dailyBookingLimit = numberOr(host.dailyBookingLimit, null);

    // Apply minimum-notice / booking-horizon to the candidate window.
    const now = new Date();
    const earliest = new Date(now.getTime() + minNoticeMinutes * 60_000);
    const effectiveStart = start > earliest ? start : earliest;
    const effectiveEnd =
      bookingHorizonDays && Number.isFinite(bookingHorizonDays)
        ? minDate(
            end,
            new Date(now.getTime() + bookingHorizonDays * 86_400_000),
          )
        : end;

    if (effectiveStart >= effectiveEnd) {
      return [];
    }

    const serviceAvailability = eventType.availability;
    const weeklyRules =
      serviceAvailability?.mode === 'CUSTOM'
        ? serviceAvailability.rules
        : host.availabilityRules;

    if (weeklyRules.length === 0 && overrideRows.length === 0) {
      return [];
    }

    // Service-specific overrides take precedence over host-wide overrides for
    // the same date. We seed the map with host-wide rows first, then let
    // matching per-service rows clobber them.
    const overridesByDate = new Map<
      string,
      { type: 'BLOCKED' | 'CUSTOM_HOURS'; blocks: OverrideBlock[] }
    >();
    const sortedOverrides = [...overrideRows].sort((a, b) => {
      // null < non-null so service-specific wins last.
      const aHost = a.eventTypeId === null ? 0 : 1;
      const bHost = b.eventTypeId === null ? 0 : 1;
      return aHost - bHost;
    });
    for (const override of sortedOverrides) {
      const key = override.date.toISOString().slice(0, 10);
      const type =
        // Older rows pre-migration may only have isBlocked=true and no type.
        (override.type as 'BLOCKED' | 'CUSTOM_HOURS' | undefined) ??
        (override.isBlocked ? 'BLOCKED' : 'CUSTOM_HOURS');
      const blocks = readOverrideBlocks(
        (override as { blocks?: unknown }).blocks,
      );
      overridesByDate.set(key, { type, blocks });
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        hostUserId: eventType.userId,
        ...(input.excludeBookingId
          ? { id: { not: input.excludeBookingId } }
          : {}),
        status: BookingStatus.CONFIRMED,
        startTimeUtc: {
          lt: effectiveEnd,
        },
        endTimeUtc: {
          gt: effectiveStart,
        },
      },
      include: {
        eventType: true,
      },
      orderBy: {
        startTimeUtc: 'asc',
      },
    });

    const busyIntervals = bookings.map((booking) => ({
      startMs:
        booking.startTimeUtc.getTime() -
        booking.eventType.bufferBeforeMinutes * 60_000,
      endMs:
        booking.endTimeUtc.getTime() +
        booking.eventType.bufferAfterMinutes * 60_000,
    }));
    const externalBusyIntervals =
      (await this.calendarService?.getBusyIntervals(
        host.id,
        effectiveStart,
        effectiveEnd,
      )) ?? [];
    busyIntervals.push(...externalBusyIntervals);

    // Pre-compute existing bookings per host-local date so we can enforce the
    // daily booking limit without re-scanning the booking list inside the loop.
    const bookingsPerDate = new Map<string, number>();
    if (dailyBookingLimit) {
      for (const booking of bookings) {
        const parts = getZonedParts(booking.startTimeUtc, host.timezone);
        const key = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
        bookingsPerDate.set(key, (bookingsPerDate.get(key) ?? 0) + 1);
      }
    }

    const rulesByDay = new Map(
      Array.from({ length: 7 }, (_, day) => [
        day,
        weeklyRules.filter((rule) => rule.dayOfWeek === day),
      ]),
    );
    const slots: AvailableSlot[] = [];
    const hostTimezone = host.timezone;
    const startLocal = localDateOnly(
      getZonedParts(effectiveStart, hostTimezone),
    );
    const endLocal = localDateOnly(getZonedParts(effectiveEnd, hostTimezone));

    for (
      let date = startLocal;
      compareLocalDates(date, endLocal) <= 0;
      date = addLocalDays(date, 1)
    ) {
      const dateKey = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
      const override = overridesByDate.get(dateKey);

      if (override?.type === 'BLOCKED') {
        continue;
      }

      // Pick the windows for this date: CUSTOM_HOURS override replaces the
      // weekly schedule entirely, otherwise the recurring rules apply.
      const windows: OverrideBlock[] =
        override?.type === 'CUSTOM_HOURS'
          ? override.blocks
          : (rulesByDay.get(localDayOfWeek(date)) ?? []).map((rule) => ({
              startMinute: rule.startMinute,
              endMinute: rule.endMinute,
            }));

      if (windows.length === 0) {
        continue;
      }

      const alreadyBookedToday = bookingsPerDate.get(dateKey) ?? 0;
      const remainingForDay =
        dailyBookingLimit !== null && dailyBookingLimit !== undefined
          ? Math.max(0, dailyBookingLimit - alreadyBookedToday)
          : Infinity;

      if (remainingForDay === 0) {
        continue;
      }

      let slotsAddedForDay = 0;

      for (const window of windows) {
        const windowStart = maxDate(
          zonedTimeToUtc(date, window.startMinute, hostTimezone),
          effectiveStart,
        );
        const windowEnd = minDate(
          zonedTimeToUtc(date, window.endMinute, hostTimezone),
          effectiveEnd,
        );

        const durationMs = eventType.durationMinutes * 60_000;
        const stepMs = slotIntervalMinutes * 60_000;

        for (
          let slotStartMs = alignToStep(
            windowStart.getTime(),
            slotIntervalMinutes,
          );
          slotStartMs + durationMs <= windowEnd.getTime();
          slotStartMs += stepMs
        ) {
          if (slotsAddedForDay >= remainingForDay) {
            break;
          }

          const slotEndMs = slotStartMs + durationMs;
          const candidateBusy = {
            startMs: slotStartMs - eventType.bufferBeforeMinutes * 60_000,
            endMs: slotEndMs + eventType.bufferAfterMinutes * 60_000,
          };

          if (
            busyIntervals.some((busy) => intervalsOverlap(candidateBusy, busy))
          ) {
            continue;
          }

          const slotStart = new Date(slotStartMs);
          const slotEnd = new Date(slotEndMs);

          slots.push({
            startTimeUtc: slotStart.toISOString(),
            endTimeUtc: slotEnd.toISOString(),
            startTimeGuest: formatZonedIso(slotStart, guestTimezone),
            endTimeGuest: formatZonedIso(slotEnd, guestTimezone),
          });
          slotsAddedForDay++;
        }
      }
    }

    return slots;
  }

  // Resolves an old public link to its current form. Returns null when no
  // redirect is on file; otherwise returns the new `/hostSlug` or
  // `/hostSlug/eventSlug` path the caller should send the visitor to.
  async resolvePublicLinkRedirect(
    oldHostSlug: string,
    oldEventSlug?: string | null,
  ): Promise<{ hostSlug: string; eventSlug: string | null } | null> {
    const trimmedHost = oldHostSlug?.trim() ?? '';
    if (!trimmedHost) {
      return null;
    }
    const trimmedEvent = oldEventSlug?.trim() ? oldEventSlug.trim() : null;

    // 1. Direct hit: the exact (oldHostSlug, oldEventSlug) pair was renamed.
    if (trimmedEvent) {
      const exact = await this.prisma.publicLinkRedirect.findFirst({
        where: { oldHostSlug: trimmedHost, oldEventSlug: trimmedEvent },
        include: { host: true, eventType: true },
      });
      if (exact?.eventType && exact.host.isActive) {
        return {
          hostSlug: exact.host.slug,
          eventSlug: exact.eventType.slug,
        };
      }
    }

    // 2. Host-level redirect: old host slug → current host slug. If a service
    // slug was on the URL, preserve it so /old/{event} → /new/{event} works
    // when the event slug itself didn't change.
    const hostHit = await this.prisma.publicLinkRedirect.findFirst({
      where: { oldHostSlug: trimmedHost, oldEventSlug: null },
      include: { host: true },
    });
    if (hostHit && hostHit.host.isActive) {
      if (!trimmedEvent) {
        return { hostSlug: hostHit.host.slug, eventSlug: null };
      }
      // Resolve the event slug against the redirected host: prefer the
      // current event under the new host with the same slug; otherwise look
      // for another redirect from (newHostSlug, oldEventSlug).
      const event = await this.prisma.eventType.findFirst({
        where: {
          userId: hostHit.hostUserId,
          slug: trimmedEvent,
          deletedAt: null,
        },
        select: { slug: true },
      });
      if (event) {
        return { hostSlug: hostHit.host.slug, eventSlug: event.slug };
      }
      const eventRedirect = await this.prisma.publicLinkRedirect.findFirst({
        where: {
          oldHostSlug: hostHit.host.slug,
          oldEventSlug: trimmedEvent,
        },
        include: { eventType: true },
      });
      if (eventRedirect?.eventType) {
        return {
          hostSlug: hostHit.host.slug,
          eventSlug: eventRedirect.eventType.slug,
        };
      }
    }

    return null;
  }

  async checkSlugAvailability(input: string | undefined) {
    const raw = (input ?? '').trim().toLowerCase();
    const normalized = raw.replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');

    if (!normalized) {
      return {
        input: raw,
        normalized,
        available: false,
        reason: 'invalid' as const,
      };
    }

    if (normalized.length < 3) {
      return {
        input: raw,
        normalized,
        available: false,
        reason: 'too-short' as const,
      };
    }

    if (RESERVED_SLUGS.has(normalized)) {
      return {
        input: raw,
        normalized,
        available: false,
        reason: 'reserved' as const,
      };
    }

    const existing = await this.prisma.user.findUnique({
      where: { slug: normalized },
      select: { id: true },
    });

    if (existing) {
      return {
        input: raw,
        normalized,
        available: false,
        reason: 'taken' as const,
      };
    }

    return {
      input: raw,
      normalized,
      available: true,
      reason: null,
    };
  }
}

const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'availability',
  'bookings',
  'cancel',
  'dashboard',
  'event-types',
  'health',
  'help',
  'login',
  'logout',
  'media',
  'profile',
  'public',
  'register',
  'reviews',
  'services',
  'settings',
  'support',
  'uploads',
]);

function parseDateRange(startValue: string, endValue: string) {
  const start = parseDateInput(startValue, 'start');
  const end = parseDateInput(endValue, 'end');

  if (start >= end) {
    throw new BadRequestException('start must be before end');
  }

  if (end.getTime() - start.getTime() > MAX_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    throw new BadRequestException(
      `Date range cannot exceed ${MAX_RANGE_DAYS} days`,
    );
  }

  return { start, end };
}

function parseDateInput(value: string | undefined, field: string) {
  if (!value?.trim()) {
    throw new BadRequestException(`${field} is required`);
  }

  const trimmed = value.trim();
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);

  if (dateOnly) {
    return new Date(
      Date.UTC(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      ),
    );
  }

  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} must be a valid ISO date`);
  }

  return parsed;
}

function assertValidTimeZone(timeZone: string, field: string) {
  try {
    assertTimeZone(timeZone);
  } catch {
    throw new BadRequestException(`Invalid ${field}`);
  }
}

function localDateOnly(parts: { year: number; month: number; day: number }) {
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
  };
}

function alignToStep(timestampMs: number, stepMinutes: number) {
  const stepMs = stepMinutes * 60_000;
  return Math.ceil(timestampMs / stepMs) * stepMs;
}

function maxDate(left: Date, right: Date) {
  return left > right ? left : right;
}

function minDate(left: Date, right: Date) {
  return left < right ? left : right;
}

function intervalsOverlap(
  left: { startMs: number; endMs: number },
  right: { startMs: number; endMs: number },
) {
  return left.startMs < right.endMs && right.startMs < left.endMs;
}

function numberOr<T extends number | null>(
  value: number | null | undefined,
  fallback: T,
): number | (T extends null ? null : never) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return fallback as number | (T extends null ? null : never);
}

function readOverrideBlocks(value: unknown): OverrideBlock[] {
  if (!Array.isArray(value)) return [];
  const result: OverrideBlock[] = [];
  for (const entry of value) {
    if (
      entry &&
      typeof entry === 'object' &&
      typeof (entry as { startMinute?: unknown }).startMinute === 'number' &&
      typeof (entry as { endMinute?: unknown }).endMinute === 'number'
    ) {
      const start = (entry as { startMinute: number }).startMinute;
      const end = (entry as { endMinute: number }).endMinute;
      if (start < end) {
        result.push({ startMinute: start, endMinute: end });
      }
    }
  }
  result.sort((a, b) => a.startMinute - b.startMinute);
  return result;
}
