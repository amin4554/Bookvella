CREATE TYPE "BookingReminderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'CANCELLED', 'FAILED');

CREATE TABLE "booking_reminders" (
  "booking_id" TEXT NOT NULL,
  "send_at" TIMESTAMP(3) NOT NULL,
  "status" "BookingReminderStatus" NOT NULL DEFAULT 'PENDING',
  "sent_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "booking_reminders_pkey" PRIMARY KEY ("booking_id")
);

CREATE INDEX "booking_reminders_status_send_at_idx" ON "booking_reminders"("status", "send_at");

ALTER TABLE "booking_reminders"
ADD CONSTRAINT "booking_reminders_booking_id_fkey"
FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
