import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = join(
  import.meta.dirname,
  '../20261007120000_pgboss_runtime_grants/migration.sql'
);

describe('pgboss runtime grants migration', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it('creates the pgboss schema when missing', () => {
    expect(sql).toMatch(/CREATE SCHEMA IF NOT EXISTS pgboss/i);
  });

  it('grants runtime role usage on pgboss schema', () => {
    expect(sql).toMatch(/GRANT USAGE ON SCHEMA pgboss TO aap_app_runtime/i);
  });

  it('grants runtime role DML on pgboss tables', () => {
    expect(sql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA pgboss TO aap_app_runtime/i
    );
  });

  it('grants runtime role sequence access in pgboss', () => {
    expect(sql).toMatch(
      /GRANT USAGE(?:, SELECT)? ON ALL SEQUENCES IN SCHEMA pgboss TO aap_app_runtime/i
    );
  });

  it('skips grants safely when the runtime role is absent', () => {
    expect(sql).toMatch(/IF NOT EXISTS \(SELECT 1 FROM pg_roles WHERE rolname = 'aap_app_runtime'\)/i);
  });
});
