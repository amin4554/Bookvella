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

  // ── Blackout date overrides ────────────────────────────────────────────────

  listOverrides(userId: string) {
    return this.prisma.availabilityOverride.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });
  }

  async addOverride(userId: string, dateStr: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException('date must be in YYYY-MM-DD format');
    }

    const date = new Date(`${dateStr}T00:00:00.000Z`);

    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('date is not a valid calendar date');
    }

    // Reject dates in the past
    const todayUtc = new Date();
    todayUtc.setUTCHours(0, 0, 0, 0);

    if (date < todayUtc) {
      throw new BadRequestException('Cannot block a date in the past');
    }

    try {
      return await this.prisma.availabilityOverride.create({
        data: { userId, date, isBlocked: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // Already blocked — return the existing record
        return this.prisma.availabilityOverride.findFirst({
          where: { userId, date },
        });
      }
      throw error;
    }
  }

  async removeOverride(userId: string, id: string) {
    const result = await this.prisma.availabilityOverride.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Override not found');
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
