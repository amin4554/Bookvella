-- Add price fields to event_types
ALTER TABLE "event_types" ADD COLUMN "price_amount" INTEGER;
ALTER TABLE "event_types" ADD COLUMN "price_currency" TEXT NOT NULL DEFAULT 'USD';

-- Add guest cancel token to bookings
ALTER TABLE "bookings" ADD COLUMN "guest_cancel_token" TEXT;
CREATE UNIQUE INDEX "bookings_guest_cancel_token_key" ON "bookings"("guest_cancel_token");
