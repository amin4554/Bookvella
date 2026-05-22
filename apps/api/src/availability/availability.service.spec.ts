import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

function makePrisma() {
  return {
    availabilityRule: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
}

// ─── create (synchronous validation before the DB call) ───────────────────────

describe('AvailabilityService – create validation', () => {
  let service: AvailabilityService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AvailabilityService(prisma as any);
  });

  it('throws when startMinute is after endMinute', () => {
    expect(() =>
      service.create('user-1', { dayOfWeek: 1, startMinute: 600, endMinute: 540 }),
    ).toThrow(BadRequestException);
  });

  it('throws when startMinute equals endMinute', () => {
    expect(() =>
      service.create('user-1', { dayOfWeek: 1, startMinute: 540, endMinute: 540 }),
    ).toThrow(BadRequestException);
  });

  it('throws on dayOfWeek = 7 (out of 0–6 range)', () => {
    expect(() =>
      service.create('user-1', { dayOfWeek: 7, startMinute: 540, endMinute: 600 }),
    ).toThrow(BadRequestException);
  });

  it('throws on negative dayOfWeek', () => {
    expect(() =>
      service.create('user-1', { dayOfWeek: -1, startMinute: 540, endMinute: 600 }),
    ).toThrow(BadRequestException);
  });

  it('throws when endMinute exceeds 1440 (minutes per day)', () => {
    expect(() =>
      service.create('user-1', { dayOfWeek: 1, startMinute: 0, endMinute: 1441 }),
    ).toThrow(BadRequestException);
  });

  it('accepts 1440 as a valid endMinute (end of day)', () => {
    const rule = { id: 'r-1', userId: 'user-1', dayOfWeek: 1, startMinute: 0, endMinute: 1440 };
    prisma.availabilityRule.create.mockResolvedValue(rule);

    // Does NOT throw — returns the prisma promise
    expect(() =>
      service.create('user-1', { dayOfWeek: 1, startMinute: 0, endMinute: 1440 }),
    ).not.toThrow();
  });

  it('accepts a valid rule and delegates to prisma', async () => {
    const rule = { id: 'r-1', userId: 'user-1', dayOfWeek: 1, startMinute: 540, endMinute: 600 };
    prisma.availabilityRule.create.mockResolvedValue(rule);

    const result = await service.create('user-1', {
      dayOfWeek: 1,
      startMinute: 540,
      endMinute: 600,
    });

    expect(result).toEqual(rule);
    expect(prisma.availabilityRule.create).toHaveBeenCalledTimes(1);
  });
});

// ─── update (async, validation runs after the findFirst) ──────────────────────

describe('AvailabilityService – update', () => {
  let service: AvailabilityService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AvailabilityService(prisma as any);
  });

  it('throws NotFoundException when the rule does not belong to the user', async () => {
    prisma.availabilityRule.findFirst.mockResolvedValue(null);

    await expect(
      service.update('user-1', 'rule-x', { endMinute: 660 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a partial update that would produce an invalid window', async () => {
    prisma.availabilityRule.findFirst.mockResolvedValue({
      id: 'rule-1',
      userId: 'user-1',
      dayOfWeek: 1,
      startMinute: 600,   // existing start
      endMinute: 660,
    });

    // Trying to push endMinute to 599 — now start (600) >= end (599)
    await expect(
      service.update('user-1', 'rule-1', { endMinute: 599 }),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── remove ───────────────────────────────────────────────────────────────────

describe('AvailabilityService – remove', () => {
  let service: AvailabilityService;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    prisma = makePrisma();
    service = new AvailabilityService(prisma as any);
  });

  it('throws NotFoundException when no rule was deleted', async () => {
    prisma.availabilityRule.deleteMany.mockResolvedValue({ count: 0 });

    await expect(service.remove('user-1', 'nonexistent')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns { success: true } when the rule is deleted', async () => {
    prisma.availabilityRule.deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.remove('user-1', 'rule-1');

    expect(result).toEqual({ success: true });
  });
});
