import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { BookingStatus, Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { optionalText, requirePositiveInteger, requireText } from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import type { SubmitReviewDto, UpdateReviewVisibilityDto } from './dto';

const MAX_REVIEW_COMMENT_LENGTH = 800;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  listHostReviews(hostUserId: string) {
    return this.prisma.review.findMany({
      where: { hostUserId },
      include: {
        eventType: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async submitPublicReview(dto: SubmitReviewDto) {
    const bookingId = requireText(dto.bookingId, 'bookingId');
    const token = requireText(dto.token, 'token');
    const rating = requirePositiveInteger(dto.rating, 'rating', { max: 5 });
    const comment = requireText(dto.comment, 'comment');

    if (comment.length > MAX_REVIEW_COMMENT_LENGTH) {
      throw new BadRequestException(
        `comment cannot be greater than ${MAX_REVIEW_COMMENT_LENGTH} characters`,
      );
    }

    if (!verifyReviewToken(bookingId, token)) {
      throw new UnauthorizedException('Review link is invalid');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        eventType: true,
      },
    });

    if (!booking || booking.status === BookingStatus.CANCELLED) {
      throw new NotFoundException('Reviewable booking not found');
    }

    try {
      return await this.prisma.review.create({
        data: {
          bookingId: booking.id,
          hostUserId: booking.hostUserId,
          eventTypeId: booking.eventTypeId,
          guestName: booking.guestName,
          guestEmail: booking.guestEmail,
          rating,
          comment,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A review has already been submitted');
      }

      throw error;
    }
  }

  async updateVisibility(
    hostUserId: string,
    reviewId: string,
    dto: UpdateReviewVisibilityDto,
  ) {
    if (typeof dto.isVisible !== 'boolean') {
      throw new BadRequestException('isVisible must be a boolean');
    }

    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        hostUserId,
      },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    return this.prisma.review.update({
      where: { id: review.id },
      data: { isVisible: dto.isVisible },
      include: {
        eventType: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });
  }
}

export function createReviewToken(bookingId: string) {
  return createHmac('sha256', reviewSecret())
    .update(bookingId)
    .digest('base64url');
}

function verifyReviewToken(bookingId: string, token: string) {
  const expected = Buffer.from(createReviewToken(bookingId), 'base64url');
  const candidate = Buffer.from(token, 'base64url');

  return (
    expected.length === candidate.length && timingSafeEqual(expected, candidate)
  );
}

function reviewSecret() {
  return (
    optionalText(process.env.REVIEW_TOKEN_SECRET) ??
    optionalText(process.env.EMAIL_CODE_SECRET) ??
    optionalText(process.env.JWT_PRIVATE_KEY) ??
    'bookvella-review-dev'
  );
}
