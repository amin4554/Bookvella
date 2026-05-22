# Bookvella

Bookvella is a booking platform for independent service providers. A host creates a public profile, adds bookable services, sets a weekly booking schedule, and shares a public booking link. Guests choose a slot, verify their email with a code, and confirm the booking.

## Apps

- `apps/api`: NestJS API, Prisma, PostgreSQL, auth, scheduling, bookings, emails, reviews, and health checks.
- `apps/web`: Next.js web app for host dashboard, public booking pages, login, registration, and profile management.
- `deploy`: Nginx and Jenkins deployment support.
- `designs`: Product and UI design references.

## Core MVP Flow

1. Host registers or logs in.
2. Host edits their public profile.
3. Host creates one or more services.
4. Host sets bookable weekly hours.
5. Guest opens a public service link.
6. Guest chooses an available slot.
7. Guest receives and enters an email verification code.
8. Booking is confirmed and visible in the host dashboard.
9. Host can cancel bookings.
10. Guest can submit a review through the post-booking review link.

## Local Setup

Start PostgreSQL from the repository root:

```bat
docker compose up -d
```

Prepare the API:

```bat
cd apps\api
copy .env.example .env
pnpm install
pnpm prisma generate
pnpm prisma migrate dev
pnpm run db:seed
pnpm run start:dev
```

The API runs at:

```txt
http://localhost:3000
```

Prepare the web app in another terminal:

```bat
cd apps\web
copy .env.example .env.local
npm install
npm run dev
```

The web app runs at:

```txt
http://localhost:3001
```

## Demo Account

After seeding the API:

```txt
Email: demo@bookvella.local
Password: bookvella-demo-123
Public booking page: http://localhost:3001/marcus/fresh-cut
```

## Useful Checks

API:

```bat
cd apps\api
pnpm run build
pnpm run test
pnpm run test:e2e
```

Run `docker compose up -d db` and apply migrations before `pnpm run test:e2e`.

Web:

```bat
cd apps\web
npm run build
```

## Production

Production deployment is documented in [DEPLOY.md](DEPLOY.md). The current production shape is:

```txt
Internet -> Nginx -> Next.js web
                  -> NestJS API
Jenkins -> Docker Compose -> PostgreSQL, API, web, nginx, certbot
```

Important production checks after deployment:

- `https://bookvella.com` loads the web app.
- `https://api.bookvella.com/health/live` returns success.
- `https://api.bookvella.com/health/ready` confirms database readiness.
- A real booking flow works from host setup to guest confirmation email.

## Planning

The current post-deployment plan lives in [Post-Deployment-MVP-Plan.md](Post-Deployment-MVP-Plan.md).
