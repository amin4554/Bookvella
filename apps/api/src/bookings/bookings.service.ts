import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { assertTimeZone } from '../common/time-zone';
import { optionalText, requireText } from '../common/validation';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import type {
  CancelBookingDto,
  CreatePublicBookingDto,
  RequestBookingCodeDto,
} from './dto';

const MAX_BUFFER_LOOKAROUND_MS = 24 * 60 * 60 * 1000;
const VERIFICATION_CODE_TTL_MINUTES = 10;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulingService: SchedulingService,
    private readonly emailService: EmailService,
  ) {}

  listHostBookings(hostUserId: string) {
    return this.prisma.booking.findMany({
      where: { hostUserId },
      include: {
        eventType: {
          select: {
            id: true,
            slug: true,
            title: true,
            durationMinutes: true,
            locationType: true,
          },
        },
      },
      orderBy: [{ startTimeUtc: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async cancelHostBooking(
    hostUserId: string,
    bookingId: string,
    dto: CancelBookingDto,
  ) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, hostUserId },
      include: {
        eventType: true,
        host: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new ConflictException('Booking is already cancelled');
    }

    const cancellationReason = optionalText(dto.reason);
    const cancelledBooking = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason,
      },
      include: {
        eventType: true,
      },
    });

    await this.sendBookingCancellation({
      hostEmail: booking.host.email,
      hostName: booking.host.name,
      eventTitle: booking.eventType.title,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      startTimeUtc: booking.startTimeUtc,
      guestTimezone: booking.guestTimezone,
      hostTimezone: booking.host.timezone,
      cancellationReason,
    });

    return cancelledBooking;
  }

  async requestBookingCode(
    hostSlug: string,
    eventSlug: string,
    dto: RequestBookingCodeDto,
  ) {
    const guestEmail = normalizeEmail(dto.guestEmail);
    const guestTimezone = normalizeTimezone(dto.guestTimezone);
    const startTimeUtc = parseIsoDate(dto.startTimeUtc, 'startTimeUtc');
    const eventType = await this.getPublicEventType(hostSlug, eventSlug);
    const endTimeUtc = new Date(
      startTimeUtc.getTime() + eventType.durationMinutes * 60_000,
    );

    await this.assertSlotAvailable({
      hostSlug,
      eventSlug,
      guestTimezone,
      startTimeUtc,
      endTimeUtc,
    });

    const code = createVerificationCode();
    const expiresAt = new Date(
      Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60_000,
    );
    const verification = await this.prisma.otpVerification.create({
      data: {
        email: guestEmail,
        codeHash: hashVerificationCode(code),
        expiresAt,
        maxAttempts: 5,
      },
    });

    await this.emailService.sendMail({
      to: guestEmail,
      subject: `Your Bookvella code for ${eventType.title}`,
      text: [
        `Your Bookvella verification code is ${code}.`,
        '',
        `Event: ${eventType.title}`,
        `Host: ${eventType.user.name}`,
        `Time: ${startTimeUtc.toISOString()}`,
        '',
        `This code expires in ${VERIFICATION_CODE_TTL_MINUTES} minutes.`,
      ].join('\n'),
    });

    return {
      verificationId: verification.id,
      expiresAt: verification.expiresAt.toISOString(),
      delivery: process.env.SMTP_HOST ? 'smtp' : 'console',
      devCode: process.env.EMAIL_DEV_RETURN_CODE === 'true' ? code : undefined,
    };
  }

  async createPublicBooking(
    hostSlug: string,
    eventSlug: string,
    dto: CreatePublicBookingDto,
  ) {
    const guestName = requireText(dto.guestName, 'guestName');
    const guestEmail = normalizeEmail(dto.guestEmail);
    const guestTimezone = normalizeTimezone(dto.guestTimezone);
    const startTimeUtc = parseIsoDate(dto.startTimeUtc, 'startTimeUtc');
    const verificationId = requireText(dto.verificationId, 'verificationId');
    const verificationCode = requireText(
      dto.verificationCode,
      'verificationCode',
    );
    const eventType = await this.getPublicEventType(hostSlug, eventSlug);
    const endTimeUtc = new Date(
      startTimeUtc.getTime() + eventType.durationMinutes * 60_000,
    );

    await this.assertSlotAvailable({
      hostSlug,
      eventSlug,
      guestTimezone,
      startTimeUtc,
      endTimeUtc,
    });

    const booking = await this.prisma.$transaction(
      async (tx) => {
        await this.verifyEmailCode(tx, {
          verificationId,
          guestEmail,
          verificationCode,
        });

        const hasConflict = await this.hasBookingConflict(tx, {
          hostUserId: eventType.userId,
          startTimeUtc,
          endTimeUtc,
          bufferBeforeMinutes: eventType.bufferBeforeMinutes,
          bufferAfterMinutes: eventType.bufferAfterMinutes,
        });

        if (hasConflict) {
          throw new ConflictException('Selected slot is no longer available');
        }

        const booking = await tx.booking.create({
          data: {
            eventTypeId: eventType.id,
            hostUserId: eventType.userId,
            guestName,
            guestEmail,
            guestPhone: optionalText(dto.guestPhone),
            guestTimezone,
            startTimeUtc,
            endTimeUtc,
            status: BookingStatus.CONFIRMED,
          },
        });

        return booking;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await this.sendBookingConfirmations({
      hostEmail: eventType.user.email,
      hostName: eventType.user.name,
      eventTitle: eventType.title,
      guestName,
      guestEmail,
      startTimeUtc,
      endTimeUtc,
      guestTimezone,
      hostTimezone: eventType.user.timezone,
    });

    return booking;
  }

  private async getPublicEventType(hostSlug: string, eventSlug: string) {
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
      },
    });

    if (!eventType) {
      throw new NotFoundException('Public event not found');
    }

    return eventType;
  }

  private async assertSlotAvailable(input: {
    hostSlug: string;
    eventSlug: string;
    guestTimezone: string;
    startTimeUtc: Date;
    endTimeUtc: Date;
  }) {
    const availableSlots = await this.schedulingService.getAvailableSlots({
      hostSlug: input.hostSlug,
      eventSlug: input.eventSlug,
      start: new Date(input.startTimeUtc.getTime() - 60_000).toISOString(),
      end: new Date(input.endTimeUtc.getTime() + 60_000).toISOString(),
      guestTimezone: input.guestTimezone,
    });
    const isAvailable = availableSlots.some(
      (slot) => slot.startTimeUtc === input.startTimeUtc.toISOString(),
    );

    if (!isAvailable) {
      throw new ConflictException('Selected slot is no longer available');
    }
  }

  private async verifyEmailCode(
    tx: Prisma.TransactionClient,
    input: {
      verificationId: string;
      guestEmail: string;
      verificationCode: string;
    },
  ) {
    const verification = await tx.otpVerification.findFirst({
      where: {
        id: input.verificationId,
        email: input.guestEmail,
        isVerified: false,
      },
    });

    if (!verification) {
      throw new BadRequestException('Verification code not found');
    }

    if (verification.expiresAt <= new Date()) {
      throw new BadRequestException('Verification code has expired');
    }

    if (verification.attempts >= verification.maxAttempts) {
      throw new BadRequestException('Too many verification attempts');
    }

    if (!verifyCode(input.verificationCode, verification.codeHash)) {
      await tx.otpVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });

      throw new BadRequestException('Invalid verification code');
    }

    await tx.otpVerification.update({
      where: { id: verification.id },
      data: {
        isVerified: true,
        attempts: { increment: 1 },
      },
    });
  }

  private async sendBookingConfirmations(input: {
    hostEmail: string;
    hostName: string;
    eventTitle: string;
    guestName: string;
    guestEmail: string;
    startTimeUtc: Date;
    endTimeUtc: Date;
    guestTimezone: string;
    hostTimezone: string;
  }) {
    const guestWhen = formatForEmail(input.startTimeUtc, input.guestTimezone);
    const hostWhen = formatForEmail(input.startTimeUtc, input.hostTimezone);
    const guestText = [
      `Your booking is confirmed.`,
      '',
      `Event: ${input.eventTitle}`,
      `Host: ${input.hostName}`,
      `Time: ${guestWhen}`,
    ].join('\n');
    const hostText = [
      `New booking confirmed.`,
      '',
      `Event: ${input.eventTitle}`,
      `Guest: ${input.guestName} <${input.guestEmail}>`,
      `Time: ${hostWhen}`,
    ].join('\n');

    await Promise.all([
      this.emailService.sendMail({
        to: input.guestEmail,
        subject: `Confirmed: ${input.eventTitle}`,
        text: guestText,
      }),
      this.emailService.sendMail({
        to: input.hostEmail,
        subject: `New booking: ${input.eventTitle}`,
        text: hostText,
      }),
    ]);
  }

  private async sendBookingCancellation(input: {
    hostEmail: string;
    hostName: string;
    eventTitle: string;
    guestName: string;
    guestEmail: string;
    startTimeUtc: Date;
    guestTimezone: string;
    hostTimezone: string;
    cancellationReason: string | null;
  }) {
    const guestWhen = formatForEmail(input.startTimeUtc, input.guestTimezone);
    const hostWhen = formatForEmail(input.startTimeUtc, input.hostTimezone);
    const reasonLines = input.cancellationReason
      ? ['', `Reason: ${input.cancellationReason}`]
      : [];
    const guestText = [
      `Your booking was cancelled.`,
      '',
      `Event: ${input.eventTitle}`,
      `Host: ${input.hostName}`,
      `Time: ${guestWhen}`,
      ...reasonLines,
    ].join('\n');
    const hostText = [
      `Booking cancelled.`,
      '',
      `Event: ${input.eventTitle}`,
      `Guest: ${input.guestName} <${input.guestEmail}>`,
      `Time: ${hostWhen}`,
      ...reasonLines,
    ].join('\n');

    await Promise.all([
      this.emailService.sendMail({
        to: input.guestEmail,
        subject: `Cancelled: ${input.eventTitle}`,
        text: guestText,
      }),
      this.emailService.sendMail({
        to: input.hostEmail,
        subject: `Cancelled booking: ${input.eventTitle}`,
        text: hostText,
      }),
    ]);
  }

  private async hasBookingConflict(
    tx: Prisma.TransactionClient,
    candidate: {
      hostUserId: string;
      startTimeUtc: Date;
      endTimeUtc: Date;
      bufferBeforeMinutes: number;
      bufferAfterMinutes: number;
    },
  ) {
    const candidateBusy = {
      startMs:
        candidate.startTimeUtc.getTime() -
        candidate.bufferBeforeMinutes * 60_000,
      endMs:
        candidate.endTimeUtc.getTime() + candidate.bufferAfterMinutes * 60_000,
    };
    const nearbyBookings = await tx.booking.findMany({
      where: {
        hostUserId: candidate.hostUserId,
        status: BookingStatus.CONFIRMED,
        startTimeUtc: {
          lt: new Date(candidateBusy.endMs + MAX_BUFFER_LOOKAROUND_MS),
        },
        endTimeUtc: {
          gt: new Date(candidateBusy.startMs - MAX_BUFFER_LOOKAROUND_MS),
        },
      },
      include: {
        eventType: true,
      },
    });

    return nearbyBookings.some((booking) => {
      const existingBusy = {
        startMs:
          booking.startTimeUtc.getTime() -
          booking.eventType.bufferBeforeMinutes * 60_000,
        endMs:
          booking.endTimeUtc.getTime() +
          booking.eventType.bufferAfterMinutes * 60_000,
      };

      return intervalsOverlap(candidateBusy, existingBusy);
    });
  }
}

function normalizeEmail(value?: string) {
  const email = value?.trim().toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('A valid guestEmail is required');
  }

  return email;
}

function normalizeTimezone(value?: string) {
  const timezone = value?.trim() || 'UTC';

  try {
    assertTimeZone(timezone);
    return timezone;
  } catch {
    throw new BadRequestException('Invalid guestTimezone');
  }
}

function createVerificationCode() {
  return String(randomInt(100000, 1000000));
}

function hashVerificationCode(code: string) {
  return createHash('sha256')
    .update(
      `${process.env.EMAIL_CODE_SECRET ?? process.env.JWT_PRIVATE_KEY ?? 'bookvella-dev'}:${code}`,
    )
    .digest('base64url');
}

function verifyCode(code: string, hash: string) {
  const candidate = Buffer.from(hashVerificationCode(code), 'base64url');
  const stored = Buffer.from(hash, 'base64url');

  return (
    candidate.length === stored.length && timingSafeEqual(candidate, stored)
  );
}

function formatForEmail(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone,
  }).format(date);
}

function parseIsoDate(value: string | undefined, field: string) {
  if (!value?.trim()) {
    throw new BadRequestException(`${field} is required`);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} must be a valid ISO date`);
  }

  return date;
}

function intervalsOverlap(
  left: { startMs: number; endMs: number },
  right: { startMs: number; endMs: number },
) {
  return left.startMs < right.endMs && right.startMs < left.endMs;
}
