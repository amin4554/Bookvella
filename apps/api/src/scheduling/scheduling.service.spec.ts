import { PrismaService } from '../prisma/prisma.service';
import { SchedulingService } from './scheduling.service';

describe('SchedulingService', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-24T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('steps slots by session duration and removes buffered booking conflicts', async () => {
    // Session is 30 min with a 15-min buffer after.
    // Window: Mon 09:00–11:00 Berlin (07:00–09:00 UTC, Berlin = UTC+2 in May).
    // Existing booking: 08:30–09:00 UTC with 15-min buffer after → busy 08:30–09:15 UTC.
    //
    // Slots generated at 30-min steps (= durationMinutes):
    //   07:00–07:30 UTC → candidateBusy 07:00–07:45 → no conflict  → AVAILABLE (09:00 Berlin)
    //   07:30–08:00 UTC → candidateBusy 07:30–08:15 → no conflict  → AVAILABLE (09:30 Berlin)
    //   08:00–08:30 UTC → candidateBusy 08:00–08:45 → overlaps     → blocked
    //   08:30–09:00 UTC → candidateBusy 08:30–09:15 → overlaps     → blocked
    const prisma = {
      eventType: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'event-1',
          userId: 'user-1',
          slug: 'intro',
          title: 'Intro Call',
          description: null,
          durationMinutes: 30,
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 15,
          locationType: 'VIDEO',
          isActive: true,
          user: {
            id: 'user-1',
            name: 'Host',
            slug: 'host',
            timezone: 'Europe/Berlin',
            availabilityRules: [
              {
                id: 'rule-1',
                userId: 'user-1',
                dayOfWeek: 1,
                startMinute: 540, // 09:00
                endMinute: 660,   // 11:00
              },
            ],
            availabilityOverrides: [], // no blackout dates
          },
        }),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'booking-1',
            startTimeUtc: new Date('2026-05-25T08:30:00.000Z'),
            endTimeUtc: new Date('2026-05-25T09:00:00.000Z'),
            eventType: {
              bufferBeforeMinutes: 0,
              bufferAfterMinutes: 15,
            },
          },
        ]),
      },
      availabilityOverride: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new SchedulingService(prisma as unknown as PrismaService);

    const slots = await service.getAvailableSlots({
      hostSlug: 'host',
      eventSlug: 'intro',
      start: '2026-05-25T00:00:00.000Z',
      end: '2026-05-26T00:00:00.000Z',
      guestTimezone: 'Europe/Berlin',
    });

    // Two 30-min slots are available before the booking's busy window.
    expect(slots.map((slot) => slot.startTimeGuest)).toEqual([
      '2026-05-25T09:00:00',
      '2026-05-25T09:30:00',
    ]);
    expect(slots.map((slot) => slot.startTimeUtc)).toEqual([
      '2026-05-25T07:00:00.000Z',
      '2026-05-25T07:30:00.000Z',
    ]);
  });

  it('skips a fully blackout-blocked date', async () => {
    const prisma = {
      eventType: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'event-2',
          userId: 'user-1',
          slug: 'intro',
          title: 'Intro Call',
          description: null,
          durationMinutes: 60,
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
          locationType: 'VIDEO',
          isActive: true,
          user: {
            id: 'user-1',
            name: 'Host',
            slug: 'host',
            timezone: 'UTC',
            availabilityRules: [
              {
                id: 'rule-2',
                userId: 'user-1',
                dayOfWeek: 1, // Monday
                startMinute: 540,
                endMinute: 660,
              },
            ],
          },
        }),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      // 2026-05-25 is a Monday; block it entirely
      availabilityOverride: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'override-1',
            userId: 'user-1',
            eventTypeId: null,
            date: new Date('2026-05-25T00:00:00.000Z'),
            type: 'BLOCKED',
            isBlocked: true,
            blocks: null,
          },
        ]),
      },
    };
    const service = new SchedulingService(prisma as unknown as PrismaService);

    const slots = await service.getAvailableSlots({
      hostSlug: 'host',
      eventSlug: 'intro',
      start: '2026-05-25T00:00:00.000Z',
      end: '2026-05-26T00:00:00.000Z',
      guestTimezone: 'UTC',
    });

    expect(slots).toHaveLength(0);
  });

  it('uses custom service availability instead of the host default', async () => {
    const prisma = {
      eventType: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'event-3',
          userId: 'user-1',
          slug: 'consult',
          title: 'Consultation',
          description: null,
          durationMinutes: 60,
          bufferBeforeMinutes: 0,
          bufferAfterMinutes: 0,
          locationType: 'VIDEO',
          isActive: true,
          availability: {
            id: 'event-availability-1',
            eventTypeId: 'event-3',
            mode: 'CUSTOM',
            rules: [
              {
                id: 'event-rule-1',
                availabilityId: 'event-availability-1',
                dayOfWeek: 2, // Tuesday
                startMinute: 13 * 60,
                endMinute: 15 * 60,
              },
            ],
          },
          user: {
            id: 'user-1',
            name: 'Host',
            slug: 'host',
            timezone: 'UTC',
            availabilityRules: [
              {
                id: 'host-rule-1',
                userId: 'user-1',
                dayOfWeek: 1, // Monday
                startMinute: 9 * 60,
                endMinute: 17 * 60,
              },
            ],
            availabilityOverrides: [],
          },
        }),
      },
      booking: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      availabilityOverride: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new SchedulingService(prisma as unknown as PrismaService);

    const slots = await service.getAvailableSlots({
      hostSlug: 'host',
      eventSlug: 'consult',
      start: '2026-06-01T00:00:00.000Z',
      end: '2026-06-03T00:00:00.000Z',
      guestTimezone: 'UTC',
    });

    expect(slots.map((slot) => slot.startTimeUtc)).toEqual([
      '2026-06-02T13:00:00.000Z',
      '2026-06-02T14:00:00.000Z',
    ]);
  });
});
