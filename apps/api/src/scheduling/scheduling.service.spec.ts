import { PrismaService } from '../prisma/prisma.service';
import { SchedulingService } from './scheduling.service';

describe('SchedulingService', () => {
  it('returns timezone-aware slots and removes buffered booking conflicts', async () => {
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
                startMinute: 540,
                endMinute: 660,
              },
            ],
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
    };
    const service = new SchedulingService(prisma as unknown as PrismaService);

    const slots = await service.getAvailableSlots({
      hostSlug: 'host',
      eventSlug: 'intro',
      start: '2026-05-25T00:00:00.000Z',
      end: '2026-05-26T00:00:00.000Z',
      guestTimezone: 'Europe/Berlin',
    });

    expect(slots.map((slot) => slot.startTimeGuest)).toEqual([
      '2026-05-25T09:00:00',
      '2026-05-25T09:15:00',
      '2026-05-25T09:30:00',
      '2026-05-25T09:45:00',
    ]);
    expect(slots.map((slot) => slot.startTimeUtc)).toEqual([
      '2026-05-25T07:00:00.000Z',
      '2026-05-25T07:15:00.000Z',
      '2026-05-25T07:30:00.000Z',
      '2026-05-25T07:45:00.000Z',
    ]);
  });
});
