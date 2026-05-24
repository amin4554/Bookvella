CREATE TYPE "DailyAgendaStatus" AS ENUM ('PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "daily_agenda_deliveries" (
  "user_id" TEXT NOT NULL,
  "agenda_date" DATE NOT NULL,
  "status" "DailyAgendaStatus" NOT NULL DEFAULT 'PROCESSING',
  "sent_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "daily_agenda_deliveries_pkey" PRIMARY KEY ("user_id", "agenda_date")
);

CREATE INDEX "daily_agenda_deliveries_status_agenda_date_idx" ON "daily_agenda_deliveries"("status", "agenda_date");

ALTER TABLE "daily_agenda_deliveries"
ADD CONSTRAINT "daily_agenda_deliveries_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
