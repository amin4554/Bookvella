import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  assertRuntimeConfig,
  createRateLimitMiddleware,
  csrfOriginGuard,
  getCorsOrigins,
  getPort,
  securityHeaders,
} from './config/runtime';

type ExpressInstance = {
  set: (setting: string, value: unknown) => void;
};

async function bootstrap() {
  assertRuntimeConfig();
  const app = await NestFactory.create(AppModule);
  const express = app.getHttpAdapter().getInstance() as ExpressInstance;

  express.set('trust proxy', 1);
  app.enableShutdownHooks();
  app.use(securityHeaders);
  app.use(csrfOriginGuard);
  app.use(
    createRateLimitMiddleware({
      windowMs: 15 * 60 * 1000,
      max: 300,
      methods: ['POST', 'PATCH', 'DELETE'],
    }),
  );
  app.use(
    createRateLimitMiddleware({
      windowMs: 15 * 60 * 1000,
      max: 5,
      paths: [
        '/auth/register/otp/request',
        '/auth/password/change/otp/request',
        '/auth/email/change/otp/request',
        '/auth/email/confirm/resend',
      ],
      pathPatterns: [/^\/public\/[^/]+\/[^/]+\/booking-codes$/],
    }),
  );
  app.use(
    createRateLimitMiddleware({
      windowMs: 15 * 60 * 1000,
      max: 10,
      paths: [
        '/auth/register/otp/verify',
        '/auth/password/change/otp/verify',
        '/auth/email/change',
        '/auth/email/confirm',
      ],
      pathPatterns: [/^\/public\/[^/]+\/[^/]+\/bookings$/],
    }),
  );
  app.use(
    createRateLimitMiddleware({
      windowMs: 15 * 60 * 1000,
      max: 20,
      paths: [
        '/auth/login',
        '/auth/refresh',
        '/auth/google',
        '/auth/password/forgot',
        '/auth/password/reset',
        '/auth/password/change',
        '/contact/report',
        '/auth/totp/enroll',
        '/auth/totp/verify',
        '/auth/totp/disable',
        '/auth/me/delete',
        '/auth/me/delete/confirm',
      ],
      pathPatterns: [
        /^\/public\/[^/]+\/[^/]+\/booking-codes$/,
        /^\/public\/[^/]+\/[^/]+\/bookings$/,
        /^\/public\/bookings\/guest-(cancel|reschedule)\/[^/]+$/,
        /^\/public\/reviews$/,
      ],
    }),
  );
  app.use(
    createRateLimitMiddleware({
      windowMs: 15 * 60 * 1000,
      max: 60,
      paths: ['/uploads/images'],
      pathPatterns: [/^\/auth\/(google|outlook)\/calendar$/],
    }),
  );
  app.use(
    createRateLimitMiddleware({
      windowMs: 15 * 60 * 1000,
      max: 600,
      methods: ['GET'],
      pathPatterns: [
        /^\/public\/slug-availability$/,
        /^\/public\/host\/[^/]+$/,
        /^\/public\/[^/]+\/[^/]+$/,
        /^\/public\/[^/]+\/[^/]+\/slots$/,
        /^\/public\/feeds\/[^/]+$/,
      ],
    }),
  );
  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = getPort();
  await app.listen(port);
  console.log(`Bookvella API listening on port ${port}`);
}
void bootstrap();
