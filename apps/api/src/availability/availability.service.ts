import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateAvailabilityRuleDto,
  UpdateAvailabilityRuleDto,
} from './dto';

const MINUTES_PER_DAY = 24 * 60;

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.availabilityRule.findMany({
      where: { userId },
      orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
    });
  }

  create(userId: string, dto: CreateAvailabilityRuleDto) {
    const rule = normalizeRule(dto, { requireAll: true });

    return this.prisma.availabilityRule.create({
      data: {
        userId,
        dayOfWeek: rule.dayOfWeek!,
        startMinute: rule.startMinute!,
        endMinute: rule.endMinute!,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateAvailabilityRuleDto) {
    const existing = await this.prisma.availabilityRule.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Availability rule not found');
    }

    const next = {
      dayOfWeek: dto.dayOfWeek ?? existing.dayOfWeek,
      startMinute: dto.startMinute ?? existing.startMinute,
      endMinute: dto.endMinute ?? existing.endMinute,
    };

    normalizeRule(next, { requireAll: true });

    const data: Prisma.AvailabilityRuleUpdateInput = {};

    if (dto.dayOfWeek !== undefined) {
      data.dayOfWeek = next.dayOfWeek;
    }

    if (dto.startMinute !== undefined) {
      data.startMinute = next.startMinute;
    }

    if (dto.endMinute !== undefined) {
      data.endMinute = next.endMinute;
    }

    return this.prisma.availabilityRule.update({
      where: { id },
      data,
    });
  }

  async remove(userId: string, id: string) {
    const result = await this.prisma.availabilityRule.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Availability rule not found');
    }

    return { success: true };
  }
}

function normalizeRule(
  dto: CreateAvailabilityRuleDto | UpdateAvailabilityRuleDto,
  options: { requireAll: boolean },
) {
  const dayOfWeek = normalizeDayOfWeek(dto.dayOfWeek, options.requireAll);
  const startMinute = normalizeMinute(
    dto.startMinute,
    'startMinute',
    options.requireAll,
  );
  const endMinute = normalizeMinute(
    dto.endMinute,
    'endMinute',
    options.requireAll,
  );

  if (
    startMinute !== undefined &&
    endMinute !== undefined &&
    startMinute >= endMinute
  ) {
    throw new BadRequestException('startMinute must be before endMinute');
  }

  return { dayOfWeek, startMinute, endMinute };
}

function normalizeDayOfWeek(value: number | undefined, required: boolean) {
  if (value === undefined) {
    if (required) {
      throw new BadRequestException('dayOfWeek is required');
    }

    return undefined;
  }

  if (!Number.isInteger(value) || value < 0 || value > 6) {
    throw new BadRequestException('dayOfWeek must be an integer from 0 to 6');
  }

  return value;
}

function normalizeMinute(
  value: number | undefined,
  field: string,
  required: boolean,
) {
  if (value === undefined) {
    if (required) {
      throw new BadRequestException(`${field} is required`);
    }

    return undefined;
  }

  if (!Number.isInteger(value) || value < 0 || value > MINUTES_PER_DAY) {
    throw new BadRequestException(`${field} must be an integer from 0 to 1440`);
  }

  return value;
}
