import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createReviewToken } from '../src/reviews/reviews.service';

jest.setTimeout(30_000);

describe('Bookvella MVP flow (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let agent: ReturnType<typeof request.agent>;

  const stamp = Date.now();
  const hostEmail = `e2e-host-${stamp}@bookvella.local`;
  const hostSlug = `e2e-host-${stamp}`;
  const guestEmail = `e2e-guest-${stamp}@bookvella.local`;
  const serviceSlug = 'intro-call';
  const hostTimezone = 'UTC';
  const targetDate = futureUtcDate(7);
  const dayRange = utcDayRange(targetDate);

  beforeAll(async () => {
    process.env.EMAIL_DEV_RETURN_CODE = 'true';
    process.env.EMAIL_CODE_SECRET = 'bookvella-e2e-code-secret';
    process.env.REVIEW_TOKEN_SECRET = 'bookvella-e2e-review-secret';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    agent = request.agent(app.getHttpServer());

    prisma = moduleFixture.get(PrismaService);
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await app.close();
  });

  it('runs the host setup, guest booking, cancellation, and review loop', async () => {
    const registerResponse = await agent
      .post('/auth/register')
      .send({
        email: hostEmail,
        password: 'password123',
        name: 'E2E Host',
        slug: hostSlug,
        timezone: hostTimezone,
      })
      .expect(201);

    expect(registerResponse.body.authenticated).toBe(true);
    expect(registerResponse.headers['set-cookie']).toBeDefined();

    await agent
      .patch('/auth/me')
      .send({
        headline: 'Reliable test bookings',
        businessCategory: 'Consulting',
        location: 'Online',
        about: 'A profile used by the MVP smoke test.',
        whatToExpect: 'A concise booking flow from slot to review.',
      })
      .expect(200);

    const serviceResponse = await agent
      .post('/event-types')
      .send({
        title: 'Intro Call',
        slug: serviceSlug,
        category: 'Consulting',
        description: 'A short introductory call.',
        whatIncluded: 'Goal review and next steps',
        locationDetails: 'Video call',
        durationMinutes: 30,
        bufferBeforeMinutes: 0,
        bufferAfterMinutes: 0,
        locationType: 'VIDEO',
      })
      .expect(201);

    expect(serviceResponse.body.slug).toBe(serviceSlug);

    await agent
      .post('/availability/rules')
      .send({
        dayOfWeek: targetDate.getUTCDay(),
        startMinute: 9 * 60,
        endMinute: 11 * 60,
      })
      .expect(201);

    const publicEventResponse = await agent
      .get(`/public/${hostSlug}/${serviceSlug}`)
      .expect(200);

    expect(publicEventResponse.body.host.slug).toBe(hostSlug);
    expect(publicEventResponse.body.eventType.slug).toBe(serviceSlug);

    const slotsResponse = await agent
      .get(`/public/${hostSlug}/${serviceSlug}/slots`)
      .query({
        start: dayRange.start.toISOString(),
        end: dayRange.end.toISOString(),
        timezone: hostTimezone,
      })
      .expect(200);

    expect(slotsResponse.body.length).toBeGreaterThan(0);
    const selectedSlot = slotsResponse.body[0];

    const invalidCodeResponse = await agent
      .post(`/public/${hostSlug}/${serviceSlug}/booking-codes`)
      .send({
        guestEmail,
        guestTimezone: hostTimezone,
        startTimeUtc: selectedSlot.startTimeUtc,
      })
      .expect(201);

    await agent
      .post(`/public/${hostSlug}/${serviceSlug}/bookings`)
      .send({
        guestName: 'E2E Guest',
        guestEmail,
        guestPhone: '+15550000000',
        guestNote: 'Please send a video link before the call.',
        guestTimezone: hostTimezone,
        startTimeUtc: selectedSlot.startTimeUtc,
        verificationId: invalidCodeResponse.body.verificationId,
        verificationCode: '000000',
      })
      .expect(400);

    const codeResponse = await agent
      .post(`/public/${hostSlug}/${serviceSlug}/booking-codes`)
      .send({
        guestEmail,
        guestTimezone: hostTimezone,
        startTimeUtc: selectedSlot.startTimeUtc,
      })
      .expect(201);

    expect(codeResponse.body.devCode).toMatch(/^\d{6}$/);

    const bookingResponse = await agent
      .post(`/public/${hostSlug}/${serviceSlug}/bookings`)
      .send({
        guestName: 'E2E Guest',
        guestEmail,
        guestPhone: '+15550000000',
        guestTimezone: hostTimezone,
        startTimeUtc: selectedSlot.startTimeUtc,
        verificationId: codeResponse.body.verificationId,
        verificationCode: codeResponse.body.devCode,
      })
      .expect(201);

    expect(bookingResponse.body.status).toBe('CONFIRMED');
    expect(bookingResponse.body.guestNote).toBe(
      'Please send a video link before the call.',
    );

    await agent
      .post(`/public/${hostSlug}/${serviceSlug}/booking-codes`)
      .send({
        guestEmail: `duplicate-${guestEmail}`,
        guestTimezone: hostTimezone,
        startTimeUtc: selectedSlot.startTimeUtc,
      })
      .expect(409);

    const hostBookingsResponse = await agent.get('/bookings').expect(200);

    expect(
      hostBookingsResponse.body.some(
        (booking: { id: string }) => booking.id === bookingResponse.body.id,
      ),
    ).toBe(true);

    await agent
      .patch(`/bookings/${bookingResponse.body.id}/cancel`)
      .send({ reason: 'E2E cleanup cancellation' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('CANCELLED');
      });

    const slotsAfterCancelResponse = await agent
      .get(`/public/${hostSlug}/${serviceSlug}/slots`)
      .query({
        start: dayRange.start.toISOString(),
        end: dayRange.end.toISOString(),
        timezone: hostTimezone,
      })
      .expect(200);

    expect(
      slotsAfterCancelResponse.body.some(
        (slot: { startTimeUtc: string }) =>
          slot.startTimeUtc === selectedSlot.startTimeUtc,
      ),
    ).toBe(true);

    const secondCodeResponse = await agent
      .post(`/public/${hostSlug}/${serviceSlug}/booking-codes`)
      .send({
        guestEmail,
        guestTimezone: hostTimezone,
        startTimeUtc: selectedSlot.startTimeUtc,
      })
      .expect(201);

    const reviewableBookingResponse = await agent
      .post(`/public/${hostSlug}/${serviceSlug}/bookings`)
      .send({
        guestName: 'E2E Guest',
        guestEmail,
        guestTimezone: hostTimezone,
        startTimeUtc: selectedSlot.startTimeUtc,
        verificationId: secondCodeResponse.body.verificationId,
        verificationCode: secondCodeResponse.body.devCode,
      })
      .expect(201);

    const reviewResponse = await agent
      .post('/public/reviews')
      .send({
        bookingId: reviewableBookingResponse.body.id,
        token: createReviewToken(reviewableBookingResponse.body.id),
        rating: 5,
        comment: 'Smooth booking flow.',
      })
      .expect(201);

    expect(reviewResponse.body.rating).toBe(5);

    const publicEventWithReviewResponse = await agent
      .get(`/public/${hostSlug}/${serviceSlug}`)
      .expect(200);

    expect(publicEventWithReviewResponse.body.reviewSummary.reviewCount).toBe(
      1,
    );

    const hiddenReviewResponse = await agent
      .patch(`/reviews/${reviewResponse.body.id}/visibility`)
      .send({ isVisible: false })
      .expect(200);

    expect(hiddenReviewResponse.body.isVisible).toBe(false);
  });

  async function cleanupTestData() {
    await prisma.otpVerification.deleteMany({
      where: {
        email: {
          in: [guestEmail, `duplicate-${guestEmail}`],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [{ email: hostEmail }, { slug: hostSlug }],
      },
    });
  }
});

function futureUtcDate(daysFromNow: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  date.setUTCHours(12, 0, 0, 0);
  return date;
}

function utcDayRange(date: Date) {
  const start = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
