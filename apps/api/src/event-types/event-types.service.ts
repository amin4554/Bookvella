import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LocationType, Prisma } from '@prisma/client';
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

@Injectable()
export class EventTypesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.eventType.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, dto: CreateEventTypeDto) {
    const title = requireText(dto.title, 'title');
    const slug = slugify(dto.slug ?? title);
    const locationType = normalizeLocationType(dto.locationType);

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
    await this.assertOwned(userId, id);
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

  private async assertOwned(userId: string, id: string) {
    const eventType = await this.prisma.eventType.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!eventType) {
      throw new NotFoundException('Event type not found');
    }
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

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
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
