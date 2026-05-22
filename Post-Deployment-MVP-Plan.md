# Bookvella Post-Deployment MVP Plan

Last reviewed: May 22, 2026 (updated — session 3 improvements)

## Executive Summary

Bookvella is now close to the MVP described in `MVP-Next-Steps-and-Design-Brief.md`. The core product loop exists: hosts can register, manage services, set weekly booking hours, share a public booking page, receive bookings with email-code verification, view/cancel bookings, edit their public profile, and collect/display reviews.

The next phase should focus on launch confidence, not feature sprawl. The most urgent work is to keep the deployed pipeline healthy, replace starter documentation, and add smoke/E2E coverage for the full booking flow.

Update after deployment review:

- Production and Jenkins builds were reported working.
- Prisma 7 was reviewed against the official upgrade guide and is intentionally deferred until after MVP stabilization.
- Starter API and web READMEs were replaced, and a root README was added.
- Priority 1 work started: MVP API E2E smoke coverage was added, API unit tests now run during the Docker API build, Jenkins now builds from the checked-out workspace commit, and deployment rollback notes were added.
- Auth/security work continued: browser auth now uses httpOnly API cookies instead of storing access/refresh tokens in `localStorage`; dashboard routes are gated by a Next.js proxy session marker; `AppShell` verifies `/auth/me` before rendering dashboard content; refresh failure clears local session state; login shows a session-expired message; login/register redirect already-authenticated hosts back to the intended dashboard path.
- Priority 2 public booking/profile work continued: guest notes are now persisted, included in host confirmation email, and shown on host bookings; OTP now supports resend and change-email actions; booking success now has an add-to-calendar link; the mobile stepper is visible; the settings preview uses real visible reviews instead of fake review counts; public URL editing moved into an advanced section.
- Profile and service image uploads were added: hosts can upload profile, cover, and optional service images instead of pasting image URLs; uploaded images are served by the API and persisted in the production `api_uploads` volume.
- Pipeline stability restored after builds #12 and #13: Build #12's `@prisma/engines` failure (pnpm strict-isolation removes transitive devDep trees after `pnpm prune --prod`) was fixed by moving `prisma` to `dependencies` and stripping all manual rescue logic from the Dockerfile (57 → 33 lines); Build #13's `UnknownDependenciesException` was fixed by adding the missing `AuthModule` import to `MediaModule`.
- `.env` naming simplified end-to-end: `.env.production` renamed to `.env` across `Jenkinsfile`, `docker-compose.prod.yml`, `.dockerignore`, and the root example file (`.env.example`), eliminating the two-name confusion.
- Codebase audit and four bug fixes: PrismaService now eagerly establishes the connection pool on startup via `OnModuleInit.$connect()`; review summary stats now use `prisma.review.aggregate()` across all visible reviews instead of only the first 8 loaded for display; email bodies now normalize line endings to CRLF per RFC 2822 and both MIME parts in multipart messages carry `Content-Transfer-Encoding: 7bit`; the rate-limiter `Map` now runs a recurring cleanup timer (`.unref()`) to evict expired entries and prevent unbounded memory growth.
- Service/booking/dashboard improvements: inactive services can now be reactivated directly from the services list; the bookings page has a live guest name/email search, an expandable detail row (phone, note, timezone, location, cancellation reason), an improved upcoming empty state with a copy-booking-link action; the booking success screen now offers both a Google Calendar link and a downloadable `.ics` file; the dashboard greeting is now time-appropriate (good morning/afternoon/evening); a setup banner guides new hosts who have no services or no availability schedule set; the booking list API now also returns `locationDetails` from the event type alongside `locationType`.
- Availability schedule, slot intelligence, and image crop: the availability page was fully rewritten as a Google Calendar-style drag-to-select weekly grid (Mon–Sun columns, 6 am–10 pm in 30-minute rows) with preset buttons and rounded visual blocks for continuous ranges; the backend slot generator now steps by session duration instead of a fixed 15-minute increment, and the public booking date picker only shows dates that actually have available slots (21-day range fetched upfront, grouped by guest timezone date); the settings page profile and cover image upload fields now open a canvas-based crop modal — circle crop for the profile photo (400 × 400 output), 2:1 rect crop for the cover image (800 × 400 output) — with drag-to-reposition, a zoom slider, and a "Replace" button once an image is set.

## Current State Snapshot

### Backend

Implemented:

- Auth registration, login, refresh, logout, Google auth route, `/auth/me`, and editable `/auth/me`.
- Host profile fields: uploaded profile/cover images, headline, category, location, about, what-to-expect, website, Instagram, timezone, and public handle.
- Service/event type CRUD with richer service metadata.
- Weekly availability rules.
- Public event lookup and slot generation.
- Email-code booking confirmation flow.
- Host booking list and host booking cancellation.
- Guest and host confirmation/cancellation emails with branded HTML and plain-text fallbacks.
- Review model, guest review submission through signed booking links, host review listing, and review visibility toggles.
- Health endpoints: `/health`, `/health/live`, `/health/ready`.
- Production runtime validation, security headers, basic in-memory rate limiting, graceful shutdown, Docker production build, Jenkins pipeline, and deployment guide.

Needs attention:

- Production runtime still needs explicit post-deploy smoke testing on the VPS.
- In-memory rate limiter is sufficient for a single instance; distributed rate limiting (e.g. Redis) is still needed if the API scales to multiple instances.
- Logging/error visibility is still minimal.
- The scheduling model is still weekly rules only.

### Frontend

Implemented:

- Landing page, login, registration, host dashboard, services, booking schedule, bookings, public profile/settings page, and public booking flow.
- Dashboard route gating with a Next.js proxy session marker plus server-verified app-shell auth.
- Refresh-token retry inside `authedApiRequest`.
- Logout calls the API and clears local session state.
- Google sign-in button integration when env vars are present.
- Redesigned public booking flow with provider summary, service details, reviews, slots, guest details, email code, and success state.
- Mobile bottom navigation for the main dashboard sections.
- Profile page with live preview and review visibility management.
- Profile, cover, and optional service image uploads through authenticated API upload endpoints.
- Web production build passes locally.

Needs attention:

- Several loading/error states are present but still generic.
- Registration still exposes public URL fields more directly than the brief recommends.
- Public booking still needs production browser smoke testing after the guest-note and image-upload migrations deploy.
- Uploaded images are stored on the API filesystem volume, not in object storage/CDN.

## Verification Results From This Review

Commands run locally:

| Check | Result | Notes |
| --- | --- | --- |
| API Nest build | Passes | Passed after regenerating Prisma Client locally. |
| API Jest tests | Passes | `2` test suites and `2` tests passed. Coverage is still narrow. |
| Prisma generate | Passes | Generated Prisma Client v6.19.3; Prisma warns that `package.json#prisma` config is deprecated for Prisma 7. |
| Web production build | Passes | Next.js build completed successfully. |
| Deployment/Jenkins | Reported working | User confirmed the deployed app and Jenkins builds are working. |
| Prisma 7 review | Completed | Deferred for MVP because the official upgrade path changes module format, generated client imports, Prisma config, and PostgreSQL adapter setup. |

Important interpretation:

- The Docker API build runs `pnpm prisma generate` before `pnpm run build`, and the deployed/Jenkins path is currently reported healthy.
- If local API builds fail with missing Prisma model fields, first regenerate Prisma Client before changing application code.

## Prisma 7 Decision

Decision:

- Keep Prisma 6 for the current MVP stabilization phase.
- Revisit Prisma 7 after the core smoke tests, docs, and production observability are in place.

Why:

- Prisma 7 is a worthwhile long-term migration, but it is not a small patch upgrade.
- The official upgrade guide says Prisma 7 ships as ESM and recommends setting `"type": "module"`.
- The generated client output path is required, so imports must move away from the current `@prisma/client` pattern.
- PostgreSQL usage now requires a driver adapter such as `@prisma/adapter-pg`.
- Prisma config becomes the default place for CLI database configuration.
- Seeding and generate behavior changed; `migrate dev` no longer automatically runs generate/seed.

Bookvella impact:

- The Nest API currently imports `PrismaClient`, `Prisma`, `BookingStatus`, and `LocationType` from `@prisma/client` in multiple services and seed scripts.
- The API's current module setup works for the existing deployment. Moving fully to Prisma 7 would likely require a focused ESM/build refactor and Docker/Jenkins validation.
- This is better handled as a dedicated upgrade task, not mixed into MVP polish.

Future Prisma 7 acceptance criteria:

- API runs as ESM cleanly, or the chosen Prisma 7 setup is proven compatible with the Nest build.
- Generated Prisma Client has an explicit output path.
- All Prisma imports are updated.
- `PrismaService` uses the PostgreSQL adapter.
- `prisma.config.ts` is added and Docker/Jenkins use it correctly.
- Seed/migration commands are updated and documented.
- API build, tests, Docker build, Jenkins deployment, and production smoke test all pass.

## Priority 0: Confirm The Deployment Is Truly Healthy

Do this immediately on the VPS or deployment host:

- Confirm all containers are running and healthy.
- Confirm `https://bookvella.com` loads the web app.
- Confirm `https://api.bookvella.com/health/live` returns success.
- Confirm `https://api.bookvella.com/health/ready` returns database readiness.
- Confirm Prisma migrations have run against production PostgreSQL.
- Register a real test host in production.
- Create a test service.
- Set a booking schedule.
- Open the public booking URL.
- Complete a guest booking with email verification.
- Confirm the booking appears in the host dashboard.
- Cancel the booking and confirm cancellation email delivery.
- Submit a review through the review link and confirm it appears on the public booking page.

Acceptance criteria:

- A full host-to-guest-to-review flow works in a real browser against production.
- The API stays healthy after migrations.
- SMTP delivers to real inboxes, not only console/dev mode.
- No step requires manual database edits.

## Priority 1: Repair Build And Release Confidence

### 1. Keep API dependency and Prisma generation repeatable

Completed:

- The production API Docker build now runs `pnpm run test -- --runInBand` after `pnpm run build`, so backend unit test failures block image creation.
- API and root README instructions now call out `pnpm prisma generate`, `pnpm run test`, and `pnpm run test:e2e`.
- `prisma` moved from `devDependencies` to `dependencies` in `apps/api/package.json`. This ensures `pnpm prune --prod` retains `prisma` and its entire transitive tree (`@prisma/engines`, `@prisma/debug`, etc.) in the Docker runner stage, eliminating the pnpm strict-isolation/whack-a-mole failure that caused builds #10–#12. The Dockerfile was simplified from 57 lines to 33 — all manual `cp -rL` rescue logic removed.
- `PrismaService` now implements `OnModuleInit` and calls `$connect()` on startup, so the connection pool is established eagerly rather than on the first request.

If local builds fail:

- Run `pnpm prisma generate` first so Prisma Client knows about the latest migrations and schema fields.
- If generation fails because package files cannot be read, repair/reinstall API dependencies before changing application code.

Recommended fix:

- Run `pnpm prisma generate`.
- Run `pnpm run build`.
- Run `pnpm run test`.
- Cleanly reinstall API dependencies with pnpm only if Prisma generation fails.
- Run `pnpm run test:e2e` if a test database is available.

Acceptance criteria:

- API build passes from a clean checkout.
- Prisma Client is generated during local setup and Docker builds.
- The README tells developers exactly when to run `pnpm prisma generate`.

### 2. Tighten CI/CD

Completed:

- Jenkins now builds from the checked-out Jenkins workspace instead of the mounted `/workspace/bookvella` directory.
- Jenkins uses a stable Compose project name, `bookvella`, so deploy commands target the existing stack.
- `DEPLOY.md` now includes a rollback section.
- `.env` naming unified: the persistent server secret file is now named `.env` (was `.env.production`); `Jenkinsfile`, `docker-compose.prod.yml`, `.dockerignore`, and `.env.example` all updated to match. `MediaModule` was missing its `AuthModule` import, causing NestJS DI to throw `UnknownDependenciesException` at startup (Build #13) — fixed.

Recommended changes:

- Add an explicit migration dry-run/check stage if a safe production-like database workflow is added.
- Keep the production health check after deploy.

Acceptance criteria:

- A failed API build blocks deployment.
- A failed web build blocks deployment.
- Jenkins always builds the exact commit that triggered the pipeline.

### 3. Add smoke/E2E tests

Completed:

- Register host -> create service -> set schedule -> fetch public slots.
- Guest requests code -> confirms booking -> duplicate slot is rejected.
- Host sees booking -> cancels booking -> slot becomes available again.
- Review link submits a review -> host can hide/show it.
- Expired/invalid OTP returns clear errors.

Remaining:

- Run `pnpm run test:e2e` locally or in CI with PostgreSQL available.
- Decide whether the E2E suite should run in Jenkins against a disposable database or remain a manual smoke command.

Acceptance criteria:

- One command verifies the core MVP booking loop.
- Booking conflict behavior is tested at API level.
- Review token behavior is tested.

## Priority 2: Finish MVP Product Gaps

### Auth and security

Completed:

- Added `apps/web/src/proxy.ts` to redirect dashboard requests without a session marker cookie to `/login`.
- API login/register/Google/refresh now set httpOnly `bookvella.access`, `bookvella.refresh`, and `bookvella.session` cookies.
- API logout clears auth cookies.
- Web authenticated requests now use `credentials: "include"` and no longer send bearer tokens in headers.
- The web app no longer stores access or refresh tokens in `localStorage`; it stores only the public user snapshot for display.
- `AppShell` now verifies the current session with `/auth/me` before rendering dashboard content.
- Failed refresh-token attempts now clear local session state and return a clear expired-session error.
- Login can display a session-expired message and return the host to the requested dashboard path after sign-in.
- Login/register pages verify an existing session and redirect already-authenticated hosts away from auth screens.

Remaining:

- Verify production JWT keys are stable and not regenerated on deploy.
- Confirm real `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` values.
- Confirm production has `AUTH_COOKIE_DOMAIN=.bookvella.com` and `AUTH_COOKIE_SECURE=true`.
- Add deeper account/session management polish, such as viewing active sessions and revoking other devices.

### Public booking flow

Completed:

- Add resend-code and change-email actions in the OTP step.
- Persist guest notes and include them in host booking emails/dashboard details.
- Add add-to-calendar links after successful booking.
- Improve mobile step visibility so the booking steps remain visible on smaller screens.
- Add richer no-slots guidance, such as "try next week" or "contact the host."
- Booking success now offers both "Add to Google Calendar" and a downloadable `.ics` file button.
- Slot generation now steps by session duration rather than a fixed 15-minute increment — a 60-minute service shows slots every 60 minutes, not every 15. The `alignToStep` helper aligns the window start to the nearest duration boundary.
- Public booking date picker fetches a 21-day range upfront, groups slots by guest timezone date using `Intl.DateTimeFormat("en-CA")`, and only renders dates that actually have available slots — no more hardcoded 14-day list with empty days.

Remaining:

- Run the full browser flow against production after the guest-note and service-image migrations are deployed.
- Keep improving edge-case copy for invalid/expired codes and booking conflicts after real-user testing.

### Host profile/settings

Completed:

- Move public handle editing behind an advanced/edit URL section.
- Use real review counts in the live preview instead of placeholder `4.9 / 312 reviews`.
- Add a proper public profile URL copy area.
- Replace profile and cover image URL inputs with authenticated image uploads.
- Dashboard now shows a prominent setup banner guiding new hosts to create a service and/or set their schedule if either is missing.
- Dashboard greeting is now time-appropriate (good morning / good afternoon / good evening).
- Profile and cover image upload fields now open a canvas-based crop modal before uploading: circle crop (400 × 400) for the profile photo; 2:1 rect crop (800 × 400) for the cover image. The modal shows the image with `object-contain`, overlays a draggable crop window using the `box-shadow: 0 0 0 9999px` trick clipped by the container's `overflow-hidden`, and provides a zoom slider. Canvas extraction maps the crop box position to natural image coordinates via `getBoundingClientRect()` scaling and exports JPEG at 0.92 quality. A "Replace" button appears once an image is set. Profile photo thumbnail now renders as a circle to match the crop shape.

Remaining:

- Add deeper profile completeness cues (e.g. missing photo, headline, about text) on the settings page itself.

### Services

Completed:

- Services now support optional uploaded images that appear in the dashboard and public booking flow.
- Inactive services can now be reactivated directly from the services list with a "Reactivate" button.

Remaining:

- Consider renaming the route from `/dashboard/event-types` to `/dashboard/services` when convenient.
- Keep URL editing advanced-only.
- Add price display decision: hidden, plain text, or structured field.
- Add validation for odd service values and longer descriptions.

### Booking schedule

Completed:

- Availability page fully rewritten as a Google Calendar-style drag-to-select weekly grid: Mon–Sun columns, 6 am–10 pm rows in 30-minute increments. Click or drag to toggle blocks; continuous selected blocks render with rounded top/bottom pill styling. Preset buttons ("Weekdays 9–5", "Mon–Sat", "Every day", "Evenings", "Clear all") let hosts set a schedule in one click. Save strategy deletes all existing rules then posts the new grid, avoiding a diff.

Remaining:

- Current presets still save into one global weekly availability model.
- Add date-specific overrides, blackout dates, and special opening dates.
- Add named schedules such as "Weekdays", "Evenings", and "Weekends".
- Decide whether schedules are global, service-specific, or both.
- Add a guest-facing preview of upcoming bookable slots before saving.

### Bookings

Completed:

- Bookings page now has a live search input that filters by guest name or email.
- Each booking row is expandable to show guest phone, note, timezone, location, and cancellation reason.
- The upcoming empty state now shows a copy-booking-link button and a "create service" link instead of a plain text message.
- The booking list API now returns `locationDetails` from the event type alongside `locationType`.

Remaining:

- Add filter by service, status, and date range.
- Consider guest self-cancellation/rescheduling links after MVP.

### Reviews

Completed:

- Review summary stats (`reviewCount`, `averageRating`) are now computed with `prisma.review.aggregate()` across all visible reviews for an event type, replacing the previous calculation that only covered the first 8 reviews returned for display.

Remaining:

- Add tests for review submission, duplicate prevention, visibility, and public display.
- Add token expiry or one-time review invitation records if reviews become important.
- Add abuse/spam handling and moderation copy.
- Add dashboard review metrics.

### Emails

Completed:

- Email bodies now normalize all line endings to CRLF before dot-stuffing, satisfying the RFC 2822 requirement for `\r\n` throughout the message body.
- Both MIME parts (`text/plain` and `text/html`) in multipart/alternative messages now include `Content-Transfer-Encoding: 7bit` headers.

Remaining:

- Verify real SMTP deliverability on production domain.
- Add calendar file/link in confirmation emails.
- Add reply-to behavior if hosts should receive guest replies.
- Configure domain email basics: SPF, DKIM, DMARC, and branded sender.

### Documentation

Completed:

- Replaced `apps/web/README.md`.
- Replaced `apps/api/README.md`.
- Added root `README.md`.

Remaining:

- Add architecture overview.
- Add screenshots from the deployed app.
- Add demo credentials or a demo seed note.
- Expand common issues and smoke-test instructions.

## Priority 3: Product Improvements To Consider After MVP

Good next bets:

- Calendar integrations: Google Calendar, Outlook, ICS feeds, conflict sync.
- Reminders: guest and host reminder emails before appointments.
- Guest self-serve reschedule/cancel links.
- Service pricing fields and optional payment collection.
- Better public profile page that lists all services for a host, not only direct service links.
- Host onboarding checklist with progress.
- Analytics: profile views, booking conversion, service popularity.
- Object storage/CDN for uploaded images instead of the API-local upload volume.
- Better observability: structured logs, request IDs, error tracking, uptime checks, and alerting.
- Production-grade rate limiting with Redis if scaling beyond one API instance.

## Suggested Work Order

1. Verify production health and complete a real production smoke test.
2. Run the new API E2E suite with PostgreSQL available, then decide whether to add it to Jenkins.
3. Deploy and verify the guest-note migration plus public booking polish in production.
4. Finish remaining profile/service polish: profile completeness, price decision, reactivation UX.
5. Improve schedule model: date overrides and named schedules.
6. Add observability and production email/domain hardening.
7. Revisit Prisma 7 as a dedicated upgrade task after MVP stabilization.

## MVP Done Definition From Here

The MVP is done when:

- Production passes the full host signup -> service -> schedule -> guest booking -> email -> host dashboard -> cancellation -> review smoke test.
- API and web builds pass from a clean install.
- CI/CD blocks broken builds.
- Starter documentation is replaced.
- A reviewer can clone, configure, run, and understand the project from docs alone.
- The public booking flow handles common errors gracefully.
- The host dashboard feels usable on mobile and desktop.
- The deployed app can be maintained without remembering manual steps.
