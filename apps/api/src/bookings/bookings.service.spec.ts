import { ConflictException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';

function makePrisma() {
  return {
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
      title: 'Intro Call',
      bufferBeforeMinutes: 0,
      bufferAfterMinutes: 0,
    },
    host: {
      email: 'host@example.com',
      name: 'Host',
      timezone: 'UTC',
    },
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
