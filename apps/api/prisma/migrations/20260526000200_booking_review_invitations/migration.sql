CREATE TABLE "booking_review_invitations" (
  "booking_id" TEXT NOT NULL,
  "send_at" TIMESTAMP(3) NOT NULL,
  "status" "BookingReminderStatus" NOT NULL DEFAULT 'PENDING',
  "sent_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "booking_review_invitations_pkey" PRIMARY KEY ("booking_id")
);

CREATE INDEX "booking_review_invitations_status_send_at_idx"
ON "booking_review_invitations"("status", "send_at");

ALTER TABLE "booking_review_invitations"
ADD CONSTRAINT "booking_review_invitations_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "booking_review_invitations" ("booking_id", "send_at", "status", "updated_at")
SELECT "id", "end_time_utc", 'PENDING', CURRENT_TIMESTAMP
FROM "bookings"
WHERE "status" = 'CONFIRMED'
  AND "end_time_utc" > CURRENT_TIMESTAMP
  AND NOT EXISTS (
    SELECT 1
    FROM "reviews"
    WHERE "reviews"."booking_id" = "bookings"."id"
  );
