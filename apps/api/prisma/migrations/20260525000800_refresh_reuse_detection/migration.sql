-- Track the most-recently rotated-out refresh hash so we can detect when a
-- stale (already-rotated) token is replayed — a strong signal that the cookie
-- was stolen and is being reused after the legitimate client moved on.
ALTER TABLE "user_sessions" ADD COLUMN "previous_refresh_token_hash" TEXT;

CREATE INDEX "user_sessions_previous_refresh_token_hash_idx" ON "user_sessions"("previous_refresh_token_hash");
