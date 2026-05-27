# Bookvella API

This is the NestJS API for Bookvella.

## What It Contains

- Email/password auth.
- Refresh-token sessions and logout.
- Google sign-in/sign-up endpoint.
- Host profile management.
- Service/event type CRUD.
- Authenticated image uploads for profile, cover, and service pictures.
- Weekly availability rules.
- Public event lookup and slot generation.
- Email-code booking flow.
- Host booking list and cancellation.
- Branded booking and cancellation emails.
- Guest review submission and host review visibility controls.
- Health checks for deployment.

## Environment

Create `apps/api/.env` from `apps/api/.env.example`:

```bat
copy .env.example .env
```

Typical local database URL:

```txt
DATABASE_URL="postgresql://bookvella:bookvella_dev@localhost:5433/bookvella?schema=public"
```

Google sign-in is optional locally. To enable it, set:

```txt
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
```

## Development

Start PostgreSQL from the repository root:

```bat
docker compose up -d
```

Install and prepare the API:

```bat
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm run db:seed
pnpm run start:dev
```

The API runs on:

```txt
http://localhost:3000
```

## Useful Scripts

```bat
pnpm run build
pnpm run test
pnpm run test:e2e
pnpm run db:seed
pnpm prisma generate
pnpm prisma migrate dev
pnpm prisma migrate deploy
```

## E2E Smoke Test

The E2E suite exercises the MVP booking loop: host registration, service setup, schedule setup, slot lookup, email-code booking, duplicate-slot rejection, cancellation, review submission, and review visibility.

Before running it locally, make sure PostgreSQL is running and migrations are applied:

```bat
cd ..\..
docker compose up -d db
cd apps\api
pnpm prisma migrate dev
pnpm run test:e2e
```

The test sets `EMAIL_DEV_RETURN_CODE=true` internally so it can read the verification code from the API response instead of depending on a real inbox.

## Health Checks

```txt
GET /health
GET /health/live
GET /health/ready
```

## Main Route Groups

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/google`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `PATCH /auth/me`
- `GET /event-types`
- `POST /event-types`
- `PATCH /event-types/:id`
- `DELETE /event-types/:id`
- `GET /availability/rules`
- `POST /availability/rules`
- `PATCH /availability/rules/:id`
- `DELETE /availability/rules/:id`
- `GET /public/:hostSlug/:eventSlug`
- `GET /public/:hostSlug/:eventSlug/slots`
- `POST /public/:hostSlug/:eventSlug/booking-codes`
- `POST /public/:hostSlug/:eventSlug/bookings`
- `GET /bookings`
- `PATCH /bookings/:id/cancel`
- `POST /public/reviews`
- `GET /reviews`
- `PATCH /reviews/:id/visibility`
- `POST /uploads/images`
- `GET /uploads/images/:fileName`

## Prisma

This project currently uses Prisma 6. Prisma Client must be regenerated after schema changes:

```bat
pnpm prisma generate
```

Prisma 7 has been reviewed and is intentionally deferred until after MVP stabilization because it is not only a version bump. It introduces ESM-oriented setup, a required generated-client output path, Prisma config changes, and PostgreSQL driver adapters.

## Auth Cookies

Browser auth uses httpOnly cookies:

- `bookvella.access`: short-lived access token.
- `bookvella.refresh`: refresh token.
- `bookvella.session`: non-sensitive session marker used by the web proxy for early dashboard redirects.

The API still accepts `Authorization: Bearer ...` as a compatibility fallback for tooling, but the web app does not store or send bearer tokens after login.

Production should set:

```txt
AUTH_COOKIE_DOMAIN=api.bookvella.com
SESSION_COOKIE_DOMAIN=.bookvella.com
AUTH_COOKIE_LEGACY_DOMAIN=.bookvella.com
AUTH_COOKIE_SECURE=true
```

`AUTH_COOKIE_DOMAIN` scopes the httpOnly access/refresh cookies to the API
host. `SESSION_COOKIE_DOMAIN` keeps the low-trust dashboard marker visible to
the web app. `AUTH_COOKIE_LEGACY_DOMAIN` is optional and expires older shared
auth cookies during the migration.

Local development can leave the cookie domain variables empty and
`AUTH_COOKIE_SECURE=false`.

## Uploads

Hosts upload profile, cover, and service images through:

```txt
POST /uploads/images
```

The endpoint accepts authenticated multipart form data with a `file` field. JPG, PNG, WEBP, and GIF files up to 5 MB are accepted. Uploaded files are served from:

```txt
GET /uploads/images/:fileName
```

Production stores uploads in the `api_uploads` Docker volume mounted at `/app/uploads`.

## Production

The production Dockerfile runs:

```txt
pnpm prisma generate
pnpm run build
pnpm run test -- --runInBand
prisma migrate deploy
node dist/src/main.js
```

Deployment details are in the repository-level `DEPLOY.md`.
