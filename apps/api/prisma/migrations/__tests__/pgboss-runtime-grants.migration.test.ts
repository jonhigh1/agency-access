import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
  import.meta.dirname,
  '../20261007120000_pgboss_runtime_grants/migration.sql'
);

const RUNTIME_ROLES = ['agency_access_runtime', 'aap_app_runtime'] as const;

describe('pgboss runtime grants migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('creates the pgboss schema when missing', () => {
    expect(sql).toMatch(/CREATE SCHEMA IF NOT EXISTS pgboss/i);
  });

  it.each(RUNTIME_ROLES)('includes %s in the runtime role grant loop', (role) => {
    expect(sql).toMatch(
      new RegExp(
        `WHERE rolname IN \\('agency_access_runtime', 'aap_app_runtime'\\)[\\s\\S]*${role}`,
        'i'
      )
    );
  });

  it('grants schema usage, table DML, and sequence access via dynamic grants', () => {
    expect(sql).toMatch(/GRANT USAGE ON SCHEMA pgboss TO %I/i);
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss TO %I/i
    );
    expect(sql).toMatch(/GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA pgboss TO %I/i);
  });

  it('only targets known runtime roles (no silent hardcoded single-role skip)', () => {
    expect(sql).not.toMatch(
      /IF NOT EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'aap_app_runtime'\)\s+THEN\s+RETURN/i
    );
    expect(sql).not.toMatch(
      /IF NOT EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'agency_access_runtime'\)\s+THEN\s+RETURN/i
    );
  });
});
