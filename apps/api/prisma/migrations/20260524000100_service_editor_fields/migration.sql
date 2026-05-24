-- Price type enum used by the new service editor wizard.
CREATE TYPE "PriceType" AS ENUM ('FIXED', 'FROM', 'RANGE', 'FREE');

-- Extend event_types with the editor-wizard fields.
ALTER TABLE "event_types"
  ADD COLUMN "price_type" "PriceType" NOT NULL DEFAULT 'FIXED',
  ADD COLUMN "price_max_amount" INTEGER,
  ADD COLUMN "preparation_notes" TEXT,
  ADD COLUMN "gallery_image_urls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "direct_link_only" BOOLEAN NOT NULL DEFAULT false;

-- Existing services with a non-null price keep FIXED.
-- Existing services with NULL price -> treat them as FREE (price-on-request).
UPDATE "event_types" SET "price_type" = 'FREE' WHERE "price_amount" IS NULL;
