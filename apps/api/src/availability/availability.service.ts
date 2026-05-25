import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AvailabilityOverrideType,
  EventTypeAvailabilityMode,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type {
  AvailabilityBlockDto,
  AvailabilitySettingsDto,
  CreateAvailabilityOverrideDto,
  CreateAvailabilityRuleDto,
  ReplaceEventTypeAvailabilityDto,
  ReplaceAvailabilityRulesDto,
  UpdateAvailabilityOverrideDto,
  UpdateAvailabilityRuleDto,
} from './dto';
import type {
  ApplyAvailabilityScheduleDto,
  CreateAvailabilityScheduleDto,
  UpdateAvailabilityScheduleDto,
} from './schedules.dto';

const MINUTES_PER_DAY = 24 * 60;
const MAX_RANGE_DAYS = 366;
const MAX_BLOCKS_PER_OVERRIDE = 6;

type NormalizedRule = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
};

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

  // Replace the entire weekly schedule in a single transaction. Lets the UI
  // submit a fully edited set of weekly rules without sequencing many calls.
  async replaceRules(userId: string, dto: ReplaceAvailabilityRulesDto) {
    const normalized = normalizeRuleList(dto.rules ?? []);

    return this.prisma.$transaction(async (tx) => {
      await tx.availabilityRule.deleteMany({ where: { userId } });
      if (normalized.length === 0) {
        return [];
      }
      await tx.availabilityRule.createMany({
        data: normalized.map((rule) => ({ userId, ...rule })),
      });
      return tx.availabilityRule.findMany({
        where: { userId },
        orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
      });
    });
  }

  async getEventTypeAvailability(userId: string, eventTypeId: string) {
    await this.assertOwnedEventType(userId, eventTypeId);
    return this.readEventTypeAvailability(eventTypeId);
  }

  async replaceEventTypeAvailability(
    userId: string,
    eventTypeId: string,
    dto: ReplaceEventTypeAvailabilityDto,
  ) {
    await this.assertOwnedEventType(userId, eventTypeId);

    const mode = normalizeEventTypeAvailabilityMode(dto.mode);
    const normalized =
      mode === EventTypeAvailabilityMode.CUSTOM
        ? normalizeRuleList(dto.rules ?? [])
        : [];

    return this.prisma.$transaction(async (tx) => {
      const availability = await tx.eventTypeAvailability.upsert({
        where: { eventTypeId },
        create: {
          eventTypeId,
          mode,
        },
        update: {
          mode,
        },
      });

      await tx.eventTypeAvailabilityRule.deleteMany({
        where: { availabilityId: availability.id },
      });

      if (normalized.length > 0) {
        await tx.eventTypeAvailabilityRule.createMany({
          data: normalized.map((rule) => ({
            availabilityId: availability.id,
            ...rule,
          })),
        });
      }

      return this.readEventTypeAvailability(eventTypeId, tx);
    });
  }

  // ── Date overrides ─────────────────────────────────────────────────────────

  // When `eventTypeId` is omitted we return every override the host owns so
  // the dashboard can render both host-wide and per-service exceptions in one
  // pass. The "host-only" view passes `host` and the "service" view passes the
  // service id.
  listOverrides(
    userId: string,
    scope?: { eventTypeId?: string | null | 'host' },
  ) {
    const where: Prisma.AvailabilityOverrideWhereInput = { userId };
    if (scope?.eventTypeId === 'host') {
      where.eventTypeId = null;
    } else if (scope?.eventTypeId) {
      where.eventTypeId = scope.eventTypeId;
    }
    return this.prisma.availabilityOverride.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  async addOverride(userId: string, dto: CreateAvailabilityOverrideDto) {
    const startDate = parseDateOnly(dto.date, 'date');
    const endDate =
      dto.endDate && dto.endDate.trim()
        ? parseDateOnly(dto.endDate, 'endDate')
        : startDate;
    const type: AvailabilityOverrideType = dto.type ?? 'BLOCKED';
    const note = dto.note?.trim() || null;
    const blocks = type === 'CUSTOM_HOURS' ? normalizeBlocks(dto.blocks) : null;
    const eventTypeId = dto.eventTypeId ?? null;

    if (eventTypeId) {
      await this.assertOwnedEventType(userId, eventTypeId);
    }

    if (endDate < startDate) {
      throw new BadRequestException('endDate must be on or after date');
    }

    const dayCount =
      Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;

    if (dayCount > MAX_RANGE_DAYS) {
      throw new BadRequestException(
        `Override range cannot exceed ${MAX_RANGE_DAYS} days`,
      );
    }

    const todayUtc = startOfUtcToday();
    if (endDate < todayUtc) {
      throw new BadRequestException(
        'Cannot create an override fully in the past',
      );
    }

    const groupId = dayCount > 1 ? randomUUID() : null;

    return this.prisma.$transaction(async (tx) => {
      const created = [] as Array<{ id: string }>;
      for (
        let cursor = new Date(startDate.getTime());
        cursor <= endDate;
        cursor = new Date(cursor.getTime() + 86_400_000)
      ) {
        // Replace any existing override for this exact scope+date with the new
        // one. Host-level (eventTypeId=null) and per-service (eventTypeId=...)
        // exceptions are tracked separately so blocking a service does not
        // wipe a host-wide block on the same day.
        await tx.availabilityOverride.deleteMany({
          where: { userId, eventTypeId, date: cursor },
        });
        const row = await tx.availabilityOverride.create({
          data: {
            userId,
            eventTypeId,
            date: cursor,
            type,
            isBlocked: type === 'BLOCKED',
            note,
            blocks: blocks ?? undefined,
            groupId,
          },
        });
        created.push({ id: row.id });
      }
      return tx.availabilityOverride.findMany({
        where: { id: { in: created.map((c) => c.id) } },
        orderBy: { date: 'asc' },
      });
    });
  }

  async updateOverride(
    userId: string,
    id: string,
    dto: UpdateAvailabilityOverrideDto,
  ) {
    const existing = await this.prisma.availabilityOverride.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Override not found');
    }

    const data: Prisma.AvailabilityOverrideUpdateInput = {};

    if (dto.type !== undefined) {
      data.type = dto.type;
      data.isBlocked = dto.type === 'BLOCKED';
    }

    if (dto.note !== undefined) {
      data.note = dto.note?.trim() || null;
    }

    if (dto.blocks !== undefined) {
      const next = normalizeBlocks(dto.blocks);
      data.blocks = next ?? Prisma.JsonNull;
    }

    return this.prisma.availabilityOverride.update({
      where: { id },
      data,
    });
  }

  // Delete every override that shares an id or groupId so removing a multi-day
  // exception clears the whole range in one call.
  async removeOverride(userId: string, id: string) {
    const existing = await this.prisma.availabilityOverride.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Override not found');
    }

    if (existing.groupId) {
      await this.prisma.availabilityOverride.deleteMany({
        where: { userId, groupId: existing.groupId },
      });
    } else {
      await this.prisma.availabilityOverride.delete({ where: { id } });
    }

    return { success: true };
  }

  // ── Booking-rules settings (per host) ──────────────────────────────────────

  async getSettings(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        minNoticeMinutes: true,
        bookingHorizonDays: true,
        slotIntervalMinutes: true,
        dailyBookingLimit: true,
        showBufferTime: true,
        timezone: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateSettings(userId: string, dto: AvailabilitySettingsDto) {
    const data: Prisma.UserUpdateInput = {};

    if (dto.minNoticeMinutes !== undefined) {
      data.minNoticeMinutes = clampInt(
        dto.minNoticeMinutes,
        'minNoticeMinutes',
        0,
        14 * 24 * 60,
      );
    }

    if (dto.bookingHorizonDays !== undefined) {
      data.bookingHorizonDays = clampInt(
        dto.bookingHorizonDays,
        'bookingHorizonDays',
        1,
        365,
      );
    }

    if (dto.slotIntervalMinutes !== undefined) {
      const allowed = new Set([5, 10, 15, 20, 30, 60]);
      if (!allowed.has(dto.slotIntervalMinutes)) {
        throw new BadRequestException(
          'slotIntervalMinutes must be one of 5, 10, 15, 20, 30, 60',
        );
      }
      data.slotIntervalMinutes = dto.slotIntervalMinutes;
    }

    if (dto.dailyBookingLimit !== undefined) {
      if (dto.dailyBookingLimit === null) {
        data.dailyBookingLimit = null;
      } else {
        data.dailyBookingLimit = clampInt(
          dto.dailyBookingLimit,
          'dailyBookingLimit',
          1,
          200,
        );
      }
    }

    if (dto.showBufferTime !== undefined) {
      data.showBufferTime = !!dto.showBufferTime;
    }

    await this.prisma.user.update({ where: { id: userId }, data });

    return this.getSettings(userId);
  }

  // ── Named availability schedules (templates) ──────────────────────────────

  async listSchedules(userId: string) {
    const schedules = await this.prisma.availabilitySchedule.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        rules: {
          orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
        },
      },
    });

    return schedules.map(serializeSchedule);
  }

  async createSchedule(userId: string, dto: CreateAvailabilityScheduleDto) {
    const name = normalizeScheduleName(dto.name);
    const rules = normalizeRuleList(dto.rules ?? []);

    try {
      const schedule = await this.prisma.availabilitySchedule.create({
        data: {
          userId,
          name,
          rules: {
            createMany: {
              data: rules,
            },
          },
        },
        include: {
          rules: {
            orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
          },
        },
      });
      return serializeSchedule(schedule);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'You already have a schedule with that name',
        );
      }
      throw error;
    }
  }

  async updateSchedule(
    userId: string,
    id: string,
    dto: UpdateAvailabilityScheduleDto,
  ) {
    const existing = await this.prisma.availabilitySchedule.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Schedule not found');
    }

    const data: Prisma.AvailabilityScheduleUpdateInput = {};
    if (dto.name !== undefined) {
      data.name = normalizeScheduleName(dto.name);
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        if (Object.keys(data).length > 0) {
          await tx.availabilitySchedule.update({
            where: { id },
            data,
          });
        }

        if (dto.rules !== undefined) {
          const normalized = normalizeRuleList(dto.rules);
          await tx.availabilityScheduleRule.deleteMany({
            where: { scheduleId: id },
          });
          if (normalized.length > 0) {
            await tx.availabilityScheduleRule.createMany({
              data: normalized.map((rule) => ({ scheduleId: id, ...rule })),
            });
          }
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'You already have a schedule with that name',
        );
      }
      throw error;
    }

    const updated = await this.prisma.availabilitySchedule.findUnique({
      where: { id },
      include: {
        rules: {
          orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
        },
      },
    });

    return serializeSchedule(updated!);
  }

  async removeSchedule(userId: string, id: string) {
    const result = await this.prisma.availabilitySchedule.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Schedule not found');
    }

    return { success: true };
  }

  async applySchedule(userId: string, dto: ApplyAvailabilityScheduleDto) {
    const scheduleId = dto.scheduleId?.trim();
    if (!scheduleId) {
      throw new BadRequestException('scheduleId is required');
    }

    const schedule = await this.prisma.availabilitySchedule.findFirst({
      where: { id: scheduleId, userId },
      include: { rules: true },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const rules = schedule.rules.map((rule) => ({
      dayOfWeek: rule.dayOfWeek,
      startMinute: rule.startMinute,
      endMinute: rule.endMinute,
    }));

    if (dto.eventTypeId) {
      await this.assertOwnedEventType(userId, dto.eventTypeId);
      return this.replaceEventTypeAvailability(userId, dto.eventTypeId, {
        mode: 'CUSTOM',
        rules,
      });
    }

    return this.replaceRules(userId, { rules });
  }

  private async assertOwnedEventType(userId: string, eventTypeId: string) {
    const eventType = await this.prisma.eventType.findFirst({
      where: { id: eventTypeId, userId, deletedAt: null },
      select: { id: true },
    });

    if (!eventType) {
      throw new NotFoundException('Service not found');
    }
  }

  private async readEventTypeAvailability(
    eventTypeId: string,
    prisma: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const availability = await prisma.eventTypeAvailability.findUnique({
      where: { eventTypeId },
      include: {
        rules: {
          orderBy: [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }],
        },
      },
    });

    if (!availability) {
      return {
        eventTypeId,
        mode: EventTypeAvailabilityMode.HOST_DEFAULT,
        rules: [],
      };
    }

    return {
      eventTypeId,
      mode: availability.mode,
      rules: availability.rules,
    };
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

function normalizeRuleList(
  rules: Array<{
    dayOfWeek?: number;
    startMinute?: number;
    endMinute?: number;
  }>,
) {
  const normalized: NormalizedRule[] = rules.map((rule) => {
    const next = normalizeRule(rule, { requireAll: true });
    return {
      dayOfWeek: next.dayOfWeek!,
      startMinute: next.startMinute!,
      endMinute: next.endMinute!,
    };
  });

  const byDay = new Map<number, NormalizedRule[]>();
  for (const rule of normalized) {
    const list = byDay.get(rule.dayOfWeek) ?? [];
    list.push(rule);
    byDay.set(rule.dayOfWeek, list);
  }

  for (const list of byDay.values()) {
    list.sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < list.length; i++) {
      if (list[i].startMinute < list[i - 1].endMinute) {
        throw new BadRequestException(
          'Time ranges on the same day cannot overlap',
        );
      }
    }
  }

  return normalized;
}

function normalizeEventTypeAvailabilityMode(
  value: string | undefined,
): EventTypeAvailabilityMode {
  if (value === undefined) {
    return EventTypeAvailabilityMode.CUSTOM;
  }

  if (
    value !== EventTypeAvailabilityMode.HOST_DEFAULT &&
    value !== EventTypeAvailabilityMode.CUSTOM
  ) {
    throw new BadRequestException('Invalid service availability mode');
  }

  return value;
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

function normalizeBlocks(blocks: AvailabilityBlockDto[] | undefined) {
  if (!blocks || blocks.length === 0) {
    return [] as Array<{ startMinute: number; endMinute: number }>;
  }

  if (blocks.length > MAX_BLOCKS_PER_OVERRIDE) {
    throw new BadRequestException(
      `Override cannot have more than ${MAX_BLOCKS_PER_OVERRIDE} time blocks`,
    );
  }

  const normalized = blocks.map((block, index) => {
    const start = normalizeMinute(
      block.startMinute,
      `blocks[${index}].startMinute`,
      true,
    )!;
    const end = normalizeMinute(
      block.endMinute,
      `blocks[${index}].endMinute`,
      true,
    )!;

    if (start >= end) {
      throw new BadRequestException(
        `blocks[${index}].startMinute must be before endMinute`,
      );
    }

    return { startMinute: start, endMinute: end };
  });

  normalized.sort((a, b) => a.startMinute - b.startMinute);
  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i].startMinute < normalized[i - 1].endMinute) {
      throw new BadRequestException('Override time blocks cannot overlap');
    }
  }

  return normalized;
}

function parseDateOnly(value: string | undefined, field: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BadRequestException(`${field} must be in YYYY-MM-DD format`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(`${field} is not a valid calendar date`);
  }
  return date;
}

function startOfUtcToday() {
  const now = new Date();
  now.setUTCHours(0, 0, 0, 0);
  return now;
}

function normalizeScheduleName(value: string | undefined) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw new BadRequestException('name is required');
  }
  if (text.length > 60) {
    throw new BadRequestException('name must be 60 characters or less');
  }
  return text;
}

function serializeSchedule(schedule: {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  rules: Array<{
    id: string;
    scheduleId: string;
    dayOfWeek: number;
    startMinute: number;
    endMinute: number;
  }>;
}) {
  return {
    id: schedule.id,
    name: schedule.name,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
    rules: schedule.rules.map((rule) => ({
      id: rule.id,
      scheduleId: rule.scheduleId,
      dayOfWeek: rule.dayOfWeek,
      startMinute: rule.startMinute,
      endMinute: rule.endMinute,
    })),
  };
}

function clampInt(value: unknown, field: string, min: number, max: number) {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new BadRequestException(`${field} must be an integer`);
  }
  const n = value as number;
  if (n < min || n > max) {
    throw new BadRequestException(`${field} must be between ${min} and ${max}`);
  }
  return n;
}
