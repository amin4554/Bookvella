CREATE TABLE "availability_schedules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "availability_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "availability_schedule_rules" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_minute" INTEGER NOT NULL,
    "end_minute" INTEGER NOT NULL,

    CONSTRAINT "availability_schedule_rules_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "availability_schedules_user_id_name_key" ON "availability_schedules"("user_id", "name");

CREATE INDEX "availability_schedules_user_id_idx" ON "availability_schedules"("user_id");

CREATE INDEX "availability_schedule_rules_schedule_id_idx" ON "availability_schedule_rules"("schedule_id");

ALTER TABLE "availability_schedules" ADD CONSTRAINT "availability_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "availability_schedule_rules" ADD CONSTRAINT "availability_schedule_rules_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "availability_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
