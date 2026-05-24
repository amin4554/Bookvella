-- Availability redesign: per-date overrides with types, booking rules on users.

CREATE TYPE "AvailabilityOverrideType" AS ENUM ('BLOCKED', 'CUSTOM_HOURS');

ALTER TABLE "availability_overrides"
  ADD COLUMN "type" "AvailabilityOverrideType" NOT NULL DEFAULT 'BLOCKED',
  ADD COLUMN "note" TEXT,
  ADD COLUMN "blocks" JSONB,
  ADD COLUMN "group_id" TEXT;

CREATE INDEX "availability_overrides_group_id_idx" ON "availability_overrides"("group_id");

ALTER TABLE "users"
  ADD COLUMN "min_notice_minutes"    INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN "booking_horizon_days"  INTEGER NOT NULL DEFAULT 56,
  ADD COLUMN "slot_interval_minutes" INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN "daily_booking_limit"   INTEGER,
  ADD COLUMN "show_buffer_time"      BOOLEAN NOT NULL DEFAULT false;
