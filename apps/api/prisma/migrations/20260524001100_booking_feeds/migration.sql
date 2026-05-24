CREATE TABLE "booking_feeds" (
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "token_encrypted" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotated_at" TIMESTAMP(3),

  CONSTRAINT "booking_feeds_pkey" PRIMARY KEY ("user_id")
);

CREATE UNIQUE INDEX "booking_feeds_token_hash_key" ON "booking_feeds"("token_hash");

ALTER TABLE "booking_feeds"
ADD CONSTRAINT "booking_feeds_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
