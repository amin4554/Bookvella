# Bookvella MVP Next Steps and Design Brief

## Current Product Direction

Bookvella is a booking platform for service providers. A host creates a personalized public profile, adds the services they offer, defines when those services can be booked, and shares a public booking link. Guests learn about the provider, review the service details, choose an available time, enter their details, verify by email code, and confirm a booking.

The MVP should feel like a complete booking product, not just a demo. The host dashboard should feel practical and operational. The public booking flow should feel polished, calm, and trustworthy.

## Current Implementation Status

### Backend

Implemented:

- Host registration and login
- Access and refresh token auth
- Authenticated `/auth/me`
- Event type CRUD
- Weekly availability rules CRUD
- Public event lookup
- Public slot generation
- Email-code booking flow
- Public booking creation
- Host booking list
- Host booking cancellation
- SMTP/console email service
- Health endpoint plus `/health/live` and `/health/ready`
- Slot-engine tests
- Runtime config validation for required production secrets
- Comma-separated production CORS origin parsing
- Basic security headers
- In-memory rate limiting for auth and booking-code endpoints
- Graceful shutdown hooks
- Explicit `tslib` runtime dependency declared
- API lint, build, and current Jest tests passing after hardening
- Demo seed workflow for one realistic host, services, availability, and sample bookings
- Public profile fields for host booking pages
- `PATCH /auth/me` for editable host profile data
- Google sign-in/sign-up backend route at `POST /auth/google`
- Richer service metadata: category, included items, and location details
- Prisma migration added for profile fields, Google account linkage, and service metadata
- Local API dependencies were reinstalled cleanly and Prisma Client was regenerated

Needs attention:

- Production runtime verification on the deployment host
- Clean production database migration workflow
- Stronger end-to-end test coverage
- Distributed production rate limiting if the API runs on multiple instances
- Better production logging/error visibility
- Friendlier service scheduling model beyond the current weekly availability rules

### Frontend

Implemented:

- Landing page
- Login page
- Register page
- Host dashboard
- Service management UI, currently backed by event type data internally
- Basic weekly availability editor
- Bookings list and cancellation
- Public booking page
- OTP/code confirmation UI
- Booking success UI
- Real API integration for core flows
- New logo and redesigned visual direction
- Google sign-in/sign-up button integrated into login and registration screens
- Editable public profile page with live guest preview
- Public booking flow redesigned with provider summary, service details, trust content, stepper, details, OTP, and success states
- Services page updated to use guest-friendly service language and richer service fields
- Booking schedule page updated with presets, schedule summary, and clearer product language
- Mobile host navigation updated to a bottom navigation pattern

Needs attention:

- Google OAuth needs real `GOOGLE_CLIENT_ID` and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` values before it can be used
- Auth protection is client-side; server-side dashboard protection can still be hardened later
- Loading and error states need final polish across every page
- Mobile layouts need a full pass
- Public booking page can still use more real provider content once profile data is filled in by hosts
- Availability still uses weekly rules underneath; date overrides and reusable named schedules are still future work
- Copywriting should be tightened for real launch

## MVP Completion Checklist

### 1. Production Runtime

Required before deployment:

- Cleanly reinstall API dependencies from the updated lockfile
- Confirm `npm run build` and `npm run start:prod` work for the API
- Confirm generated Prisma client is included correctly
- Confirm environment variables are documented
- Confirm the API can connect to production PostgreSQL
- Generate stable RSA keys for `JWT_PRIVATE_KEY` and `JWT_PUBLIC_KEY`
- Set a long random `EMAIL_CODE_SECRET`
- Set exact production CORS origins through `CORS_ORIGINS`

Acceptance criteria:

- `node dist/main` starts successfully
- `/health` returns `status: ok`
- `/health/live` works without a database query
- `/health/ready` returns database readiness
- API can register a user and create a booking in production-like mode

Recent backend hardening completed:

- Added `apps/api/src/config/runtime.ts`
- Added required env validation for production
- Added security headers middleware
- Added basic in-memory rate limiting for `/auth/login`, `/auth/register`, `/auth/refresh`, and public `booking-codes`
- Added graceful shutdown hooks
- Added `/health/live` and `/health/ready`
- Added `apps/api/.env.example`
- Declared `tslib` in `apps/api/package.json` and `apps/api/pnpm-lock.yaml`
- Cleaned the API lint/prettier issues that were blocking backend checks
- Verified `eslint`, Nest build, and Jest all pass locally
- Added `npm run db:seed` / Prisma seed support for a realistic demo account
- Added profile and Google-auth migration: `20260521222000_profile_and_google_auth`
- Verified API dependency reinstall, Prisma generate, Nest build, and Jest after the profile/Google changes

## Local CMD Runbook

These commands are written for Windows `cmd.exe`.

### 1. Start PostgreSQL

From the project root:

```bat
cd C:\Users\mehdi\Desktop\Bookvella
docker compose up -d
```

### 2. Configure API environment

From the project root:

```bat
cd apps\api
copy .env.example .env
```

For normal local development, keep the default database URL:

```txt
DATABASE_URL="postgresql://bookvella:bookvella_dev@localhost:5433/bookvella?schema=public"
```

Google sign-in is optional locally. To enable it later, set:

```txt
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
```

### 3. Install and prepare the API

From `apps\api`:

```bat
pnpm install
npx prisma generate
npx prisma migrate dev
pnpm run db:seed
```

### 4. Run the API

From `apps\api`:

```bat
pnpm run start:dev
```

The API runs at:

```txt
http://localhost:3000
```

Health checks:

```txt
http://localhost:3000/health
http://localhost:3000/health/live
http://localhost:3000/health/ready
```

### 5. Configure web environment

Open a second `cmd.exe` window. From the project root:

```bat
cd C:\Users\mehdi\Desktop\Bookvella\apps\web
copy .env.example .env.local
```

For normal local development:

```txt
NEXT_PUBLIC_API_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3001"
```

Google sign-in is optional locally. To enable it later, set the same Google client ID:

```txt
NEXT_PUBLIC_GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
```

### 6. Install and run the web app

From `apps\web`:

```bat
npm install
npm run dev
```

The web app runs at:

```txt
http://localhost:3001
```

### 7. Demo login

After seeding the API:

```txt
Email: demo@bookvella.local
Password: bookvella-demo-123
Public booking page: http://localhost:3001/marcus/fresh-cut
```

### 8. Useful local checks

API:

```bat
cd C:\Users\mehdi\Desktop\Bookvella\apps\api
pnpm run build
pnpm run test
```

Web:

```bat
cd C:\Users\mehdi\Desktop\Bookvella\apps\web
npm run build
```

### 9. Common local auth/database issue

If login or registration fails with an error like this:

```txt
The column `users.google_sub` does not exist in the current database.
```

Your local database has not applied the latest migration. Stop the API dev server, then run:

```bat
cd C:\Users\mehdi\Desktop\Bookvella\apps\api
npx prisma migrate dev
npx prisma generate
pnpm run start:dev
```

If `npx prisma generate` fails on Windows with an `EPERM` rename error, close any running API terminal or Node process and run it again. This usually means Windows is holding Prisma's query engine file open.

## 2. Full End-to-End Booking Flow

Required:

- Register host
- Create service
- Set booking schedule
- Open public booking link
- Select slot
- Enter guest details
- Request email code
- Confirm booking with code
- Booking appears in host dashboard/bookings
- Guest and host receive confirmation email

Acceptance criteria:

- A real browser flow works from host signup to guest booking confirmation
- Duplicate booking for the same slot is rejected
- Cancelled booking disappears from upcoming available slots

## 3. Auth and Session Handling

Required:

- Redirect unauthenticated dashboard users to `/login`
- Handle expired access token with refresh token
- Handle failed refresh by logging out
- Add logout API call if refresh token exists
- Prevent dashboard from flashing private pages before auth check completes

Acceptance criteria:

- Visiting `/dashboard` without auth redirects cleanly
- Expired sessions do not leave the app in a broken loading state

## 4. Settings Page

Required:

- Show current public profile data
- Allow name update
- Allow business/service category update
- Allow short bio/about text update
- Allow profile photo or logo update
- Allow timezone update
- Show public profile URL
- Allow public URL handle update only inside an advanced/edit URL section
- Show review/testimonial placeholders if reviews are not implemented yet

Backend may need:

- `PATCH /users/me` or `PATCH /auth/me`
- Profile fields: business category, bio, headline, location, profile image URL, cover image URL
- Later: reviews/testimonials model or manual featured testimonials for MVP

Acceptance criteria:

- Host can verify and update the information guests see before booking
- The public profile feels personal and trustworthy, not like a blank account settings page

## 5. Public Booking Polish

Required:

- Clear step indicator: Pick a time, Your details, Confirm
- Provider profile summary
- Service details section
- Review/testimonial or trust section
- Better date selector
- Better selected appointment panel
- No slots state
- Event not found state
- Code sent state
- Invalid/expired code state
- Booking conflict state
- Success state with booking details

Acceptance criteria:

- Guest can understand exactly where they are in the booking flow
- Guest understands who they are booking with and what the service includes before choosing a time
- Mobile booking flow is easy to complete with one thumb

## 6. Email Experience

Required:

- Verification code email
- Guest confirmation email
- Host new booking email
- Guest cancellation email
- Host cancellation email

Nice for MVP:

- Simple branded HTML email templates
- Plain-text fallback
- Include event title, date/time, host, guest, timezone, and cancellation reason

Acceptance criteria:

- Emails are readable, branded, and contain all appointment details

## 7. Seed and Demo Data

Implemented:

- `npm run db:seed` creates one realistic host
- Seed services are included
- A sample booking schedule is included
- Several bookings are included
- The seed resets only the known demo host by email/public handle

Acceptance criteria:

- One command creates a demo account suitable for screenshots and portfolio demos

Example demo account:

```txt
Host: Marcus Williams
Business type: Barber
Public handle: marcus
Email: demo@bookvella.local
Password: bookvella-demo-123
Services:
- Fresh Cut Session
- Beard Trim & Shape
- Quick Consultation
```

## 8. Documentation

Required:

- Replace starter READMEs
- Add root README
- Add setup instructions in this brief
- Add environment variable list
- Add local development instructions in this brief
- Add architecture overview
- Add screenshots
- Add demo flow
- Add deployment notes

Acceptance criteria:

- A reviewer can clone, configure, run, and understand the project without asking for help

## 9. Deployment Prep

Required:

- API Dockerfile
- Web deployment environment values
- Database migration command
- CORS production config
- SMTP production config
- Health check

Recommended MVP deployment:

- Frontend: Vercel
- Backend: VPS or Render/Fly.io/Railway
- Database: PostgreSQL
- Email: Brevo, Resend, or similar SMTP/API provider

## Designer Brief: Next Page Ideas

## Product Terminology for Design

Use guest-friendly and provider-friendly language in the UI:

- Say "service", not "event type"
- Say "public link" or "booking page", not "slug"
- Say "booking schedule", not "availability rules"
- Say "prep time" or "cleanup time", not "buffer"
- Say "profile" or "public page", not "settings" when the page changes what guests see

The backend can keep technical names if needed, but the product experience should feel like a marketplace/service profile builder.

## Design Principles

Bookvella should feel:

- Friendly
- Fast
- Trustworthy
- Service-provider focused
- More modern marketplace than generic SaaS
- Warm and energetic without hurting usability

Use the current direction:

- Off-white page background
- Coral/orange primary gradient
- Pink/purple accent gradients
- Soft rounded cards
- Strong black headings
- Muted gray body text
- Clean white surfaces
- Clear pills and status badges

Avoid:

- Overcrowded cards
- Decorative elements that reduce readability
- Text overlapping buttons or cards
- Tiny controls on mobile
- Too much purple everywhere
- Generic corporate dashboard styling

## Page Designs Still Needed

### 1. Dashboard Empty State

Purpose:

Help a brand-new host complete setup.

Recommended sections:

- Welcome message
- Three setup steps:
  - Personalize profile
  - Create first service
  - Set booking schedule
  - Share booking link
- Progress indicator
- Primary CTA: Create your first service
- Secondary CTA: Preview public page

Design idea:

Use a large friendly setup panel with three setup steps. Keep it operational, not marketing-heavy. The copy should say "service" and "booking schedule", not "event type" or "weekly rules".

## 2. Personalized Profile Page

Purpose:

Let hosts manage the public page guests see before booking.

Recommended sections:

- Profile photo or brand logo
- Cover image or soft branded header area
- Name or business name
- Short headline, for example "Precision cuts in Downtown Austin"
- Business/service category
- Location or service area
- Short about section
- What to expect section
- Review/testimonial highlights
- Social links or website link
- Timezone
- Public profile URL with copy button
- Advanced public handle editor hidden behind "Edit URL"

Design idea:

Split layout:

- Left: editable profile form grouped into Public identity, About, Trust, and Links
- Right: live public profile preview that looks like the real guest-facing page

Do not make the slug feel like a technical field. The host should see a friendly public URL preview such as `bookvella.com/marcus`, with an edit action only if they want to customize it.

Backend may need:

- Profile image URL
- Cover image URL
- Headline
- Business category
- Location or service area
- About text
- Featured testimonials or review placeholders
- Social/website links

## 3. Public Booking Page Details Step

Purpose:

Collect guest information after a slot is selected.

Recommended sections:

- Provider profile summary
- Service details and what is included
- Review/testimonial or trust section
- Stepper across the top
- Selected appointment summary
- Guest name
- Email
- Optional phone
- Optional note
- Primary CTA: Send verification code

Design idea:

Keep selected appointment visible in a sticky side panel on desktop and a compact top card on mobile.

The top of the public booking page should feel like a small personalized service page, not only a scheduler. Include provider identity, service details, what is included, duration, location type, and review/social proof before or beside the time picker.

## 4. Public Booking OTP Step

Purpose:

Verify the guest by email code.

Recommended sections:

- Email sent confirmation
- Six-digit code input
- Resend code
- Change email
- Confirm booking CTA
- Error state for invalid/expired code

Design idea:

Use large segmented code inputs and a reassuring message. The page should feel secure but not intimidating.

## 5. Public Booking Success Page

Purpose:

Confirm booking completion.

Recommended sections:

- Success icon
- Service name
- Host name
- Date and time
- Guest email
- Location type
- Confirmation email message
- Optional add-to-calendar button

Design idea:

Use a centered success card with a soft gradient halo and a clean appointment summary.

## 6. Service Create/Edit Flow

Purpose:

Create or edit a real service the host offers.

Recommended fields:

- Service name
- Service category or type
- Description
- What is included
- Duration
- Location type
- Price or "price shown outside Bookvella" placeholder if payments are not in MVP
- Booking schedule
- Preparation or cleanup time, shown in plain language
- Active/public toggle
- Public service URL preview

Fields to avoid as primary inputs:

- Manual slug field
- Buffer before
- Buffer after

These are useful system concepts, but they should not be front-and-center for normal users. Generate the service URL from the service name automatically. If the user needs to change it, place it under an advanced "Edit public URL" control.

Design idea:

Use a full service setup page or a guided modal instead of a cramped drawer if the form grows. The first screen should ask "What service do you offer?" and "How long does it take?" before any advanced scheduling details.

Recommended layout:

- Service basics: name, category, description, image
- Guest expectations: what is included, location, notes
- Booking rules: duration, prep/cleanup time, booking schedule
- Visibility: active/public toggle and URL preview

Production UX rule:

The service should feel like something a barber, consultant, photographer, tutor, or coach offers. Avoid internal SaaS language like "event type", "slug", or "buffer" in visible UI.

## 7. Booking Schedule System

Purpose:

Help hosts define when services can be booked without forcing them to manually choose every day every week.

Recommended mental model:

- Hosts create reusable schedules, for example "Standard work hours", "Evenings", "Weekend sessions", or "Pop-up day"
- A service can use one schedule or a custom schedule
- The system should offer smart presets first, then allow edits
- Date-specific overrides should be easy, for example vacation days, special opening days, or one-off events

Recommended schedule setup:

- Start with presets:
  - Weekdays
  - Weekends
  - Specific days
  - One-time date range
  - Custom
- Let the host choose broad availability first, then refine
- Allow "available any day" with a simple time range
- Allow excluded dates
- Allow special dates
- Allow service-specific schedules when needed

Better user flow:

1. Choose when this service is usually available
2. Pick a preset or date range
3. Set the bookable hours
4. Add exceptions only if needed
5. Preview what guests will see

Empty state:

- Short explanation
- CTA: Create booking schedule
- Suggested schedule preset buttons:
  - Any day
  - Weekdays
  - Weekends
  - Specific dates
  - Custom

Error state:

- Highlight invalid time ranges
- Inline error text
- Disable save until valid or allow save with clear validation message

Backend may need:

- Named schedules
- Service-to-schedule assignment
- Date overrides
- Blackout dates
- Optional service-specific availability
- A migration path from the current weekly availability rules

Production UX rule:

Do not make availability feel like a spreadsheet of weekdays unless the user explicitly chooses advanced editing. Most users should be able to make a service bookable in under one minute.

## 8. Bookings Empty State

Purpose:

Make an empty bookings page useful.

Recommended sections:

- Empty table/card
- CTA: Copy public booking link
- CTA: Create service
- Tip: Share your link on Instagram, email signature, or website

## 9. Mobile Navigation

Purpose:

Make host dashboard usable on phones.

Recommended design:

- Bottom navigation for Dashboard, Bookings, Services, Schedule
- Profile/settings accessible from top-right avatar
- Avoid horizontal scroll nav if possible

## 10. Error and Loading Components

Purpose:

Make the app feel complete under imperfect conditions.

Needed components:

- Page loading skeleton
- Table loading skeleton
- Form saving state
- Full-page API error
- Empty state card
- Toast style
- Confirmation modal

## Recommended Designer Deliverables

Ask the designer for:

- Desktop and mobile for each core page
- Empty/loading/error states
- Button and input states
- Modal/drawer states
- Public booking flow screens
- Dashboard setup flow
- Personalized profile page
- Service setup flow
- Booking schedule setup flow
- Small component library:
  - Buttons
  - Inputs
  - Selects
  - Tabs
  - Toggles
  - Status badges
  - Cards
  - Modals
  - Toasts

## Product Questions to Confirm

Before final production design, confirm these decisions:

- Should reviews be real user reviews in MVP, or manually added testimonials controlled by the host?
- Should each service have its own image, or should only the profile have a main image/logo for MVP?
- Should service prices be shown now, hidden, or added later with payments?
- Should a service be bookable on any day by default, or should the first setup ask the host to choose a broad preset?
- Should booking schedules be global reusable schedules, service-specific schedules, or both?
- Should hosts be able to create one-off services for a single date or short date range?
- Should the public profile page list all services first, or should shared links usually open directly to one service?

## Suggested Design Order

1. Public booking flow
2. Dashboard empty/setup state
3. Personalized profile page
4. Service setup flow
5. Booking schedule setup flow
6. Bookings page states
7. Component library cleanup
8. Final responsive QA pass

## Final MVP Definition

The MVP is complete when:

- A host can sign up, create a service, set a booking schedule, and share a link
- A guest can book a real available slot with email verification
- The host can view and cancel bookings
- Emails are sent for codes, confirmations, and cancellations
- The app works on mobile and desktop
- The design feels consistent across all main pages
- The project can be run locally from documentation
- The app can be deployed without changing code
