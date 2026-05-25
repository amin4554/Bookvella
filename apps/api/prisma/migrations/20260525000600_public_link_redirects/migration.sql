CREATE TABLE "public_link_redirects" (
    "id" TEXT NOT NULL,
    "host_user_id" TEXT NOT NULL,
    "old_host_slug" TEXT NOT NULL,
    "old_event_slug" TEXT,
    "event_type_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "public_link_redirects_pkey" PRIMARY KEY ("id")
);

-- (old_host_slug, old_event_slug) is unique. NULL old_event_slug means a host-level redirect.
-- PostgreSQL treats NULLs as distinct in unique constraints by default, so we mirror the slug
-- shape with a partial index for the host-only rows to keep that case unique too.
CREATE UNIQUE INDEX "public_link_redirects_old_host_slug_old_event_slug_key" ON "public_link_redirects"("old_host_slug", "old_event_slug");

CREATE UNIQUE INDEX "public_link_redirects_old_host_slug_host_only_key" ON "public_link_redirects"("old_host_slug") WHERE "old_event_slug" IS NULL;

CREATE INDEX "public_link_redirects_host_user_id_idx" ON "public_link_redirects"("host_user_id");

ALTER TABLE "public_link_redirects" ADD CONSTRAINT "public_link_redirects_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public_link_redirects" ADD CONSTRAINT "public_link_redirects_event_type_id_fkey" FOREIGN KEY ("event_type_id") REFERENCES "event_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;
