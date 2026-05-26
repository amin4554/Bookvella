import { ConflictException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';

function makePrisma() {
  return {
    user: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    booking: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      update: jest.fn(),
    },
    otpVerification: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    notificationPreference: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    bookingReminder: {
      upsert: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    bookingReviewInvitation: {
      upsert: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn(),
    },
    dailyAgendaDelivery: {
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

function makeSchedulingService() {
  return {
    getAvailableSlots: jest.fn().mockResolvedValue([]),
  };
}

function makeEmailService() {
  return {
    sendMail: jest.fn().mockResolvedValue(undefined),
  };
}

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    hostUserId: 'host-1',
    status: BookingStatus.CONFIRMED,
    guestName: 'Guest',
    guestEmail: 'guest@example.com',
    guestTimezone: 'UTC',
    startTimeUtc: new Date('2026-06-01T10:00:00.000Z'),
    endTimeUtc: new Date('2026-06-01T10:30:00.000Z'),
    eventType: {
      id: 'event-1',
      slug: 'intro-call',
      title: 'Intro Call',
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
      locationType: 'VIDEO',
      locationDetails: null,
    },
    host: {
      id: 'host-1',
      email: 'host@example.com',
      name: 'Host',
      businessDisplayName: null,
      slug: 'host',
      timezone: 'UTC',
    },
    review: null,
    ...overrides,
  };
}

// ─── cancelHostBooking ────────────────────────────────────────────────────────

describe('BookingsService – cancelHostBooking', () => {
  let service: BookingsService;
  let prisma: ReturnType<typeof makePrisma>;
  let email: ReturnType<typeof makeEmailService>;

  beforeEach(() => {
    prisma = makePrisma();
    email = makeEmailService();
    service = new BookingsService(
      prisma as any,
      makeSchedulingService() as any,
      email as any,
    );
  });

  it('throws NotFoundException when the booking does not exist', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);

    await expect(
      service.cancelHostBooking('host-1', 'nonexistent', {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when the booking is already cancelled', async () => {
    prisma.booking.findFirst.mockResolvedValue(
      makeBooking({ status: BookingStatus.CANCELLED }),
    );

    await expect(
      service.cancelHostBooking('host-1', 'booking-1', {}),
    ).rejects.toThrow(ConflictException);
  });

  it('updates the booking status and sends cancellation emails', async () => {
    const booking = makeBooking();
    const cancelled = { ...booking, status: BookingStatus.CANCELLED };
    prisma.booking.findFirst.mockResolvedValue(booking);
    prisma.booking.update.mockResolvedValue(cancelled);

    const result = await service.cancelHostBooking('host-1', 'booking-1', {
      reason: 'Host unavailable',
    });

    expect(result.status).toBe(BookingStatus.CANCELLED);
    expect(prisma.booking.update).toHaveBeenCalledTimes(1);
    expect(email.sendMail).toHaveBeenCalledTimes(2); // host + guest
  });

  it('keeps guest cancellation email but skips host email when disabled', async () => {
    const booking = makeBooking();
    const cancelled = { ...booking, status: BookingStatus.CANCELLED };
    prisma.booking.findFirst.mockResolvedValue(booking);
    prisma.booking.update.mockResolvedValue(cancelled);
    prisma.notificationPreference.findUnique.mockResolvedValue({
      enabled: false,
    });

    await service.cancelHostBooking('host-1', 'booking-1', {
      reason: 'Host unavailable',
    });

    expect(email.sendMail).toHaveBeenCalledTimes(1);
    expect(email.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'guest@example.com' }),
    );
  });
});

describe('BookingsService reminders', () => {
  it('claims and sends due booking reminders', async () => {
    const prisma = makePrisma();
    const email = makeEmailService();
    const booking = makeBooking();
    prisma.bookingReminder.findMany.mockResolvedValue([
      {
        bookingId: booking.id,
        sendAt: new Date(Date.now() - 60_000),
        status: 'PENDING',
        booking,
      },
    ]);
    const service = new BookingsService(
      prisma as any,
      makeSchedulingService() as any,
      email as any,
    );

    await expect(service.processDueReminders()).resolves.toEqual({
      processed: 1,
    });

    expect(email.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'guest@example.com',
        subject: 'Reminder: Intro Call',
      }),
    );
    expect(prisma.bookingReminder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: 'booking-1' },
        data: expect.objectContaining({ status: 'SENT' }),
      }),
    );
  });
});

describe('BookingsService review invitations', () => {
  it('sends review links only after the booking is due for review', async () => {
    const prisma = makePrisma();
    const email = makeEmailService();
    const booking = makeBooking({
      endTimeUtc: new Date(Date.now() - 60_000),
    });
    prisma.bookingReviewInvitation.findMany.mockResolvedValue([
      {
        bookingId: booking.id,
        sendAt: new Date(Date.now() - 60_000),
        status: 'PENDING',
        booking,
      },
    ]);
    const service = new BookingsService(
      prisma as any,
      makeSchedulingService() as any,
      email as any,
    );

    await expect(service.processDueReviewInvitations()).resolves.toEqual({
      processed: 1,
    });

    expect(email.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'guest@example.com',
        subject: 'How was Intro Call?',
      }),
    );
    expect(prisma.bookingReviewInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: 'booking-1' },
        data: expect.objectContaining({ status: 'SENT' }),
      }),
    );
  });

  it('does not send a review link for cancelled bookings', async () => {
    const prisma = makePrisma();
    const email = makeEmailService();
    const booking = makeBooking({
      status: BookingStatus.CANCELLED,
      endTimeUtc: new Date(Date.now() - 60_000),
    });
    prisma.bookingReviewInvitation.findMany.mockResolvedValue([
      {
        bookingId: booking.id,
        sendAt: new Date(Date.now() - 60_000),
        status: 'PENDING',
        booking,
      },
    ]);
    const service = new BookingsService(
      prisma as any,
      makeSchedulingService() as any,
      email as any,
    );

    await expect(service.processDueReviewInvitations()).resolves.toEqual({
      processed: 1,
    });

    expect(email.sendMail).not.toHaveBeenCalled();
    expect(prisma.bookingReviewInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: 'booking-1' },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      }),
    );
  });
});

// ─── listHostBookings ─────────────────────────────────────────────────────────

describe('BookingsService – listHostBookings', () => {
  it('returns the list from prisma', async () => {
    const prisma = makePrisma();
    const bookings = [makeBooking()];
    prisma.booking.findMany.mockResolvedValue(bookings);
    const service = new BookingsService(
      prisma as any,
      makeSchedulingService() as any,
      makeEmailService() as any,
    );

    const result = await service.listHostBookings('host-1');

    expect(result).toEqual(bookings);
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { hostUserId: 'host-1' } }),
    );
  });
});

describe('BookingsService daily agenda', () => {
  it('sends one agenda email per host local day inside the send window', async () => {
    const prisma = makePrisma();
    const email = makeEmailService();
    const booking = makeBooking({
      startTimeUtc: new Date('2026-06-01T10:00:00.000Z'),
    });
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'host-1',
        email: 'host@example.com',
        name: 'Host',
        businessDisplayName: null,
        timezone: 'UTC',
      },
    ]);
    prisma.booking.findMany.mockResolvedValue([booking]);
    const service = new BookingsService(
      prisma as any,
      makeSchedulingService() as any,
      email as any,
    );

    await expect(
      service.processDailyAgendas(new Date('2026-06-01T07:05:00.000Z')),
    ).resolves.toEqual({ processed: 1 });

    expect(prisma.dailyAgendaDelivery.create).toHaveBeenCalledWith({
      data: {
        userId: 'host-1',
        agendaDate: new Date('2026-06-01T00:00:00.000Z'),
        status: 'PROCESSING',
      },
    });
    expect(email.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'host@example.com',
        subject: "Today's Bookvella agenda",
      }),
    );
  });
});
