import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LocationType, PriceType, Prisma } from '@prisma/client';
import { slugify } from '../common/slug';
import {
  optionalNonNegativeInteger,
  optionalText,
  requirePositiveInteger,
  requireText,
} from '../common/validation';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateEventTypeDto, UpdateEventTypeDto } from './dto';

const MAX_DURATION_MINUTES = 12 * 60;
const MAX_BUFFER_MINUTES = 24 * 60;
const MAX_PRICE_CENTS = 100_000_00; // $100,000
const MAX_GALLERY_IMAGES = 5;

@Injectable()
export class EventTypesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.eventType.findMany({
      where: { userId, deletedAt: null },
      orderBy: [
        { isFeatured: 'desc' },
        { isActive: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async create(userId: string, dto: CreateEventTypeDto) {
    const title = requireText(dto.title, 'title');
    const slug = slugify(dto.slug ?? title);
    const locationType = normalizeLocationType(dto.locationType);
    const priceType = normalizePriceType(dto.priceType);
    const { priceAmount, priceMaxAmount } = normalizePricePair(
      priceType,
      dto.priceAmount,
      dto.priceMaxAmount,
    );

    try {
      return await this.prisma.eventType.create({
        data: {
          userId,
          slug,
          title,
          category: optionalText(dto.category),
          imageUrl: optionalUrl(dto.imageUrl, 'imageUrl'),
          description: optionalText(dto.description),
          whatIncluded: optionalText(dto.whatIncluded),
          preparationNotes: optionalText(dto.preparationNotes),
          locationDetails: optionalText(dto.locationDetails),
          durationMinutes: requirePositiveInteger(
            dto.durationMinutes,
            'durationMinutes',
            { max: MAX_DURATION_MINUTES },
          ),
          bufferBeforeMinutes:
            optionalNonNegativeInteger(
              dto.bufferBeforeMinutes,
              'bufferBeforeMinutes',
              { max: MAX_BUFFER_MINUTES },
            ) ?? 0,
          bufferAfterMinutes:
            optionalNonNegativeInteger(
              dto.bufferAfterMinutes,
              'bufferAfterMinutes',
              { max: MAX_BUFFER_MINUTES },
            ) ?? 0,
          locationType,
          priceType,
          priceAmount,
          priceMaxAmount,
          priceCurrency: normalizeCurrency(dto.priceCurrency),
          galleryImageUrls: normalizeGallery(dto.galleryImageUrls),
          isFeatured: dto.isFeatured ?? false,
          directLinkOnly: dto.directLinkOnly ?? false,
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'You already have an event type with that slug',
        );
      }

      throw error;
    }
  }

  async update(userId: string, id: string, dto: UpdateEventTypeDto) {
    const existing = await this.assertOwned(userId, id);
    const data: Prisma.EventTypeUpdateInput = {};

    if (dto.title !== undefined) {
      data.title = requireText(dto.title, 'title');
    }

    if (dto.slug !== undefined) {
      data.slug = slugify(dto.slug);
    }

    if (dto.description !== undefined) {
      data.description = optionalText(dto.description);
    }

    if (dto.category !== undefined) {
      data.category = optionalText(dto.category);
    }

    if (dto.imageUrl !== undefined) {
      data.imageUrl = optionalUrl(dto.imageUrl, 'imageUrl');
    }

    if (dto.whatIncluded !== undefined) {
      data.whatIncluded = optionalText(dto.whatIncluded);
    }

    if (dto.preparationNotes !== undefined) {
      data.preparationNotes = optionalText(dto.preparationNotes);
    }

    if (dto.locationDetails !== undefined) {
      data.locationDetails = optionalText(dto.locationDetails);
    }

    if (dto.durationMinutes !== undefined) {
      data.durationMinutes = requirePositiveInteger(
        dto.durationMinutes,
        'durationMinutes',
        { max: MAX_DURATION_MINUTES },
      );
    }

    if (dto.bufferBeforeMinutes !== undefined) {
      data.bufferBeforeMinutes = optionalNonNegativeInteger(
        dto.bufferBeforeMinutes,
        'bufferBeforeMinutes',
        { max: MAX_BUFFER_MINUTES },
      );
    }

    if (dto.bufferAfterMinutes !== undefined) {
      data.bufferAfterMinutes = optionalNonNegativeInteger(
        dto.bufferAfterMinutes,
        'bufferAfterMinutes',
        { max: MAX_BUFFER_MINUTES },
      );
    }

    if (dto.locationType !== undefined) {
      data.locationType = normalizeLocationType(dto.locationType);
    }

    if (dto.isActive !== undefined) {
      if (typeof dto.isActive !== 'boolean') {
        throw new BadRequestException('isActive must be a boolean');
      }

      data.isActive = dto.isActive;
    }

    // Price needs to be normalized together so that RANGE has both bounds
    // and FREE wipes the amount fields.
    const nextPriceType =
      dto.priceType !== undefined
        ? normalizePriceType(dto.priceType)
        : existing.priceType;
    const wantsPriceUpdate =
      dto.priceType !== undefined ||
      dto.priceAmount !== undefined ||
      dto.priceMaxAmount !== undefined;

    if (wantsPriceUpdate) {
      const nextAmount =
        dto.priceAmount !== undefined ? dto.priceAmount : existing.priceAmount;
      const nextMax =
        dto.priceMaxAmount !== undefined
          ? dto.priceMaxAmount
          : existing.priceMaxAmount;

      const normalized = normalizePricePair(nextPriceType, nextAmount, nextMax);
      data.priceType = nextPriceType;
      data.priceAmount = normalized.priceAmount;
      data.priceMaxAmount = normalized.priceMaxAmount;
    }

    if (dto.priceCurrency !== undefined) {
      data.priceCurrency = normalizeCurrency(dto.priceCurrency);
    }

    if (dto.galleryImageUrls !== undefined) {
      data.galleryImageUrls = { set: normalizeGallery(dto.galleryImageUrls) };
    }

    if (dto.isFeatured !== undefined) {
      data.isFeatured = Boolean(dto.isFeatured);
    }

    if (dto.directLinkOnly !== undefined) {
      data.directLinkOnly = Boolean(dto.directLinkOnly);
    }

    try {
      return await this.prisma.eventType.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException(
          'You already have an event type with that slug',
        );
      }

      throw error;
    }
  }

  async deactivate(userId: string, id: string) {
    await this.assertOwned(userId, id);

    return this.prisma.eventType.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async remove(userId: string, id: string) {
    await this.assertOwned(userId, id);

    await this.prisma.eventType.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });

    return { success: true };
  }

  private async assertOwned(userId: string, id: string) {
    const eventType = await this.prisma.eventType.findFirst({
      where: { id, userId, deletedAt: null },
    });

    if (!eventType) {
      throw new NotFoundException('Event type not found');
    }

    return eventType;
  }
}

function normalizeLocationType(value: LocationType | undefined) {
  if (value === undefined) {
    return LocationType.VIDEO;
  }

  if (!Object.values(LocationType).includes(value)) {
    throw new BadRequestException('Invalid locationType');
  }

  return value;
}

function normalizePriceType(value: PriceType | undefined) {
  if (value === undefined) {
    return PriceType.FIXED;
  }

  if (!Object.values(PriceType).includes(value)) {
    throw new BadRequestException('Invalid priceType');
  }

  return value;
}

function normalizePricePair(
  type: PriceType,
  amount: number | null | undefined,
  max: number | null | undefined,
) {
  if (type === PriceType.FREE) {
    return { priceAmount: null, priceMaxAmount: null };
  }

  const lower = normalizePrice(amount);

  if (type === PriceType.RANGE) {
    const upper = normalizePrice(max);

    if (lower === null || upper === null) {
      throw new BadRequestException(
        'Range pricing requires both a lower and an upper amount',
      );
    }

    if (upper < lower) {
      throw new BadRequestException(
        'Upper price must be greater than or equal to the lower price',
      );
    }

    return { priceAmount: lower, priceMaxAmount: upper };
  }

  // FIXED and FROM only use the lower amount.
  return { priceAmount: lower, priceMaxAmount: null };
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function normalizePrice(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isInteger(value) || value < 0 || value > MAX_PRICE_CENTS) {
    throw new BadRequestException(
      'price amount must be a non-negative integer (cents)',
    );
  }

  return value;
}

function normalizeCurrency(value: string | undefined) {
  if (value === undefined) {
    return 'USD';
  }

  const upper = value.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(upper)) {
    throw new BadRequestException(
      'priceCurrency must be a 3-letter ISO currency code',
    );
  }

  return upper;
}

function normalizeGallery(value: string[] | undefined) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new BadRequestException('galleryImageUrls must be an array');
  }

  const cleaned: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string') {
      throw new BadRequestException('Each gallery image must be a string URL');
    }
    const trimmed = entry.trim();
    if (!trimmed) continue;

    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        throw new Error('Invalid protocol');
      }
      cleaned.push(url.toString());
    } catch {
      throw new BadRequestException(
        'Each gallery image must be a valid http(s) URL',
      );
    }
  }

  if (cleaned.length > MAX_GALLERY_IMAGES) {
    throw new BadRequestException(
      `At most ${MAX_GALLERY_IMAGES} gallery images are allowed`,
    );
  }

  return cleaned;
}

function optionalUrl(value: string | null | undefined, field: string) {
  const text = optionalText(value);

  if (!text) {
    return null;
  }

  try {
    const url = new URL(text);

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Invalid protocol');
    }

    return url.toString();
  } catch {
    throw new BadRequestException(`${field} must be a valid URL`);
  }
}
