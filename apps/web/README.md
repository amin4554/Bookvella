# Bookvella Web

This is the Next.js frontend for Bookvella.

## What It Contains

- Landing page.
- Login and registration.
- Host dashboard.
- Services management.
- Weekly booking schedule UI.
- Bookings list and cancellation flow.
- Public profile/settings page.
- Profile and cover image uploads.
- Optional service image uploads.
- Public booking page with slots, guest details, email-code confirmation, success state, and reviews.

## Environment

Create `apps/web/.env.local` from `apps/web/.env.example`:

```bat
copy .env.example .env.local
```

Typical local values:

```txt
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Google sign-in is optional locally. If `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is not set, the UI shows a disabled-style Google action with setup guidance.

## Development

```bat
npm install
npm run dev
```

The app runs on:

```txt
http://localhost:3001
```

## Build

```bat
npm run build
```

## Key Routes

- `/`: landing page.
- `/login`: host login.
- `/register`: host registration.
- `/dashboard`: host dashboard.
- `/dashboard/event-types`: services.
- `/dashboard/availability`: booking schedule.
- `/dashboard/bookings`: bookings.
- `/dashboard/settings`: public profile/settings.
- `/:hostSlug/:eventSlug`: public booking page.

## Notes

- Dashboard routes are gated by `src/proxy.ts` using a non-sensitive session marker cookie, then verified by `AppShell` through `/auth/me`.
- Browser auth uses httpOnly API cookies. The web app stores only the public user snapshot in `localStorage` for display.
- Authenticated API requests use `credentials: "include"` and do not send bearer tokens in headers.
- A failed refresh clears the local session and sends the host back to login with a session-expired message.
- Login/register screens redirect already-authenticated hosts to the requested dashboard path.
- The API client is in `src/lib/api.ts`.
- Product copy should use "services", "booking schedule", and "public link" in the UI, even though the API still uses `event-types` internally.
