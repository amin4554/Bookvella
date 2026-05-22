import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { assertTimeZone } from '../common/time-zone';
import { optionalText, requireText } from '../common/validation';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { createReviewToken } from '../reviews/reviews.service';
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
            locationDetails: true,
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
      html: brandedEmailHtml({
        title: 'Confirm your booking',
        intro: `Use this code to continue booking ${eventType.title}.`,
        code,
        rows: [
          ['Service', eventType.title],
          ['Host', eventType.user.name],
          ['Expires', `${VERIFICATION_CODE_TTL_MINUTES} minutes`],
        ],
      }),
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
    const guestNote = optionalText(dto.guestNote);
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

        const guestCancelToken = randomBytes(24).toString('hex');

        const booking = await tx.booking.create({
          data: {
            eventTypeId: eventType.id,
            hostUserId: eventType.userId,
            guestName,
            guestEmail,
            guestPhone: optionalText(dto.guestPhone),
            guestNote,
            guestTimezone,
            startTimeUtc,
            endTimeUtc,
            status: BookingStatus.CONFIRMED,
            guestCancelToken,
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
      eventSlug,
      hostSlug,
      guestName,
      guestEmail,
      guestNote,
      bookingId: booking.id,
      guestCancelToken: booking.guestCancelToken!,
      startTimeUtc,
      endTimeUtc,
      guestTimezone,
      hostTimezone: eventType.user.timezone,
      location:
        eventType.locationDetails ?? formatLocation(eventType.locationType),
    });

    return booking;
  }

  async getByGuestToken(token: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { guestCancelToken: token },
      include: { eventType: true, host: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return {
      id: booking.id,
      status: booking.status,
      guestName: booking.guestName,
      eventTitle: booking.eventType.title,
      hostName: booking.host.name,
      startTimeUtc: booking.startTimeUtc.toISOString(),
      endTimeUtc: booking.endTimeUtc.toISOString(),
      guestTimezone: booking.guestTimezone,
    };
  }

  async cancelByGuestToken(token: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { guestCancelToken: token },
      include: { eventType: true, host: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.status === BookingStatus.CANCELLED) {
      throw new ConflictException('Booking is already cancelled');
    }

    await this.prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.CANCELLED, cancellationReason: 'Guest cancelled' },
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
      cancellationReason: 'Guest cancelled',
    });

    return { success: true };
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
    eventSlug: string;
    hostSlug: string;
    guestName: string;
    guestEmail: string;
    guestNote: string | null;
    bookingId: string;
    guestCancelToken: string;
    startTimeUtc: Date;
    endTimeUtc: Date;
    guestTimezone: string;
    hostTimezone: string;
    location: string;
  }) {
    const guestWhen = formatForEmail(input.startTimeUtc, input.guestTimezone);
    const hostWhen = formatForEmail(input.startTimeUtc, input.hostTimezone);
    const reviewUrl = buildReviewUrl({
      hostSlug: input.hostSlug,
      eventSlug: input.eventSlug,
      bookingId: input.bookingId,
    });
    const cancelUrl = buildGuestCancelUrl(input.guestCancelToken);
    const guestText = [
      'Your booking is confirmed.',
      '',
      `Service: ${input.eventTitle}`,
      `Host: ${input.hostName}`,
      `Time: ${guestWhen}`,
      `Location: ${input.location}`,
      '',
      `Need to cancel? ${cancelUrl}`,
      '',
      `After your visit, you can leave a review here: ${reviewUrl}`,
    ].join('\n');
    const hostText = [
      'New booking confirmed.',
      '',
      `Service: ${input.eventTitle}`,
      `Guest: ${input.guestName} <${input.guestEmail}>`,
      `Time: ${hostWhen}`,
      `Location: ${input.location}`,
      ...(input.guestNote ? ['', `Guest note: ${input.guestNote}`] : []),
    ].join('\n');

    await Promise.all([
      this.emailService.sendMail({
        to: input.guestEmail,
        subject: `Confirmed: ${input.eventTitle}`,
        text: guestText,
        html: brandedEmailHtml({
          title: 'Your booking is confirmed',
          intro: `You're booked with ${input.hostName}.`,
          rows: [
            ['Service', input.eventTitle],
            ['Time', guestWhen],
            ['Location', input.location],
          ],
          links: [
            { label: 'Need to cancel?', url: cancelUrl },
            { label: 'Leave a review after your visit', url: reviewUrl },
          ],
        }),
      }),
      this.emailService.sendMail({
        to: input.hostEmail,
        subject: `New booking: ${input.eventTitle}`,
        text: hostText,
        html: brandedEmailHtml({
          title: 'New booking confirmed',
          intro: `${input.guestName} booked ${input.eventTitle}.`,
          rows: [
            ['Guest', `${input.guestName} <${input.guestEmail}>`],
            ['Time', hostWhen],
            ['Location', input.location],
            ...(input.guestNote
              ? ([['Guest note', input.guestNote]] as [string, string][])
              : []),
          ],
        }),
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
        html: brandedEmailHtml({
          title: 'Your booking was cancelled',
          intro: `${input.eventTitle} with ${input.hostName} was cancelled.`,
          rows: [
            ['Time', guestWhen],
            ...(input.cancellationReason
              ? ([['Reason', input.cancellationReason]] as [string, string][])
              : []),
          ],
        }),
      }),
      this.emailService.sendMail({
        to: input.hostEmail,
        subject: `Cancelled booking: ${input.eventTitle}`,
        text: hostText,
        html: brandedEmailHtml({
          title: 'Booking cancelled',
          intro: `${input.guestName}'s booking was cancelled.`,
          rows: [
            ['Service', input.eventTitle],
            ['Guest', `${input.guestName} <${input.guestEmail}>`],
            ['Time', hostWhen],
            ...(input.cancellationReason
              ? ([['Reason', input.cancellationReason]] as [string, string][])
              : []),
          ],
        }),
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

function formatLocation(locationType: string) {
  if (locationType === 'PHONE') {
    return 'Phone call';
  }

  if (locationType === 'IN_PERSON') {
    return 'In person';
  }

  return 'Video call';
}

function buildReviewUrl(input: {
  hostSlug: string;
  eventSlug: string;
  bookingId: string;
}) {
  const appUrl =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3001';
  const url = new URL(
    `/${input.hostSlug}/${input.eventSlug}`,
    appUrl.endsWith('/') ? appUrl : `${appUrl}/`,
  );

  url.searchParams.set('reviewBooking', input.bookingId);
  url.searchParams.set('reviewToken', createReviewToken(input.bookingId));
  return url.toString();
}

function buildGuestCancelUrl(token: string) {
  const appUrl =
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3001';
  return `${appUrl.replace(/\/$/, '')}/cancel?token=${token}`;
}

function brandedEmailHtml(input: {
  title: string;
  intro: string;
  rows?: [string, string][];
  code?: string;
  cta?: { label: string; url: string };
  links?: { label: string; url: string }[];
}) {
  const rows = input.rows ?? [];
  const links = input.links ?? (input.cta ? [input.cta] : []);

  return [
    '<!doctype html>',
    '<html><body style="margin:0;background:#fffbf7;font-family:Arial,Helvetica,sans-serif;color:#111827;">',
    '<div style="max-width:620px;margin:0 auto;padding:32px 20px;">',
    '<div style="font-size:22px;font-weight:800;margin-bottom:20px;">Bookvella</div>',
    '<div style="background:#ffffff;border:1px solid #eee7df;border-radius:20px;padding:28px;">',
    `<h1 style="margin:0 0 10px;font-size:28px;line-height:1.2;">${escapeHtml(input.title)}</h1>`,
    `<p style="margin:0 0 22px;color:#6b7280;line-height:1.6;">${escapeHtml(input.intro)}</p>`,
    input.code
      ? `<div style="letter-spacing:8px;font-size:34px;font-weight:800;background:#fff0ef;color:#ff5f63;border-radius:16px;padding:18px;text-align:center;margin-bottom:22px;">${escapeHtml(input.code)}</div>`
      : '',
    ...rows.map(
      ([label, value]) =>
        `<div style="border-top:1px solid #eee7df;padding:12px 0;"><strong>${escapeHtml(label)}:</strong> <span style="color:#6b7280;">${escapeHtml(value)}</span></div>`,
    ),
    ...links.map(
      (link, i) =>
        `<a href="${escapeHtml(link.url)}" style="display:block;margin-top:${i === 0 ? '22' : '10'}px;background:${i === 0 ? '#ff6267' : '#f3f4f6'};color:${i === 0 ? '#ffffff' : '#374151'};text-align:center;text-decoration:none;border-radius:14px;padding:14px 18px;font-weight:800;">${escapeHtml(link.label)}</a>`,
    ),
    '</div>',
    '<p style="color:#9ca3af;font-size:12px;margin-top:18px;">You received this email because a Bookvella booking used this address.</p>',
    '</div>',
    '</body></html>',
  ].join('');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
