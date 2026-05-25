-- Hard ceiling on a session's lifetime. Sliding refresh can push `expires_at`
-- forward but never past this. Without it, a session could be kept alive
-- indefinitely by continuous refresh activity.
ALTER TABLE "user_sessions"
  ADD COLUMN "absolute_expires_at" TIMESTAMP(3);

-- Backfill existing rows: cap them at the smaller of (created_at + 180 days,
-- the existing expires_at) so we don't suddenly shrink active sessions.
UPDATE "user_sessions"
SET "absolute_expires_at" = GREATEST(
  "expires_at",
  "created_at" + INTERVAL '180 days'
)
WHERE "absolute_expires_at" IS NULL;

ALTER TABLE "user_sessions"
  ALTER COLUMN "absolute_expires_at" SET NOT NULL;
