/**
 * Production ops: run the review-demo Page partner POST + readback using meta_tier_cron_token.
 * Prints raw Meta responses to stdout (no token values).
 *
 * Usage (from repo root, with Infisical env configured):
 *   npm run ops:review-demo-page-partner --workspace=apps/api
 *
 * Optional env:
 *   META_REVIEW_PAGE_ID — Page id (default: env META_REVIEW_PAGE_ID)
 *   META_REVIEW_AGENCY_BM_ID — agency Business Portfolio id
 */
import { env } from '../src/lib/env.js';
import { readMetaTierCronAccessToken } from '../src/services/meta-tier-cron-token.service.js';
import { metaPartnerService } from '../src/services/meta-partner.service.js';
import { REVIEW_DEMO_PAGE_PARTNER_TASKS } from '@agency-platform/shared';

async function main(): Promise<void> {
  const accessToken = await readMetaTierCronAccessToken();
  if (!accessToken) {
    console.error('missing meta_tier_cron_token in Infisical — run seed-meta-tier-cron-token first');
    process.exitCode = 1;
    return;
  }

  const pageId = env.META_REVIEW_PAGE_ID?.trim();
  const agencyBusinessId = env.META_REVIEW_AGENCY_BM_ID?.trim();
  if (!pageId || !agencyBusinessId) {
    console.error('META_REVIEW_PAGE_ID and META_REVIEW_AGENCY_BM_ID must be set');
    process.exitCode = 1;
    return;
  }

  const tasks = [...REVIEW_DEMO_PAGE_PARTNER_TASKS];
  const prior = await metaPartnerService.verifyAgencyPartnerAccess(
    accessToken,
    pageId,
    agencyBusinessId,
    tasks
  );
  console.log(JSON.stringify({ phase: 'readback_before', prior }, null, 2));

  if (prior.verified) {
    console.log(JSON.stringify({ phase: 'skipped_post', reason: 'already_verified' }));
    return;
  }

  try {
    await metaPartnerService.grantAgencyPartnerAccess(
      accessToken,
      pageId,
      agencyBusinessId,
      tasks
    );
    console.log(JSON.stringify({ phase: 'post', success: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(JSON.stringify({ phase: 'post', success: false, raw: message }));
  }

  const after = await metaPartnerService.verifyAgencyPartnerAccess(
    accessToken,
    pageId,
    agencyBusinessId,
    tasks
  );
  console.log(JSON.stringify({ phase: 'readback_after', after }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'ops failed');
  process.exitCode = 1;
});
