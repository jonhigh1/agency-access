BEGIN;

CREATE TABLE "meta_asset_creations" (
    "id" TEXT NOT NULL,
    "access_request_id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "authorization_id" TEXT,
    "asset_type" TEXT NOT NULL,
    "parent_asset_id" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "intent_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "result" JSONB,
    "last_error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_asset_creations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "meta_asset_creations_access_request_id_idempotency_key_key"
    ON "meta_asset_creations"("access_request_id", "idempotency_key");
CREATE INDEX "meta_asset_creations_connection_id_asset_type_status_idx"
    ON "meta_asset_creations"("connection_id", "asset_type", "status");
CREATE INDEX "meta_asset_creations_authorization_id_idx"
    ON "meta_asset_creations"("authorization_id");

ALTER TABLE "meta_asset_creations"
    ADD CONSTRAINT "meta_asset_creations_access_request_id_fkey"
    FOREIGN KEY ("access_request_id") REFERENCES "access_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meta_asset_creations"
    ADD CONSTRAINT "meta_asset_creations_connection_id_fkey"
    FOREIGN KEY ("connection_id") REFERENCES "client_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "meta_asset_creations"
    ADD CONSTRAINT "meta_asset_creations_authorization_id_fkey"
    FOREIGN KEY ("authorization_id") REFERENCES "platform_authorizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
