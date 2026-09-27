BEGIN;

ALTER TABLE "platform_authorizations"
  ADD COLUMN "authorization_epoch" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "meta_asset_grants"
  ADD COLUMN "recipient_type" TEXT,
  ADD COLUMN "recipient_id" TEXT,
  ADD COLUMN "verified_authorization_epoch" INTEGER;

UPDATE "meta_asset_grants" AS g
SET
  "recipient_type" = 'business',
  "recipient_id" = destination."business_id"
FROM "meta_agency_destinations" AS destination
WHERE destination."id" = g."destination_id";

UPDATE "meta_asset_grants" AS g
SET "verified_authorization_epoch" = a."authorization_epoch"
FROM "platform_authorizations" AS a
WHERE a."id" = g."authorization_id"
  AND g."status" = 'verified';

ALTER TABLE "meta_asset_grants"
  ALTER COLUMN "recipient_type" SET NOT NULL,
  ALTER COLUMN "recipient_id" SET NOT NULL;

DROP INDEX "meta_asset_grants_idempotency_key";

CREATE UNIQUE INDEX "meta_asset_grants_idempotency_key"
  ON "meta_asset_grants"(
    "access_request_id",
    "destination_id",
    "client_business_id",
    "asset_kind",
    "asset_id",
    "recipient_type",
    "recipient_id"
  );

COMMIT;
