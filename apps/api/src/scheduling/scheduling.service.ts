import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
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

@Injectable()
export class SchedulingService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicEvent(hostSlug: string, eventSlug: string) {
    const eventType = await this.prisma.eventType.findFirst({
      where: {
        slug: eventSlug,
        isActive: true,
        user: {
          slug: hostSlug,
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
      reviewCount > 0
        ? Number((reviewAgg._avg.rating ?? 0).toFixed(1))
        : null;

    return {
      host: {
        name: eventType.user.name,
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
          where: { isActive: true, directLinkOnly: false },
          orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!host) {
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
      reviewCount > 0
        ? Number((reviewAgg._avg.rating ?? 0).toFixed(1))
        : null;

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
        durationMinutes: service.durationMinutes,
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
        user: {
          slug: input.hostSlug,
        },
      },
      include: {
        user: {
          include: {
            availabilityRules: true,
            availabilityOverrides: {
              where: {
                isBlocked: true,
                date: { gte: start, lte: end },
              },
            },
          },
        },
      },
    });

    if (!eventType) {
      throw new NotFoundException('Public event not found');
    }

    assertValidTimeZone(eventType.user.timezone, 'host timezone');

    if (eventType.user.availabilityRules.length === 0) {
      return [];
    }

    // Build a Set of blocked date strings in host timezone (YYYY-MM-DD)
    const blockedDates = new Set(
      eventType.user.availabilityOverrides.map((o) =>
        o.date.toISOString().slice(0, 10),
      ),
    );

    const bookings = await this.prisma.booking.findMany({
      where: {
        hostUserId: eventType.userId,
        status: BookingStatus.CONFIRMED,
        startTimeUtc: {
          lt: end,
        },
        endTimeUtc: {
          gt: start,
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

    const rulesByDay = new Map(
      Array.from({ length: 7 }, (_, day) => [
        day,
        eventType.user.availabilityRules.filter(
          (rule) => rule.dayOfWeek === day,
        ),
      ]),
    );
    const slots: AvailableSlot[] = [];
    const hostTimezone = eventType.user.timezone;
    const startLocal = localDateOnly(getZonedParts(start, hostTimezone));
    const endLocal = localDateOnly(getZonedParts(end, hostTimezone));

    for (
      let date = startLocal;
      compareLocalDates(date, endLocal) <= 0;
      date = addLocalDays(date, 1)
    ) {
      // Skip dates the host has blocked out
      const dateKey = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
      if (blockedDates.has(dateKey)) {
        continue;
      }

      const rules = rulesByDay.get(localDayOfWeek(date)) ?? [];

      for (const rule of rules) {
        const windowStart = maxDate(
          zonedTimeToUtc(date, rule.startMinute, hostTimezone),
          start,
        );
        const windowEnd = minDate(
          zonedTimeToUtc(date, rule.endMinute, hostTimezone),
          end,
        );

        const stepMs = eventType.durationMinutes * 60_000;
        for (
          let slotStartMs = alignToStep(windowStart.getTime(), eventType.durationMinutes);
          slotStartMs + stepMs <= windowEnd.getTime();
          slotStartMs += stepMs
        ) {
          const slotEndMs = slotStartMs + eventType.durationMinutes * 60_000;
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
        }
      }
    }

    return slots;
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
