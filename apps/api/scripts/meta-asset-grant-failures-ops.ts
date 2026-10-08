/**
 * Read-only prod diagnostics: Meta asset grant failures since a cutoff date.
 * SELECT-only — safe to run on Render with production DATABASE_URL.
 *
 * Usage (from repo root):
 *   npm run ops:meta-asset-grant-failures --workspace=apps/api
 *
 * Optional env:
 *   META_GRANT_FAILURES_SINCE — ISO date (default 2026-09-20)
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';

const DEFAULT_SINCE = '2026-09-20T00:00:00.000Z';

type GrantFailureRow = {
  clientId: string | null;
  assetId: string;
  assetKind: string;
  status: string;
  lastErrorCode: string | null;
  lastErrorMessageSnippet: string | null;
  createdDate: Date;
  updatedDate: Date;
};

async function main(): Promise<void> {
  const sinceRaw = process.env.META_GRANT_FAILURES_SINCE?.trim() || DEFAULT_SINCE;
  const since = new Date(sinceRaw);
  if (Number.isNaN(since.getTime())) {
    console.error(`Invalid META_GRANT_FAILURES_SINCE: ${sinceRaw}`);
    process.exitCode = 1;
    return;
  }

  const rows = await prisma.$queryRaw<GrantFailureRow[]>(Prisma.sql`
    SELECT
      ar.client_id AS "clientId",
      g.asset_id AS "assetId",
      g.asset_kind AS "assetKind",
      g.status AS "status",
      g.last_error_code AS "lastErrorCode",
      LEFT(g.last_error_message, 200) AS "lastErrorMessageSnippet",
      g.created_at::date AS "createdDate",
      g.updated_at::date AS "updatedDate"
    FROM meta_asset_grants AS g
    INNER JOIN access_requests AS ar ON ar.id = g.access_request_id
    WHERE (g.created_at >= ${since} OR g.updated_at >= ${since})
      AND (
        g.status = 'failed'
        OR g.last_error_message ILIKE ${'%#190%'}
        OR g.last_error_message ILIKE ${'%Page Access Token%'}
        OR g.last_error_message ILIKE ${'%verification%fail%'}
        OR g.last_error_code = 'META_ASSET_VERIFICATION_FAILED'
      )
    ORDER BY ar.client_id NULLS LAST, g.updated_at DESC
  `);

  const grouped = new Map<string, number>();
  for (const row of rows) {
    const clientKey = row.clientId ?? '(null client_id)';
    const dateKey = row.updatedDate.toISOString().slice(0, 10);
    const key = `${clientKey}\t${dateKey}`;
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }

  console.log(JSON.stringify({ phase: 'summary', since: since.toISOString(), totalRows: rows.length }, null, 2));
  console.log(JSON.stringify({ phase: 'counts_by_client_and_date', groups: [...grouped.entries()].map(([key, count]) => {
    const [clientId, date] = key.split('\t');
    return { clientId, date, count };
  }) }, null, 2));

  for (const row of rows) {
    console.log(JSON.stringify({ phase: 'row', ...row }, null, 2));
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : 'ops query failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
