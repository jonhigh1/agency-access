-- Query-shape indexes for expiry scans and audit-trail reads.
-- Do not apply this migration to a live production database from this PR.

CREATE INDEX "platform_authorizations_status_expires_at_idx"
  ON "platform_authorizations"("status", "expires_at");

CREATE INDEX "access_requests_status_expires_at_idx"
  ON "access_requests"("status", "expires_at");

CREATE INDEX "audit_logs_resource_type_resource_id_created_at_idx"
  ON "audit_logs"("resource_type", "resource_id", "created_at");
