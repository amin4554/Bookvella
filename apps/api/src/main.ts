import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  assertRuntimeConfig,
  createRateLimitMiddleware,
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
  app.use(
    createRateLimitMiddleware({
      windowMs: 15 * 60 * 1000,
      max: 20,
      paths: [
        '/auth/login',
        '/auth/register',
        '/auth/refresh',
        '/auth/google',
        '/booking-codes',
        '/public/reviews',
      ],
    }),
  );
  app.enableCors({
    origin: getCorsOrigins(),
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const port = getPort();
  await app.listen(port);
  console.log(`Bookvella API listening on port ${port}`);
}
void bootstrap();
