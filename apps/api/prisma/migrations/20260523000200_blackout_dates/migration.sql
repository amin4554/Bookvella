-- Create availability_overrides table for host blackout dates
CREATE TABLE "availability_overrides" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "is_blocked" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "availability_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "availability_overrides_user_id_date_key" ON "availability_overrides"("user_id", "date");
CREATE INDEX "availability_overrides_user_id_idx" ON "availability_overrides"("user_id");

ALTER TABLE "availability_overrides" ADD CONSTRAINT "availability_overrides_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
