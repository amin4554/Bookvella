-- Add richer public profile fields and Google identity linkage.
ALTER TABLE "users" ADD COLUMN "google_sub" TEXT;
ALTER TABLE "users" ADD COLUMN "profile_image_url" TEXT;
ALTER TABLE "users" ADD COLUMN "cover_image_url" TEXT;
ALTER TABLE "users" ADD COLUMN "headline" TEXT;
ALTER TABLE "users" ADD COLUMN "business_category" TEXT;
ALTER TABLE "users" ADD COLUMN "location" TEXT;
ALTER TABLE "users" ADD COLUMN "about" TEXT;
ALTER TABLE "users" ADD COLUMN "what_to_expect" TEXT;
ALTER TABLE "users" ADD COLUMN "website_url" TEXT;
ALTER TABLE "users" ADD COLUMN "instagram_url" TEXT;

CREATE UNIQUE INDEX "users_google_sub_key" ON "users"("google_sub");

ALTER TABLE "event_types" ADD COLUMN "category" TEXT;
ALTER TABLE "event_types" ADD COLUMN "what_included" TEXT;
ALTER TABLE "event_types" ADD COLUMN "location_details" TEXT;
