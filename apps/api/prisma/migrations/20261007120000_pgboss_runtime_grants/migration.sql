-- pg-boss queue schema privileges for the Neon runtime role.
-- Required when DATABASE_URL uses least-privilege credentials (aap_app_runtime)
-- and BACKGROUND_WORKERS_ENABLED=true. Idempotent; safe to re-run.

CREATE SCHEMA IF NOT EXISTS pgboss;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aap_app_runtime') THEN
    RAISE NOTICE 'aap_app_runtime role not found; skipping pgboss runtime grants';
    RETURN;
  END IF;

  GRANT USAGE ON SCHEMA pgboss TO aap_app_runtime;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss TO aap_app_runtime;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pgboss TO aap_app_runtime;
END $$;

-- Objects created after this migration by the migration role.
ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aap_app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss
  GRANT USAGE, SELECT ON SEQUENCES TO aap_app_runtime;

DO $$
DECLARE
  owner_role name;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'aap_app_runtime') THEN
    RETURN;
  END IF;

  FOR owner_role IN
    SELECT rolname
    FROM pg_roles
    WHERE rolname IN ('aap_app_migrator', 'neondb_owner')
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA pgboss GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO aap_app_runtime',
        owner_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA pgboss GRANT USAGE, SELECT ON SEQUENCES TO aap_app_runtime',
        owner_role
      );
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping default privileges for role % (insufficient privilege)', owner_role;
    END;
  END LOOP;
END $$;
