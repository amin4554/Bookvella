CREATE TABLE "account_action_otps" (
  "id" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "user_id" TEXT,
  "code_hash" TEXT NOT NULL,
  "payload" JSONB,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "max_attempts" INTEGER NOT NULL DEFAULT 5,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "account_action_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "account_action_otps_email_idx" ON "account_action_otps"("email");
CREATE INDEX "account_action_otps_user_id_idx" ON "account_action_otps"("user_id");
CREATE INDEX "account_action_otps_expires_at_idx" ON "account_action_otps"("expires_at");

ALTER TABLE "account_action_otps"
ADD CONSTRAINT "account_action_otps_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
