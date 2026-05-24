import '../src/config/load-env';
import { BookingStatus, LocationType, PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/auth/password';

const prisma = new PrismaClient();

const demoEmail = 'demo@bookvella.local';
const demoSlug = 'marcus';
const demoPassword = 'bookvella-demo-123';

async function main() {
  await prisma.user.deleteMany({
    where: {
      OR: [{ email: demoEmail }, { slug: demoSlug }],
    },
  });

  const passwordHash = hashPassword(demoPassword);
  const host = await prisma.user.create({
    data: {
      email: demoEmail,
      passwordHash,
      passwordSetAt: new Date(),
      name: 'Marcus Williams',
      slug: demoSlug,
      timezone: 'America/New_York',
      headline: 'Precision cuts in Shoreditch, London',
      businessCategory: 'Barbering',
      location: 'Shoreditch, London',
      about:
        '10 years of experience delivering precision cuts and fades in the heart of Shoreditch.',
      whatToExpect:
        'A relaxed, clean studio. Bring reference photos if you have them.',
      availabilityRules: {
        create: [
          weekdayAvailability(1, 9, 17),
          weekdayAvailability(2, 9, 17),
          weekdayAvailability(3, 10, 18),
          weekdayAvailability(4, 9, 17),
          weekdayAvailability(5, 9, 15),
        ],
      },
      eventTypes: {
        create: [
          {
            title: 'Fresh Cut Session',
            slug: 'fresh-cut',
            category: 'Barbering',
            description: 'A full haircut consultation, cut, and finish.',
            whatIncluded: 'Precision cut, styling, and finish',
            locationDetails: 'Shoreditch Studio',
            durationMinutes: 45,
            bufferBeforeMinutes: 5,
            bufferAfterMinutes: 10,
            locationType: LocationType.IN_PERSON,
          },
          {
            title: 'Beard Trim & Shape',
            slug: 'beard-trim',
            category: 'Barbering',
            description: 'A precise beard trim with shape-up and cleanup.',
            whatIncluded: 'Trim, shaping, and cleanup',
            locationDetails: 'Shoreditch Studio',
            durationMinutes: 30,
            bufferBeforeMinutes: 0,
            bufferAfterMinutes: 10,
            locationType: LocationType.IN_PERSON,
          },
          {
            title: 'Quick Consultation',
            slug: 'consultation',
            category: 'Consultation',
            description: 'A short video call before a first appointment.',
            whatIncluded: 'Style planning and appointment guidance',
            locationDetails: 'Video call',
            durationMinutes: 20,
            bufferBeforeMinutes: 0,
            bufferAfterMinutes: 5,
            locationType: LocationType.VIDEO,
          },
        ],
      },
    },
    include: {
      eventTypes: true,
    },
  });

  const freshCut = requireEvent(host.eventTypes, 'fresh-cut');
  const beardTrim = requireEvent(host.eventTypes, 'beard-trim');
  const consultation = requireEvent(host.eventTypes, 'consultation');

  await prisma.booking.createMany({
    data: [
      {
        eventTypeId: freshCut.id,
        hostUserId: host.id,
        guestName: 'Avery Carter',
        guestEmail: 'avery@example.com',
        guestPhone: '+1 555 0101',
        guestTimezone: 'America/New_York',
        startTimeUtc: futureUtcDate(2, 15, 0),
        endTimeUtc: futureUtcDate(2, 15, 45),
        status: BookingStatus.CONFIRMED,
      },
      {
        eventTypeId: beardTrim.id,
        hostUserId: host.id,
        guestName: 'Jordan Lee',
        guestEmail: 'jordan@example.com',
        guestPhone: '+1 555 0102',
        guestTimezone: 'America/New_York',
        startTimeUtc: futureUtcDate(4, 16, 30),
        endTimeUtc: futureUtcDate(4, 17, 0),
        status: BookingStatus.CONFIRMED,
      },
      {
        eventTypeId: consultation.id,
        hostUserId: host.id,
        guestName: 'Sam Rivera',
        guestEmail: 'sam@example.com',
        guestTimezone: 'America/Chicago',
        startTimeUtc: futureUtcDate(6, 14, 0),
        endTimeUtc: futureUtcDate(6, 14, 20),
        status: BookingStatus.CANCELLED,
        cancellationReason: 'Guest requested a later week.',
      },
    ],
  });

  console.log(
    JSON.stringify(
      {
        seeded: true,
        email: demoEmail,
        password: demoPassword,
        hostSlug: demoSlug,
        publicBookingPath: `/book/${demoSlug}/fresh-cut`,
      },
      null,
      2,
    ),
  );
}

function weekdayAvailability(
  dayOfWeek: number,
  startHour: number,
  endHour: number,
) {
  return {
    dayOfWeek,
    startMinute: startHour * 60,
    endMinute: endHour * 60,
  };
}

function requireEvent(
  eventTypes: { id: string; slug: string }[],
  slug: string,
) {
  const eventType = eventTypes.find((event) => event.slug === slug);

  if (!eventType) {
    throw new Error(`Missing seeded event type: ${slug}`);
  }

  return eventType;
}

function futureUtcDate(daysFromToday: number, hour: number, minute: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromToday);
  date.setUTCHours(hour, minute, 0, 0);
  return date;
}

void main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
