import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { createReviewToken } from './reviews.service';
import { ReviewsService } from './reviews.service';

function makePrisma() {
  return {
    booking: {
      findUnique: jest.fn(),
    },
    review: {
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };
}

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-123',
    status: BookingStatus.CONFIRMED,
    hostUserId: 'host-1',
    eventTypeId: 'event-1',
    guestName: 'Guest Name',
    guestEmail: 'guest@example.com',
    eventType: { id: 'event-1', title: 'Intro Call', slug: 'intro' },
    ...overrides,
  };
}

// ─── createReviewToken (exported pure function) ───────────────────────────────

describe('createReviewToken', () => {
  it('returns the same token for the same bookingId', () => {
    expect(createReviewToken('booking-abc')).toBe(createReviewToken('booking-abc'));
  });

  it('returns different tokens for different bookingIds', () => {
    expect(createReviewToken('booking-1')).not.toBe(createReviewToken('booking-2'));
  });

  it('returns a non-empty base64url string', () => {
    const token = createReviewToken('booking-xyz');
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

// ─── submitPublicReview ───────────────────────────────────────────────────────

describe('ReviewsService – submitPublicReview', () => {
  let service: ReviewsService;
  let prisma: ReturnType<typeof makePrisma>;

  const BOOKING_ID = 'booking-123';

  function validDto(overrides: Record<string, unknown> = {}) {
    return {
      bookingId: BOOKING_ID,
      token: createReviewToken(BOOKING_ID),
      rating: 5,
      comment: 'Great session!',
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = makePrisma();
    service = new ReviewsService(prisma as any);
  });

  it('throws UnauthorizedException for an invalid token', async () => {
    await expect(
      service.submitPublicReview(validDto({ token: 'bad-token' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws BadRequestException when rating is 0', async () => {
    await expect(
      service.submitPublicReview(validDto({ rating: 0 })),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when rating exceeds 5', async () => {
    await expect(
      service.submitPublicReview(validDto({ rating: 6 })),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when comment is empty', async () => {
    await expect(
      service.submitPublicReview(validDto({ comment: '' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when comment exceeds 800 characters', async () => {
    await expect(
      service.submitPublicReview(validDto({ comment: 'a'.repeat(801) })),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when booking does not exist', async () => {
    prisma.booking.findUnique.mockResolvedValue(null);

    await expect(service.submitPublicReview(validDto())).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when booking is cancelled', async () => {
    prisma.booking.findUnique.mockResolvedValue(
      makeBooking({ status: BookingStatus.CANCELLED }),
    );

    await expect(service.submitPublicReview(validDto())).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws ConflictException when a review already exists (P2002)', async () => {
    prisma.booking.findUnique.mockResolvedValue(makeBooking());
    prisma.review.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`bookingId`)',
        { code: 'P2002', clientVersion: '6.0.0' },
      ),
    );

    await expect(service.submitPublicReview(validDto())).rejects.toThrow(
      ConflictException,
    );
  });

  it('creates a review for a valid confirmed booking', async () => {
    const booking = makeBooking();
    const review = { id: 'review-1', bookingId: BOOKING_ID, rating: 5 };
    prisma.booking.findUnique.mockResolvedValue(booking);
    prisma.review.create.mockResolvedValue(review);

    const result = await service.submitPublicReview(validDto());

    expect(result).toEqual(review);
    expect(prisma.review.create).toHaveBeenCalledTimes(1);
  });
});

// ─── updateVisibility ─────────────────────────────────────────────────────────

describe('ReviewsService – updateVisibility', () => {
  let service: ReviewsService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new ReviewsService(prisma as any);
  });

  it('throws BadRequestException when isVisible is not a boolean', async () => {
    await expect(
      service.updateVisibility('host-1', 'review-1', { isVisible: undefined }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws NotFoundException when the review does not belong to the host', async () => {
    prisma.review.findFirst.mockResolvedValue(null);

    await expect(
      service.updateVisibility('host-1', 'review-x', { isVisible: false }),
    ).rejects.toThrow(NotFoundException);
  });
});
