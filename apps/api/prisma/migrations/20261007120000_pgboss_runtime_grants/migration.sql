-- pg-boss queue schema privileges for least-privilege API runtime roles.
-- Production DATABASE_URL uses agency_access_runtime; Neon hardening may use aap_app_runtime.
-- Required when BACKGROUND_WORKERS_ENABLED=true. Idempotent; safe to re-run.

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
    RAISE NOTICE 'Granted pgboss access to %', runtime_role;
  END LOOP;
END $$;

-- Objects created after this migration by the migration role.
DO $$
DECLARE
  runtime_role name;
BEGIN
  FOR runtime_role IN
    SELECT rolname
    FROM pg_roles
    WHERE rolname IN ('agency_access_runtime', 'aap_app_runtime')
  LOOP
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

DO $$
DECLARE
  owner_role name;
  runtime_role name;
BEGIN
  FOR owner_role IN
    SELECT rolname
    FROM pg_roles
    WHERE rolname IN ('aap_app_migrator', 'neondb_owner')
  LOOP
    FOR runtime_role IN
      SELECT rolname
      FROM pg_roles
      WHERE rolname IN ('agency_access_runtime', 'aap_app_runtime')
    LOOP
      BEGIN
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA pgboss GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I',
          owner_role,
          runtime_role
        );
        EXECUTE format(
          'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA pgboss GRANT USAGE, SELECT ON SEQUENCES TO %I',
          owner_role,
          runtime_role
        );
      EXCEPTION
        WHEN insufficient_privilege THEN
          RAISE NOTICE 'Skipping default privileges for owner % → runtime % (insufficient privilege)',
            owner_role,
            runtime_role;
      END;
    END LOOP;
  END LOOP;
END $$;
