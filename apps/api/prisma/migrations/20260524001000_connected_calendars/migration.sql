CREATE TYPE "CalendarProvider" AS ENUM ('GOOGLE', 'OUTLOOK');
CREATE TYPE "ConnectedCalendarState" AS ENUM ('ACTIVE', 'PAUSED', 'SYNC_ERROR', 'TOKEN_EXPIRED');
CREATE TYPE "CalendarEventSyncStatus" AS ENUM ('PENDING', 'SYNCED', 'FAILED', 'DELETED');

CREATE TABLE "connected_calendars" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "provider" "CalendarProvider" NOT NULL,
  "account_email" TEXT NOT NULL,
  "access_token_encrypted" TEXT NOT NULL,
  "refresh_token_encrypted" TEXT,
  "access_token_expires_at" TIMESTAMP(3),
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "conflicts_on" BOOLEAN NOT NULL DEFAULT true,
  "write_back_calendar_id" TEXT,
  "mark_buffer_busy" BOOLEAN NOT NULL DEFAULT true,
  "include_guest_details" BOOLEAN NOT NULL DEFAULT true,
  "state" "ConnectedCalendarState" NOT NULL DEFAULT 'ACTIVE',
  "last_synced_at" TIMESTAMP(3),
  "last_sync_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "connected_calendars_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conflict_calendars" (
  "id" TEXT NOT NULL,
  "connected_calendar_id" TEXT NOT NULL,
  "provider_calendar_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "conflict_calendars_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "calendar_event_syncs" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "connected_calendar_id" TEXT NOT NULL,
  "provider_event_id" TEXT,
  "provider_calendar_id" TEXT,
  "sync_status" "CalendarEventSyncStatus" NOT NULL DEFAULT 'PENDING',
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "calendar_event_syncs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "connected_calendars_user_id_provider_account_email_key" ON "connected_calendars"("user_id", "provider", "account_email");
CREATE INDEX "connected_calendars_user_id_provider_idx" ON "connected_calendars"("user_id", "provider");
CREATE UNIQUE INDEX "conflict_calendars_connected_calendar_id_provider_calendar_id_key" ON "conflict_calendars"("connected_calendar_id", "provider_calendar_id");
CREATE UNIQUE INDEX "calendar_event_syncs_booking_id_connected_calendar_id_key" ON "calendar_event_syncs"("booking_id", "connected_calendar_id");
CREATE INDEX "calendar_event_syncs_connected_calendar_id_idx" ON "calendar_event_syncs"("connected_calendar_id");

ALTER TABLE "connected_calendars"
ADD CONSTRAINT "connected_calendars_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "conflict_calendars"
ADD CONSTRAINT "conflict_calendars_connected_calendar_id_fkey"
FOREIGN KEY ("connected_calendar_id") REFERENCES "connected_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_event_syncs"
ADD CONSTRAINT "calendar_event_syncs_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_event_syncs"
ADD CONSTRAINT "calendar_event_syncs_connected_calendar_id_fkey"
FOREIGN KEY ("connected_calendar_id") REFERENCES "connected_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
