-- Per-event buffer for external calendar events.
-- Hosts can pad an individual Google/Outlook event with extra blocked minutes
-- before and after so the booking page treats the surrounding window as busy.
CREATE TABLE "external_event_buffers" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "connected_calendar_id" TEXT NOT NULL,
  "provider_calendar_id" TEXT NOT NULL,
  "provider_event_id" TEXT NOT NULL,
  "buffer_before_minutes" INTEGER NOT NULL DEFAULT 0,
  "buffer_after_minutes" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "external_event_buffers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_event_buffers_calendar_event_key"
  ON "external_event_buffers"("connected_calendar_id", "provider_event_id");

CREATE INDEX "external_event_buffers_user_id_idx"
  ON "external_event_buffers"("user_id");

ALTER TABLE "external_event_buffers"
ADD CONSTRAINT "external_event_buffers_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "external_event_buffers"
ADD CONSTRAINT "external_event_buffers_connected_calendar_id_fkey"
FOREIGN KEY ("connected_calendar_id") REFERENCES "connected_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;
