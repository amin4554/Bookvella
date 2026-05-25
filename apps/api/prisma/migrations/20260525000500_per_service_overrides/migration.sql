ALTER TABLE "availability_overrides" ADD COLUMN "event_type_id" TEXT;

DROP INDEX IF EXISTS "availability_overrides_user_id_date_key";

CREATE INDEX "availability_overrides_user_id_event_type_id_idx" ON "availability_overrides"("user_id", "event_type_id");

ALTER TABLE "availability_overrides" ADD CONSTRAINT "availability_overrides_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
