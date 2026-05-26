import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  BookingReminderStatus,
  BookingStatus,
  DailyAgendaStatus,
  NotificationChannel,
  NotificationType,
  Prisma,
} from '@prisma/client';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'crypto';
import { CalendarService } from '../calendar/calendar.service';
import {
  addLocalDays,
  assertTimeZone,
  getZonedParts,
  zonedTimeToUtc,
} from '../common/time-zone';
import { optionalText, requireText } from '../common/validation';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { createReviewToken } from '../reviews/reviews.service';
import { SchedulingService } from '../scheduling/scheduling.service';
import type {
  CancelBookingDto,
  CreatePublicBookingDto,
  RequestBookingCodeDto,
  RescheduleBookingDto,
} from './dto';

const MAX_BUFFER_LOOKAROUND_MS = 24 * 60 * 60 * 1000;
const VERIFICATION_CODE_TTL_MINUTES = 10;
const REMINDER_WORKER_INTERVAL_MS = 60 * 1000;
const REMINDER_BATCH_SIZE = 25;
const REVIEW_INVITATION_BATCH_SIZE = 25;
const DAILY_AGENDA_SEND_MINUTE = 7 * 60;
const DAILY_AGENDA_WINDOW_MINUTES = 10;

@Injectable()
export class BookingsService implements OnModuleInit, OnModuleDestroy {
  private reminderWorker: NodeJS.Timeout | null = null;
  private processingReminders = false;
  private processingReviewInvitations = false;
  private processingDailyAgendas = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulingService: SchedulingService,
    private readonly emailService: EmailService,
    private readonly calendarService?: CalendarService,
  ) {}

  onModuleInit() {
    this.reminderWorker = setInterval(() => {
      void this.processDueReminders();
      void this.processDueReviewInvitations();
      void this.processDailyAgendas();
    }, REMINDER_WORKER_INTERVAL_MS);
    this.reminderWorker.unref();
  }

  onModuleDestroy() {
    if (this.reminderWorker) {
      clearInterval(this.reminderWorker);
      this.reminderWorker = null;
    }
  }

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

  async exportCustomersCsv(hostUserId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { hostUserId },
      include: {
        eventType: {
          select: {
            priceAmount: true,
          },
        },
      },
      orderBy: [{ startTimeUtc: 'desc' }, { createdAt: 'desc' }],
    });
    const customers = new Map<
      string,
      {
        name: string;
        email: string;
        phone: string;
        bookingCount: number;
        lastBooking: Date | null;
        totalSpendCents: number;
        timezone: string;
      }
    >();

    for (const booking of bookings) {
      const email = booking.guestEmail.trim().toLowerCase();
      const existing = customers.get(email);
      const totalSpendCents =
        (existing?.totalSpendCents ?? 0) + (booking.eventType.priceAmount ?? 0);
      const lastBooking =
        !existing?.lastBooking || booking.startTimeUtc > existing.lastBooking
          ? booking.startTimeUtc
          : existing.lastBooking;

      customers.set(email, {
        name:
          !existing ||
          booking.startTimeUtc >= (existing.lastBooking ?? new Date(0))
            ? booking.guestName
            : existing.name,
        email,
        phone: booking.guestPhone ?? existing?.phone ?? '',
        bookingCount: (existing?.bookingCount ?? 0) + 1,
        lastBooking,
        totalSpendCents,
        timezone:
          !existing ||
          booking.startTimeUtc >= (existing.lastBooking ?? new Date(0))
            ? booking.guestTimezone
            : existing.timezone,
      });
    }

    return toCsv([
      [
        'name',
        'email',
        'phone',
        'booking_count',
        'last_booking',
        'total_spend',
        'timezone',
      ],
      ...Array.from(customers.values()).map((customer) => [
        customer.name,
        customer.email,
        customer.phone,
        String(customer.bookingCount),
        customer.lastBooking?.toISOString() ?? '',
        (customer.totalSpendCents / 100).toFixed(2),
        customer.timezone,
      ]),
    ]);
  }

  async exportBookingsCsv(hostUserId: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { hostUserId },
      include: { eventType: true },
      orderBy: [{ startTimeUtc: 'desc' }, { createdAt: 'desc' }],
    });

    return toCsv([
      [
        'id',
        'guest_name',
        'guest_email',
        'guest_phone',
        'service_title',
        'service_duration_minutes',
        'start_time_utc',
        'end_time_utc',
        'guest_timezone',
        'status',
        'cancellation_reason',
        'created_at',
      ],
      ...bookings.map((booking) => [
        booking.id,
        booking.guestName,
        booking.guestEmail,
        booking.guestPhone ?? '',
        booking.eventType.title,
        String(booking.eventType.durationMinutes),
        booking.startTimeUtc.toISOString(),
        booking.endTimeUtc.toISOString(),
        booking.guestTimezone,
        booking.status,
        booking.cancellationReason ?? '',
        booking.createdAt.toISOString(),
      ]),
    ]);
  }

  async getBookingFeed(hostUserId: string) {
    const existing = await this.prisma.bookingFeed.findUnique({
      where: { userId: hostUserId },
    });
    const token = existing
      ? decryptFeedToken(existing.tokenEncrypted)
      : createFeedToken();

    if (!existing) {
      await this.prisma.bookingFeed.create({
        data: {
          userId: hostUserId,
          tokenHash: hashFeedToken(token),
          tokenEncrypted: encryptFeedToken(token),
        },
      });
    }

    return {
      feedUrl: buildFeedUrl(token),
    };
  }

  async rotateBookingFeed(hostUserId: string) {
    const token = createFeedToken();
    await this.prisma.bookingFeed.upsert({
      where: { userId: hostUserId },
      create: {
        userId: hostUserId,
        tokenHash: hashFeedToken(token),
        tokenEncrypted: encryptFeedToken(token),
        rotatedAt: new Date(),
      },
      update: {
        tokenHash: hashFeedToken(token),
        tokenEncrypted: encryptFeedToken(token),
        rotatedAt: new Date(),
      },
    });

    return {
      feedUrl: buildFeedUrl(token),
    };
  }

  async renderIcsFeed(rawToken: string) {
    const token = rawToken.replace(/\.ics$/i, '');
    const feed = await this.prisma.bookingFeed.findUnique({
      where: { tokenHash: hashFeedToken(token) },
      include: { user: true },
    });

    if (!feed) {
      throw new NotFoundException('Calendar feed not found');
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        hostUserId: feed.userId,
        status: BookingStatus.CONFIRMED,
      },
      include: { eventType: true },
      orderBy: { startTimeUtc: 'asc' },
    });

    return buildIcsCalendar({
      hostName: displayName(feed.user),
      bookings: bookings.map((booking) => ({
        id: booking.id,
        eventTitle: booking.eventType.title,
        guestName: booking.guestName,
        guestEmail: booking.guestEmail,
        startTimeUtc: booking.startTimeUtc,
        endTimeUtc: booking.endTimeUtc,
        location:
          booking.eventType.locationDetails ??
          formatLocation(booking.eventType.locationType),
      })),
    });
  }

  async renderHostBookingIcs(hostUserId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, hostUserId },
      include: { eventType: true, host: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return buildIcsCalendar({
      hostName: displayName(booking.host),
      bookings: [bookingToIcsEntry(booking)],
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
    await this.cancelBookingReminder(booking.id);
    await this.cancelBookingReviewInvitation(booking.id);

    await this.sendBookingCancellation({
      hostUserId,
      hostEmail: booking.host.email,
      hostName: displayName(booking.host),
      eventTitle: booking.eventType.title,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      startTimeUtc: booking.startTimeUtc,
      guestTimezone: booking.guestTimezone,
      hostTimezone: booking.host.timezone,
      cancellationReason,
    });
    await this.calendarService?.writeBookingCancelled(booking.id);

    return cancelledBooking;
  }

  async rescheduleHostBooking(
    hostUserId: string,
    bookingId: string,
    dto: RescheduleBookingDto,
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

    return this.rescheduleBooking(booking, dto, 'host');
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
        `Host: ${displayName(eventType.user)}`,
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
          ['Host', displayName(eventType.user)],
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
          throw new ConflictException({
            message: 'Selected slot is no longer available',
            code: 'SLOT_CONFLICT',
          });
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

    await this.scheduleBookingReminder({
      bookingId: booking.id,
      hostUserId: eventType.userId,
      startTimeUtc,
    });
    await this.scheduleBookingReviewInvitation({
      bookingId: booking.id,
      sendAt: endTimeUtc,
    });

    await this.sendBookingConfirmations({
      hostUserId: eventType.userId,
      hostEmail: eventType.user.email,
      hostName: displayName(eventType.user),
      eventTitle: eventType.title,
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
    await this.calendarService?.writeBookingCreated(booking.id);

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
      eventSlug: booking.eventType.slug,
      hostName: displayName(booking.host),
      hostSlug: booking.host.slug,
      startTimeUtc: booking.startTimeUtc.toISOString(),
      endTimeUtc: booking.endTimeUtc.toISOString(),
      guestTimezone: booking.guestTimezone,
    };
  }

  async rescheduleByGuestToken(token: string, dto: RescheduleBookingDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { guestCancelToken: token },
      include: { eventType: true, host: true },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return this.rescheduleBooking(booking, dto, 'guest');
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
      data: {
        status: BookingStatus.CANCELLED,
        cancellationReason: 'Guest cancelled',
      },
    });
    await this.cancelBookingReminder(booking.id);
    await this.cancelBookingReviewInvitation(booking.id);

    await this.sendBookingCancellation({
      hostUserId: booking.host.id,
      hostEmail: booking.host.email,
      hostName: displayName(booking.host),
      eventTitle: booking.eventType.title,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      startTimeUtc: booking.startTimeUtc,
      guestTimezone: booking.guestTimezone,
      hostTimezone: booking.host.timezone,
      cancellationReason: 'Guest cancelled',
    });
    await this.calendarService?.writeBookingCancelled(booking.id);

    return { success: true };
  }

  async processDueReminders() {
    if (this.processingReminders) {
      return { processed: 0 };
    }

    this.processingReminders = true;

    try {
      const dueReminders = await this.prisma.bookingReminder.findMany({
        where: {
          status: BookingReminderStatus.PENDING,
          sendAt: {
            lte: new Date(),
          },
        },
        include: {
          booking: {
            include: {
              eventType: true,
              host: true,
            },
          },
        },
        orderBy: { sendAt: 'asc' },
        take: REMINDER_BATCH_SIZE,
      });

      let processed = 0;

      for (const reminder of dueReminders) {
        const claimed = await this.prisma.bookingReminder.updateMany({
          where: {
            bookingId: reminder.bookingId,
            status: BookingReminderStatus.PENDING,
          },
          data: {
            status: BookingReminderStatus.PROCESSING,
            lastError: null,
          },
        });

        if (claimed.count === 0) {
          continue;
        }

        try {
          if (reminder.booking.status !== BookingStatus.CONFIRMED) {
            await this.prisma.bookingReminder.update({
              where: { bookingId: reminder.bookingId },
              data: {
                status: BookingReminderStatus.CANCELLED,
              },
            });
            processed += 1;
            continue;
          }

          const preference = await this.getHostReminderPreference(
            reminder.booking.hostUserId,
          );

          if (!preference.enabled) {
            await this.prisma.bookingReminder.update({
              where: { bookingId: reminder.bookingId },
              data: {
                status: BookingReminderStatus.CANCELLED,
              },
            });
            processed += 1;
            continue;
          }

          await this.sendBookingReminder({
            guestEmail: reminder.booking.guestEmail,
            guestName: reminder.booking.guestName,
            guestTimezone: reminder.booking.guestTimezone,
            hostName: displayName(reminder.booking.host),
            eventTitle: reminder.booking.eventType.title,
            startTimeUtc: reminder.booking.startTimeUtc,
            location:
              reminder.booking.eventType.locationDetails ??
              formatLocation(reminder.booking.eventType.locationType),
          });

          await this.prisma.bookingReminder.update({
            where: { bookingId: reminder.bookingId },
            data: {
              status: BookingReminderStatus.SENT,
              sentAt: new Date(),
            },
          });
          processed += 1;
        } catch (error) {
          await this.prisma.bookingReminder.update({
            where: { bookingId: reminder.bookingId },
            data: {
              status: BookingReminderStatus.FAILED,
              lastError: errorMessage(error),
            },
          });
        }
      }

      return { processed };
    } finally {
      this.processingReminders = false;
    }
  }

  async processDueReviewInvitations() {
    if (this.processingReviewInvitations) {
      return { processed: 0 };
    }

    this.processingReviewInvitations = true;

    try {
      const dueInvitations =
        await this.prisma.bookingReviewInvitation.findMany({
          where: {
            status: BookingReminderStatus.PENDING,
            sendAt: {
              lte: new Date(),
            },
          },
          include: {
            booking: {
              include: {
                eventType: true,
                host: true,
                review: true,
              },
            },
          },
          orderBy: { sendAt: 'asc' },
          take: REVIEW_INVITATION_BATCH_SIZE,
        });

      let processed = 0;

      for (const invitation of dueInvitations) {
        const claimed = await this.prisma.bookingReviewInvitation.updateMany({
          where: {
            bookingId: invitation.bookingId,
            status: BookingReminderStatus.PENDING,
          },
          data: {
            status: BookingReminderStatus.PROCESSING,
            lastError: null,
          },
        });

        if (claimed.count === 0) {
          continue;
        }

        try {
          if (
            invitation.booking.status !== BookingStatus.CONFIRMED ||
            invitation.booking.review
          ) {
            await this.prisma.bookingReviewInvitation.update({
              where: { bookingId: invitation.bookingId },
              data: {
                status: BookingReminderStatus.CANCELLED,
              },
            });
            processed += 1;
            continue;
          }

          if (invitation.booking.endTimeUtc > new Date()) {
            await this.prisma.bookingReviewInvitation.update({
              where: { bookingId: invitation.bookingId },
              data: {
                status: BookingReminderStatus.PENDING,
                sendAt: invitation.booking.endTimeUtc,
              },
            });
            processed += 1;
            continue;
          }

          await this.sendBookingReviewInvitation({
            guestEmail: invitation.booking.guestEmail,
            guestName: invitation.booking.guestName,
            hostName: displayName(invitation.booking.host),
            eventTitle: invitation.booking.eventType.title,
            eventSlug: invitation.booking.eventType.slug,
            hostSlug: invitation.booking.host.slug,
            bookingId: invitation.booking.id,
          });

          await this.prisma.bookingReviewInvitation.update({
            where: { bookingId: invitation.bookingId },
            data: {
              status: BookingReminderStatus.SENT,
              sentAt: new Date(),
            },
          });
          processed += 1;
        } catch (error) {
          await this.prisma.bookingReviewInvitation.update({
            where: { bookingId: invitation.bookingId },
            data: {
              status: BookingReminderStatus.FAILED,
              lastError: errorMessage(error),
            },
          });
        }
      }

      return { processed };
    } finally {
      this.processingReviewInvitations = false;
    }
  }

  async processDailyAgendas(now = new Date()) {
    if (this.processingDailyAgendas) {
      return { processed: 0 };
    }

    this.processingDailyAgendas = true;

    try {
      const candidateHosts = await this.prisma.user.findMany({
        where: {
          bookings: {
            some: {
              status: BookingStatus.CONFIRMED,
              startTimeUtc: {
                gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
                lt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
              },
            },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
          businessDisplayName: true,
          timezone: true,
        },
      });
      let processed = 0;

      for (const host of candidateHosts) {
        const local = getZonedParts(now, host.timezone);
        const localMinute = local.hour * 60 + local.minute;

        if (
          localMinute < DAILY_AGENDA_SEND_MINUTE ||
          localMinute >= DAILY_AGENDA_SEND_MINUTE + DAILY_AGENDA_WINDOW_MINUTES
        ) {
          continue;
        }

        if (
          !(await this.isHostEmailEnabled(
            host.id,
            NotificationType.DAILY_AGENDA,
          ))
        ) {
          continue;
        }

        const agendaDate = localDateAsUtcDate(local);

        try {
          await this.prisma.dailyAgendaDelivery.create({
            data: {
              userId: host.id,
              agendaDate,
              status: DailyAgendaStatus.PROCESSING,
            },
          });
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            continue;
          }

          throw error;
        }

        try {
          const startUtc = zonedTimeToUtc(local, 0, host.timezone);
          const endUtc = zonedTimeToUtc(
            addLocalDays(local, 1),
            0,
            host.timezone,
          );
          const bookings = await this.prisma.booking.findMany({
            where: {
              hostUserId: host.id,
              status: BookingStatus.CONFIRMED,
              startTimeUtc: {
                gte: startUtc,
                lt: endUtc,
              },
            },
            include: {
              eventType: {
                select: {
                  title: true,
                  locationType: true,
                  locationDetails: true,
                },
              },
            },
            orderBy: { startTimeUtc: 'asc' },
          });

          if (bookings.length > 0) {
            await this.sendDailyAgendaEmail({
              hostEmail: host.email,
              hostName: displayName(host),
              hostTimezone: host.timezone,
              bookings: bookings.map((booking) => ({
                guestName: booking.guestName,
                guestEmail: booking.guestEmail,
                eventTitle: booking.eventType.title,
                startTimeUtc: booking.startTimeUtc,
                location:
                  booking.eventType.locationDetails ??
                  formatLocation(booking.eventType.locationType),
              })),
            });
          }

          await this.prisma.dailyAgendaDelivery.update({
            where: {
              userId_agendaDate: {
                userId: host.id,
                agendaDate,
              },
            },
            data: {
              status: DailyAgendaStatus.SENT,
              sentAt: new Date(),
              lastError: null,
            },
          });
          processed += 1;
        } catch (error) {
          await this.prisma.dailyAgendaDelivery.update({
            where: {
              userId_agendaDate: {
                userId: host.id,
                agendaDate,
              },
            },
            data: {
              status: DailyAgendaStatus.FAILED,
              lastError: errorMessage(error),
            },
          });
        }
      }

      return { processed };
    } finally {
      this.processingDailyAgendas = false;
    }
  }

  private async scheduleBookingReminder(input: {
    bookingId: string;
    hostUserId: string;
    startTimeUtc: Date;
  }) {
    const preference = await this.getHostReminderPreference(input.hostUserId);

    if (!preference.enabled) {
      return;
    }

    const sendAt = new Date(
      input.startTimeUtc.getTime() - preference.timingMinutes * 60_000,
    );

    if (sendAt <= new Date()) {
      return;
    }

    await this.prisma.bookingReminder.upsert({
      where: { bookingId: input.bookingId },
      create: {
        bookingId: input.bookingId,
        sendAt,
        status: BookingReminderStatus.PENDING,
      },
      update: {
        sendAt,
        status: BookingReminderStatus.PENDING,
        sentAt: null,
        lastError: null,
      },
    });
  }

  private async cancelBookingReminder(bookingId: string) {
    await this.prisma.bookingReminder.updateMany({
      where: {
        bookingId,
        status: {
          in: [
            BookingReminderStatus.PENDING,
            BookingReminderStatus.PROCESSING,
            BookingReminderStatus.FAILED,
          ],
        },
      },
      data: {
        status: BookingReminderStatus.CANCELLED,
      },
    });
  }

  private async scheduleBookingReviewInvitation(input: {
    bookingId: string;
    sendAt: Date;
  }) {
    await this.prisma.bookingReviewInvitation.upsert({
      where: { bookingId: input.bookingId },
      create: {
        bookingId: input.bookingId,
        sendAt: input.sendAt,
        status: BookingReminderStatus.PENDING,
      },
      update: {
        sendAt: input.sendAt,
        status: BookingReminderStatus.PENDING,
        sentAt: null,
        lastError: null,
      },
    });
  }

  private async cancelBookingReviewInvitation(bookingId: string) {
    await this.prisma.bookingReviewInvitation.updateMany({
      where: {
        bookingId,
        status: {
          in: [
            BookingReminderStatus.PENDING,
            BookingReminderStatus.PROCESSING,
            BookingReminderStatus.FAILED,
          ],
        },
      },
      data: {
        status: BookingReminderStatus.CANCELLED,
      },
    });
  }

  private async getHostReminderPreference(hostUserId: string) {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_channel_type: {
          userId: hostUserId,
          channel: NotificationChannel.EMAIL,
          type: NotificationType.REMINDER_BEFORE,
        },
      },
    });

    return {
      enabled: preference?.enabled ?? true,
      timingMinutes: preference?.timingMinutes ?? 120,
    };
  }

  private async sendBookingReminder(input: {
    guestEmail: string;
    guestName: string;
    guestTimezone: string;
    hostName: string;
    eventTitle: string;
    startTimeUtc: Date;
    location: string;
  }) {
    const guestWhen = formatForEmail(input.startTimeUtc, input.guestTimezone);

    await this.emailService.sendMail({
      to: input.guestEmail,
      subject: `Reminder: ${input.eventTitle}`,
      text: [
        `Hi ${input.guestName},`,
        '',
        `This is a reminder for your upcoming ${input.eventTitle} booking with ${input.hostName}.`,
        '',
        `Time: ${guestWhen}`,
        `Location: ${input.location}`,
        '',
        'Bookvella',
      ].join('\n'),
      html: brandedEmailHtml({
        title: 'Upcoming booking reminder',
        intro: `Your ${input.eventTitle} booking with ${input.hostName} is coming up.`,
        rows: [
          ['Time', guestWhen],
          ['Location', input.location],
        ],
      }),
    });
  }

  private async sendBookingReviewInvitation(input: {
    guestEmail: string;
    guestName: string;
    hostName: string;
    eventTitle: string;
    eventSlug: string;
    hostSlug: string;
    bookingId: string;
  }) {
    const reviewUrl = buildReviewUrl({
      hostSlug: input.hostSlug,
      eventSlug: input.eventSlug,
      bookingId: input.bookingId,
    });

    await this.emailService.sendMail({
      to: input.guestEmail,
      subject: `How was ${input.eventTitle}?`,
      text: [
        `Hi ${input.guestName},`,
        '',
        `Thanks for booking ${input.eventTitle} with ${input.hostName}.`,
        '',
        `You can leave a review here: ${reviewUrl}`,
        '',
        'Bookvella',
      ].join('\n'),
      html: brandedEmailHtml({
        title: 'How was your booking?',
        intro: `Thanks for booking ${input.eventTitle} with ${input.hostName}. Your review helps future guests decide with confidence.`,
        cta: {
          label: 'Leave a review',
          url: reviewUrl,
        },
      }),
    });
  }

  private async sendDailyAgendaEmail(input: {
    hostEmail: string;
    hostName: string;
    hostTimezone: string;
    bookings: {
      guestName: string;
      guestEmail: string;
      eventTitle: string;
      startTimeUtc: Date;
      location: string;
    }[];
  }) {
    const lines = input.bookings.flatMap((booking, index) => [
      `${index + 1}. ${formatForEmail(booking.startTimeUtc, input.hostTimezone)}`,
      `   ${booking.eventTitle} with ${booking.guestName} <${booking.guestEmail}>`,
      `   ${booking.location}`,
    ]);

    await this.emailService.sendMail({
      to: input.hostEmail,
      subject: "Today's Bookvella agenda",
      text: [
        `Hi ${input.hostName},`,
        '',
        "Here's your Bookvella agenda for today:",
        '',
        ...lines,
        '',
        'Bookvella',
      ].join('\n'),
      html: brandedEmailHtml({
        title: "Today's agenda",
        intro: `You have ${input.bookings.length} confirmed booking${
          input.bookings.length === 1 ? '' : 's'
        } today.`,
        rows: input.bookings.map((booking) => [
          formatForEmail(booking.startTimeUtc, input.hostTimezone),
          `${booking.eventTitle} with ${booking.guestName} - ${booking.location}`,
        ]),
      }),
    });
  }

  private async getPublicEventType(hostSlug: string, eventSlug: string) {
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
    excludeBookingId?: string;
  }) {
    const availableSlots = await this.schedulingService.getAvailableSlots({
      hostSlug: input.hostSlug,
      eventSlug: input.eventSlug,
      start: new Date(input.startTimeUtc.getTime() - 60_000).toISOString(),
      end: new Date(input.endTimeUtc.getTime() + 60_000).toISOString(),
      guestTimezone: input.guestTimezone,
      excludeBookingId: input.excludeBookingId,
    });
    const isAvailable = availableSlots.some(
      (slot) => slot.startTimeUtc === input.startTimeUtc.toISOString(),
    );

    if (!isAvailable) {
      throw new ConflictException({
        message: 'Selected slot is no longer available',
        code: 'SLOT_CONFLICT',
      });
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
      throw new BadRequestException({
        message: 'Verification code not found',
        code: 'OTP_NOT_FOUND',
      });
    }

    if (verification.expiresAt <= new Date()) {
      throw new BadRequestException({
        message: 'Verification code has expired',
        code: 'OTP_EXPIRED',
      });
    }

    if (verification.attempts >= verification.maxAttempts) {
      throw new BadRequestException({
        message: 'Too many verification attempts',
        code: 'OTP_ATTEMPTS_EXCEEDED',
      });
    }

    if (!verifyCode(input.verificationCode, verification.codeHash)) {
      await tx.otpVerification.update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      });

      throw new BadRequestException({
        message: 'Invalid verification code',
        code: 'OTP_INVALID',
      });
    }

    await tx.otpVerification.update({
      where: { id: verification.id },
      data: {
        isVerified: true,
        attempts: { increment: 1 },
      },
    });
  }

  private async rescheduleBooking(
    booking: {
      id: string;
      hostUserId: string;
      guestName: string;
      guestEmail: string;
      guestPhone: string | null;
      guestNote: string | null;
      guestTimezone: string;
      startTimeUtc: Date;
      endTimeUtc: Date;
      status: BookingStatus;
      guestCancelToken: string | null;
      eventType: {
        id: string;
        slug: string;
        title: string;
        durationMinutes: number;
        bufferBeforeMinutes: number;
        bufferAfterMinutes: number;
        locationType: string;
        locationDetails: string | null;
      };
      host: {
        id: string;
        email: string;
        name: string;
        businessDisplayName?: string | null;
        slug: string;
        timezone: string;
      };
    },
    dto: RescheduleBookingDto,
    actor: 'host' | 'guest',
  ) {
    if (booking.status === BookingStatus.CANCELLED) {
      throw new ConflictException('Booking is already cancelled');
    }

    const startTimeUtc = parseIsoDate(dto.startTimeUtc, 'startTimeUtc');
    const guestTimezone = normalizeTimezone(
      dto.guestTimezone ?? booking.guestTimezone,
    );
    const endTimeUtc = new Date(
      startTimeUtc.getTime() + booking.eventType.durationMinutes * 60_000,
    );

    await this.assertSlotAvailable({
      hostSlug: booking.host.slug,
      eventSlug: booking.eventType.slug,
      guestTimezone,
      startTimeUtc,
      endTimeUtc,
      excludeBookingId: booking.id,
    });

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const hasConflict = await this.hasBookingConflict(tx, {
          hostUserId: booking.hostUserId,
          startTimeUtc,
          endTimeUtc,
          bufferBeforeMinutes: booking.eventType.bufferBeforeMinutes,
          bufferAfterMinutes: booking.eventType.bufferAfterMinutes,
          excludeBookingId: booking.id,
        });

        if (hasConflict) {
          throw new ConflictException({
            message: 'Selected slot is no longer available',
            code: 'SLOT_CONFLICT',
          });
        }

        return tx.booking.update({
          where: { id: booking.id },
          data: {
            startTimeUtc,
            endTimeUtc,
            guestTimezone,
            cancellationReason: null,
          },
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
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );

    await this.scheduleBookingReminder({
      bookingId: booking.id,
      hostUserId: booking.hostUserId,
      startTimeUtc,
    });
    await this.scheduleBookingReviewInvitation({
      bookingId: booking.id,
      sendAt: endTimeUtc,
    });
    await this.calendarService?.writeBookingCancelled(booking.id);
    await this.calendarService?.writeBookingCreated(booking.id);
    await this.sendBookingRescheduled({
      hostEmail: booking.host.email,
      hostName: displayName(booking.host),
      eventTitle: booking.eventType.title,
      guestName: booking.guestName,
      guestEmail: booking.guestEmail,
      guestTimezone,
      hostTimezone: booking.host.timezone,
      oldStartTimeUtc: booking.startTimeUtc,
      newStartTimeUtc: startTimeUtc,
      newEndTimeUtc: endTimeUtc,
      location:
        booking.eventType.locationDetails ??
        formatLocation(booking.eventType.locationType),
      bookingId: booking.id,
      actor,
      reason: optionalText(dto.reason),
      cancelUrl: booking.guestCancelToken
        ? buildGuestCancelUrl(booking.guestCancelToken)
        : null,
    });

    return updated;
  }

  private async sendBookingConfirmations(input: {
    hostUserId: string;
    hostEmail: string;
    hostName: string;
    eventTitle: string;
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
      'After your visit, we will email you a separate review link.',
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
    const icsContent = buildIcsCalendar({
      hostName: input.hostName,
      bookings: [
        {
          id: input.bookingId,
          eventTitle: input.eventTitle,
          guestName: input.guestName,
          guestEmail: input.guestEmail,
          startTimeUtc: input.startTimeUtc,
          endTimeUtc: input.endTimeUtc,
          location: input.location,
        },
      ],
    });
    const attachments = [
      {
        filename: 'bookvella-booking.ics',
        contentType: 'text/calendar; method=PUBLISH; charset=UTF-8',
        content: icsContent,
      },
    ];

    const deliveries = [
      this.emailService.sendMail({
        to: input.guestEmail,
        subject: `Confirmed: ${input.eventTitle}`,
        text: guestText,
        attachments,
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
          ],
        }),
      }),
    ];

    if (
      await this.isHostEmailEnabled(
        input.hostUserId,
        NotificationType.NEW_BOOKING,
      )
    ) {
      deliveries.push(
        this.emailService.sendMail({
          to: input.hostEmail,
          subject: `New booking: ${input.eventTitle}`,
          text: hostText,
          attachments,
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
      );
    }

    await Promise.all(deliveries);
  }

  private async sendBookingRescheduled(input: {
    hostEmail: string;
    hostName: string;
    eventTitle: string;
    guestName: string;
    guestEmail: string;
    guestTimezone: string;
    hostTimezone: string;
    oldStartTimeUtc: Date;
    newStartTimeUtc: Date;
    newEndTimeUtc: Date;
    location: string;
    bookingId: string;
    actor: 'host' | 'guest';
    reason: string | null;
    cancelUrl: string | null;
  }) {
    const guestOldWhen = formatForEmail(
      input.oldStartTimeUtc,
      input.guestTimezone,
    );
    const guestNewWhen = formatForEmail(
      input.newStartTimeUtc,
      input.guestTimezone,
    );
    const hostOldWhen = formatForEmail(input.oldStartTimeUtc, input.hostTimezone);
    const hostNewWhen = formatForEmail(input.newStartTimeUtc, input.hostTimezone);
    const actorLabel = input.actor === 'host' ? input.hostName : input.guestName;
    const reasonLines = input.reason ? ['', `Reason: ${input.reason}`] : [];
    const guestText = [
      `Your booking was rescheduled.`,
      '',
      `Service: ${input.eventTitle}`,
      `Host: ${input.hostName}`,
      `Previous time: ${guestOldWhen}`,
      `New time: ${guestNewWhen}`,
      `Location: ${input.location}`,
      ...reasonLines,
      ...(input.cancelUrl ? ['', `Need to cancel? ${input.cancelUrl}`] : []),
    ].join('\n');
    const hostText = [
      `Booking rescheduled.`,
      '',
      `Service: ${input.eventTitle}`,
      `Guest: ${input.guestName} <${input.guestEmail}>`,
      `Previous time: ${hostOldWhen}`,
      `New time: ${hostNewWhen}`,
      `Location: ${input.location}`,
      `Changed by: ${actorLabel}`,
      ...reasonLines,
    ].join('\n');
    const icsContent = buildIcsCalendar({
      hostName: input.hostName,
      bookings: [
        {
          id: input.bookingId,
          eventTitle: input.eventTitle,
          guestName: input.guestName,
          guestEmail: input.guestEmail,
          startTimeUtc: input.newStartTimeUtc,
          endTimeUtc: input.newEndTimeUtc,
          location: input.location,
        },
      ],
    });
    const attachments = [
      {
        filename: 'bookvella-booking.ics',
        contentType: 'text/calendar; method=REQUEST; charset=UTF-8',
        content: icsContent,
      },
    ];

    await Promise.all([
      this.emailService.sendMail({
        to: input.guestEmail,
        subject: `Rescheduled: ${input.eventTitle}`,
        text: guestText,
        attachments,
        html: brandedEmailHtml({
          title: 'Your booking was rescheduled',
          intro: `${input.eventTitle} with ${input.hostName} has a new time.`,
          rows: [
            ['Previous time', guestOldWhen],
            ['New time', guestNewWhen],
            ['Location', input.location],
            ...(input.reason
              ? ([['Reason', input.reason]] as [string, string][])
              : []),
          ],
          links: input.cancelUrl
            ? [{ label: 'Need to cancel?', url: input.cancelUrl }]
            : [],
        }),
      }),
      this.emailService.sendMail({
        to: input.hostEmail,
        subject: `Rescheduled booking: ${input.eventTitle}`,
        text: hostText,
        attachments,
        html: brandedEmailHtml({
          title: 'Booking rescheduled',
          intro: `${input.guestName}'s booking has a new time.`,
          rows: [
            ['Guest', `${input.guestName} <${input.guestEmail}>`],
            ['Previous time', hostOldWhen],
            ['New time', hostNewWhen],
            ['Location', input.location],
            ['Changed by', actorLabel],
            ...(input.reason
              ? ([['Reason', input.reason]] as [string, string][])
              : []),
          ],
        }),
      }),
    ]);
  }

  private async sendBookingCancellation(input: {
    hostUserId: string;
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

    const deliveries = [
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
    ];

    if (
      await this.isHostEmailEnabled(
        input.hostUserId,
        NotificationType.CANCELLATION,
      )
    ) {
      deliveries.push(
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
      );
    }

    await Promise.all(deliveries);
  }

  private async isHostEmailEnabled(hostUserId: string, type: NotificationType) {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: {
        userId_channel_type: {
          userId: hostUserId,
          channel: NotificationChannel.EMAIL,
          type,
        },
      },
    });

    return preference?.enabled ?? true;
  }

  private async hasBookingConflict(
    tx: Prisma.TransactionClient,
    candidate: {
      hostUserId: string;
      startTimeUtc: Date;
      endTimeUtc: Date;
      bufferBeforeMinutes: number;
      bufferAfterMinutes: number;
      excludeBookingId?: string;
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
        ...(candidate.excludeBookingId
          ? { id: { not: candidate.excludeBookingId } }
          : {}),
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

function displayName(user: {
  name: string;
  businessDisplayName?: string | null;
}) {
  return user.businessDisplayName?.trim() || user.name;
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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function toCsv(rows: string[][]) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function csvCell(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

function createFeedToken() {
  return randomBytes(32).toString('base64url');
}

function hashFeedToken(token: string) {
  return createHash('sha256').update(token).digest('base64url');
}

function buildFeedUrl(token: string) {
  const apiUrl =
    process.env.PUBLIC_API_URL ??
    process.env.API_URL ??
    'http://localhost:3000';
  return `${apiUrl.replace(/\/$/, '')}/public/feeds/${token}.ics`;
}

function encryptFeedToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', feedEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
}

function decryptFeedToken(value: string) {
  const [version, iv, tag, ciphertext] = value.split(':');

  if (version !== 'v1' || !iv || !tag || !ciphertext) {
    throw new Error('Invalid encrypted feed token');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    feedEncryptionKey(),
    Buffer.from(iv, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

function feedEncryptionKey() {
  return createHash('sha256')
    .update(
      process.env.BOOKING_FEED_TOKEN_KEY ??
        process.env.JWT_PRIVATE_KEY ??
        'bookvella-feed-dev',
    )
    .digest();
}

function buildIcsCalendar(input: {
  hostName: string;
  bookings: {
    id: string;
    eventTitle: string;
    guestName: string;
    guestEmail: string;
    startTimeUtc: Date;
    endTimeUtc: Date;
    location: string;
  }[];
}) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bookvella//Bookings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(`Bookvella - ${input.hostName}`)}`,
    ...input.bookings.flatMap((booking) => [
      'BEGIN:VEVENT',
      `UID:${icsText(`${booking.id}@bookvella`)}`,
      `DTSTAMP:${icsDate(new Date())}`,
      `DTSTART:${icsDate(booking.startTimeUtc)}`,
      `DTEND:${icsDate(booking.endTimeUtc)}`,
      `SUMMARY:${icsText(booking.eventTitle)}`,
      `DESCRIPTION:${icsText(`Guest: ${booking.guestName} <${booking.guestEmail}>`)}`,
      `LOCATION:${icsText(booking.location)}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

function bookingToIcsEntry(booking: {
  id: string;
  guestName: string;
  guestEmail: string;
  startTimeUtc: Date;
  endTimeUtc: Date;
  eventType: {
    title: string;
    locationType: string;
    locationDetails: string | null;
  };
}) {
  return {
    id: booking.id,
    eventTitle: booking.eventType.title,
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    startTimeUtc: booking.startTimeUtc,
    endTimeUtc: booking.endTimeUtc,
    location:
      booking.eventType.locationDetails ??
      formatLocation(booking.eventType.locationType),
  };
}

function icsDate(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function icsText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function localDateAsUtcDate(date: {
  year: number;
  month: number;
  day: number;
}) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}
