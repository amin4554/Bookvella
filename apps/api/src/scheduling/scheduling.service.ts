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

const SLOT_STEP_MINUTES = 15;
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

    const reviewCount = eventType.reviews.length;
    const averageRating =
      reviewCount > 0
        ? Number(
            (
              eventType.reviews.reduce((sum, review) => sum + review.rating, 0) /
              reviewCount
            ).toFixed(1),
          )
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
        description: eventType.description,
        whatIncluded: eventType.whatIncluded,
        locationDetails: eventType.locationDetails,
        durationMinutes: eventType.durationMinutes,
        bufferBeforeMinutes: eventType.bufferBeforeMinutes,
        bufferAfterMinutes: eventType.bufferAfterMinutes,
        locationType: eventType.locationType,
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

        for (
          let slotStartMs = alignToStep(windowStart.getTime());
          slotStartMs + eventType.durationMinutes * 60_000 <=
          windowEnd.getTime();
          slotStartMs += SLOT_STEP_MINUTES * 60_000
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
}

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

function alignToStep(timestampMs: number) {
  const stepMs = SLOT_STEP_MINUTES * 60_000;
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
