-- U6 webhook pluralization, CONTRACT half (KTD7; R13–R16).
-- The EXPAND half (20261009120000) kept the singleton
-- webhook_endpoints_agency_id_key guard. This step:
--   1. backfills the U4-expand ordering primitives on pre-U6 event rows so
--      every row carries a sequence number and correlation ID;
--   2. verifies one-record-per-agency (queries below; zero rows required);
--   3. drops the singleton unique and adds the plural (agency, url) guard.
-- After this step rollback is code-only: re-adding the singleton guard
-- requires deleting plural rows first, which this migration never does.

-- 1. Backfill pre-U6 rows. nextval() assigns per row; gaps from rolled-back
-- calls are expected and tolerated by consumers (order by comparison).
UPDATE "webhook_events"
   SET "sequence_number" = nextval('"webhook_endpoint_sequence"')
 WHERE "sequence_number" IS NULL;

UPDATE "webhook_events"
   SET "correlation_id" = 'corr_backfill_' || "id"
 WHERE "correlation_id" IS NULL;

-- 2. Verification queries (run pre-deploy; every one must return zero rows):
--  a. At most one endpoint per agency (singleton intact pre-contract):
--     SELECT "agency_id", COUNT(*)
--       FROM "webhook_endpoints"
--      GROUP BY 1 HAVING COUNT(*) > 1;
--  b. No duplicate (agency, url) pairs (plural guard will hold):
--     SELECT "agency_id", "url", COUNT(*)
--       FROM "webhook_endpoints"
--      GROUP BY 1, 2 HAVING COUNT(*) > 1;
--  c. Ordering primitives fully backfilled:
--     SELECT COUNT(*) FROM "webhook_events"
--      WHERE "sequence_number" IS NULL OR "correlation_id" IS NULL;

-- 3. Contract: singleton unique -> plural guards.
ALTER TABLE "webhook_endpoints" DROP CONSTRAINT "webhook_endpoints_agency_id_key";

ALTER TABLE "webhook_endpoints"
    ADD CONSTRAINT "webhook_endpoints_agency_id_url_key" UNIQUE ("agency_id", "url");
