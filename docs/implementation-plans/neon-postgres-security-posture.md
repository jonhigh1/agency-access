# Neon Postgres Security Posture

This runbook defines the production security posture for our Neon Postgres deployment without breaking active workflows.

## Implemented in App Code

1. Production `DATABASE_URL` must use `postgres://` or `postgresql://`.
2. Production `DATABASE_URL` must enforce TLS with `sslmode=require` (or `verify-ca` / `verify-full`).
3. Optional least-privilege guard:
   - `DB_ENFORCE_LEAST_PRIVILEGE=true` blocks elevated DB users (`postgres`, `neondb_owner`, `root`, `admin`).
4. Validation command:
   - `cd apps/api && npm run db:security:check`

## Neon Hardening SQL Assets

1. Roles and grants (safe first step):
   - `apps/api/prisma/security/001_neon_roles_and_grants.sql`
2. Tenant RLS (staged, only after app/session strategy is verified):
   - `apps/api/prisma/security/002_enable_tenant_rls.sql`

## Execution Plan

1. Run role/grant hardening in staging as owner role.
2. Create Neon credentials for:
   - `aap_app_runtime` (app traffic)
   - `aap_app_migrator` (schema/migrations)
   - `aap_app_readonly` (analytics/support read paths)
3. Rotate production app credentials to `aap_app_runtime`.
4. Set `DB_ENFORCE_LEAST_PRIVILEGE=true` in production.
5. Validate:
   - `npm run db:security:check`
   - API smoke tests + onboarding/connections flows
6. Roll out RLS only after request/session strategy is in place for `app.current_agency_id`.

## Required Neon Settings

1. Enforce TLS (Neon default; verify connection strings include `sslmode=require`).
2. Restrict network access with Neon trusted IPs for production environments.
3. Keep separate Neon roles for runtime vs migration.
4. Enable backup/restore drills on a recurring schedule.

## Verification Checklist

1. Runtime credentials cannot run DDL.
2. `PUBLIC` cannot create objects in `public` schema.
3. Runtime app can only read/write required schema objects (including `pgboss` when background workers are enabled — see Prisma migration `20261007120000_pgboss_runtime_grants`, which covers production `agency_access_runtime` and optional `aap_app_runtime`).
4. Readonly role can only `SELECT`.
5. Production startup fails if TLS is not enforced in `DATABASE_URL`.

## Rollback

1. Credential rollback: switch runtime credential back to previous role.
2. Privilege rollback: re-grant minimal required permissions temporarily.
3. RLS rollback (if enabled): `ALTER TABLE ... DISABLE ROW LEVEL SECURITY` on affected tables.
