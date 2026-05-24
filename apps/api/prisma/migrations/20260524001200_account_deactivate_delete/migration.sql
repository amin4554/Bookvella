ALTER TABLE "users" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "deactivated_at" TIMESTAMP(3);

CREATE TABLE "account_deletion_requests" (
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "confirmed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "account_deletion_requests_pkey" PRIMARY KEY ("user_id")
);

CREATE UNIQUE INDEX "account_deletion_requests_token_hash_key" ON "account_deletion_requests"("token_hash");
CREATE INDEX "account_deletion_requests_expires_at_idx" ON "account_deletion_requests"("expires_at");

ALTER TABLE "account_deletion_requests"
ADD CONSTRAINT "account_deletion_requests_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
