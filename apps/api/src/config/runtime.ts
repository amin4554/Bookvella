import type { Request, Response, NextFunction } from 'express';

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const DEFAULT_DEV_ORIGIN = 'http://localhost:3001';

export function getPort() {
  const value = Number(process.env.PORT ?? 3000);

  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new Error('PORT must be a valid TCP port');
  }

  return value;
}

export function getCorsOrigins() {
  const configured = process.env.CORS_ORIGIN ?? process.env.CORS_ORIGINS;

  if (!configured) {
    return [DEFAULT_DEV_ORIGIN];
  }

  const origins = configured
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProduction() && origins.some((origin) => origin === '*')) {
    throw new Error('Production CORS origins cannot include wildcard *');
  }

  return origins;
}

export function assertRuntimeConfig() {
  const missing = requiredVariables().filter(
    (key) => !process.env[key]?.trim(),
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  if (isProduction() && !process.env.JWT_PRIVATE_KEY?.includes('BEGIN')) {
    throw new Error(
      'JWT_PRIVATE_KEY must be a PEM encoded private key in production',
    );
  }

  if (isProduction() && !process.env.JWT_PUBLIC_KEY?.includes('BEGIN')) {
    throw new Error(
      'JWT_PUBLIC_KEY must be a PEM encoded public key in production',
    );
  }
}

export function securityHeaders(
  _request: Request,
  response: Response,
  next: NextFunction,
) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  response.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  next();
}

export function createRateLimitMiddleware(options: {
  windowMs: number;
  max: number;
  paths: string[];
}) {
  const buckets = new Map<string, RateLimitBucket>();

  return (request: Request, response: Response, next: NextFunction) => {
    if (!options.paths.some((path) => request.path.endsWith(path))) {
      next();
      return;
    }

    const now = Date.now();
    const key = `${request.ip}:${request.method}:${request.path}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    bucket.count += 1;

    if (bucket.count > options.max) {
      response.setHeader(
        'Retry-After',
        Math.ceil((bucket.resetAt - now) / 1000),
      );
      response.status(429).json({
        statusCode: 429,
        message: 'Too many requests. Please try again shortly.',
        error: 'Too Many Requests',
      });
      return;
    }

    next();
  };
}

function requiredVariables() {
  if (!isProduction()) {
    return ['DATABASE_URL'];
  }

  return [
    'DATABASE_URL',
    'JWT_PRIVATE_KEY',
    'JWT_PUBLIC_KEY',
    'EMAIL_CODE_SECRET',
    'REVIEW_TOKEN_SECRET',
    'APP_URL',
    'GOOGLE_CLIENT_ID',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASSWORD',
    'SMTP_FROM',
  ];
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}
