-- Tracks whether the original sign-in opted into "Keep me signed in". Existing
-- sessions default to TRUE to preserve current behaviour for users already
-- signed in before this column existed.
ALTER TABLE "user_sessions" ADD COLUMN "remember_me" BOOLEAN NOT NULL DEFAULT true;
