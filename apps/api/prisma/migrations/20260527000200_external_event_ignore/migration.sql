-- Allow hosts to mark an external calendar event as "ignored" so the booking
-- engine doesn't treat it as a conflict, even though the event still exists in
-- the connected provider calendar.
ALTER TABLE "external_event_buffers"
ADD COLUMN "ignored" BOOLEAN NOT NULL DEFAULT false;
