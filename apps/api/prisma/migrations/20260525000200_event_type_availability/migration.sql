CREATE TYPE "EventTypeAvailabilityMode" AS ENUM ('HOST_DEFAULT', 'CUSTOM');

CREATE TABLE "event_type_availability" (
    "id" TEXT NOT NULL,
    "event_type_id" TEXT NOT NULL,
    "mode" "EventTypeAvailabilityMode" NOT NULL DEFAULT 'HOST_DEFAULT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_type_availability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_type_availability_rules" (
    "id" TEXT NOT NULL,
    "availability_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,

    CONSTRAINT "event_type_availability_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "event_type_availability_event_type_id_key" ON "event_type_availability"("event_type_id");

CREATE INDEX "event_type_availability_rules_availability_id_idx" ON "event_type_availability_rules"("availability_id");

ALTER TABLE "event_type_availability" ADD CONSTRAINT "event_type_availability_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_type_availability_rules" ADD CONSTRAINT "event_type_availability_rules_availability_id_fkey" FOREIGN KEY ("availability_id") REFERENCES "event_type_availability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
