-- U4 write foundations, EXPAND half (KTD4, KTD5, KTD7).
-- Additive only: no existing row is modified and no guard is dropped.
-- The webhook singleton keeps its webhook_endpoints_agency_id_key unique
-- guard; the CONTRACT step (drop that guard, add plural guards) lands with
-- U6 alongside the plural service code, when rollback becomes code-only.
-- Existing singleton rows survive untouched as the future first records.

-- KTD4: agency-scoped immutable external client ID. Nullable, so multiple
-- NULLs need no backfill; Postgres NULLs never conflict in a unique index.
ALTER TABLE "clients" ADD COLUMN "external_client_id" TEXT;

CREATE UNIQUE INDEX "clients_agency_id_external_client_id_key"
    ON "clients"("agency_id", "external_client_id");

-- KTD5: generic idempotency claims. The atomic claim is a single insert
-- against the composite unique guard; losers read the winner row.
CREATE TABLE "idempotency_records" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "key_identity" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "idem_key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "status_code" INTEGER,
    "result" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_records_agency_id_key_identity_endpoint_idem_key_key"
    ON "idempotency_records"("agency_id", "key_identity", "endpoint", "idem_key");
CREATE INDEX "idempotency_records_expires_at_state_idx"
    ON "idempotency_records"("expires_at", "state");

-- KTD7 expand: dual-secret rotation overlap columns. New-then-old
-- verification and overlap expiry enforcement land with U6.
ALTER TABLE "webhook_endpoints" ADD COLUMN "pending_secret_id" TEXT;
ALTER TABLE "webhook_endpoints" ADD COLUMN "pending_secret_expires_at" TIMESTAMP(3);

-- KTD7 expand: per-endpoint ordering primitive plus cross-endpoint dedupe key.
-- NULL sequence numbers on pre-existing rows never conflict; U6 backfills.
ALTER TABLE "webhook_events" ADD COLUMN "sequence_number" BIGINT;
ALTER TABLE "webhook_events" ADD COLUMN "correlation_id" TEXT;

CREATE UNIQUE INDEX "webhook_events_endpoint_id_sequence_number_key"
    ON "webhook_events"("endpoint_id", "sequence_number");
CREATE INDEX "webhook_events_correlation_id_idx"
    ON "webhook_events"("correlation_id");

-- Per-endpoint monotonic sequence drawn from one Postgres sequence object.
-- Values are globally unique, hence unique per endpoint. Gaps are expected
-- (rolled-back nextval calls never reuse) and consumers must tolerate them;
-- ordering uses comparison, never contiguity.
CREATE SEQUENCE "webhook_endpoint_sequence";

-- Verification queries (run post-deploy; both must return zero rows):
-- 1. Zero duplicate non-null external IDs per agency:
--    SELECT "agency_id", "external_client_id", COUNT(*)
--      FROM "clients" WHERE "external_client_id" IS NOT NULL
--      GROUP BY 1, 2 HAVING COUNT(*) > 1;
-- 2. Purge exemption holds: no in-progress claim past expiry is collectible:
--    SELECT COUNT(*) FROM "idempotency_records"
--      WHERE "expires_at" <= NOW() AND "state" = 'in_progress';
--    (informational; purgeExpired() filters state <> 'in_progress' regardless)
-- 3. Singleton intact: exactly the pre-migration row count in webhook_endpoints:
--    SELECT COUNT(*) FROM "webhook_endpoints";
