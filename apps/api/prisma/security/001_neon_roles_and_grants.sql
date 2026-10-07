-- Neon Postgres Hardening: Roles and Least Privilege Grants
-- Run as a privileged owner role (for example, neondb_owner) in staging first.
-- This script is idempotent and safe to re-run.

BEGIN;

CREATE SCHEMA IF NOT EXISTS app;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aap_app_runtime') THEN
    CREATE ROLE aap_app_runtime LOGIN NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aap_app_migrator') THEN
    CREATE ROLE aap_app_migrator LOGIN NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aap_app_readonly') THEN
    CREATE ROLE aap_app_readonly LOGIN NOINHERIT;
  END IF;
END $$;

-- Lock down default public access.
DO $$
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO aap_app_runtime', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO aap_app_migrator', current_database());
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO aap_app_readonly', current_database());
END $$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

GRANT USAGE ON SCHEMA public TO aap_app_runtime;
GRANT USAGE ON SCHEMA public TO aap_app_migrator;
GRANT USAGE ON SCHEMA public TO aap_app_readonly;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO aap_app_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO aap_app_runtime;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO aap_app_migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO aap_app_migrator;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO aap_app_migrator;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO aap_app_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO aap_app_readonly;

-- Ensure future objects inherit secure defaults.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aap_app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO aap_app_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON TABLES TO aap_app_migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON SEQUENCES TO aap_app_migrator;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL PRIVILEGES ON FUNCTIONS TO aap_app_migrator;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO aap_app_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO aap_app_readonly;

-- pg-boss job queue (separate schema). Prisma migration 20261007120000_pgboss_runtime_grants
-- applies the same grants in deploy pipelines; keep this block for manual owner-run hardening.
CREATE SCHEMA IF NOT EXISTS pgboss;

DO $$
DECLARE
  runtime_role name;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_roles
    WHERE rolname IN ('agency_access_runtime', 'aap_app_runtime')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA pgboss TO %I', runtime_role);
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss TO %I',
      runtime_role
    );
    EXECUTE format(
      'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pgboss TO %I',
      runtime_role
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
      runtime_role
    );
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT USAGE, SELECT ON SEQUENCES TO %I',
      runtime_role
    );
  END LOOP;
END $$;

COMMIT;
