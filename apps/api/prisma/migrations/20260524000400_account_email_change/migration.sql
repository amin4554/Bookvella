CREATE TABLE "account_email_changes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "new_email" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "account_email_changes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_email_changes_token_hash_key" ON "account_email_changes"("token_hash");
CREATE INDEX "account_email_changes_user_id_idx" ON "account_email_changes"("user_id");
CREATE INDEX "account_email_changes_expires_at_idx" ON "account_email_changes"("expires_at");

ALTER TABLE "account_email_changes"
ADD CONSTRAINT "account_email_changes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
