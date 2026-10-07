/**
 * One-off: copy the lab review-demo Meta token into Infisical meta_tier_cron_token.
 * Idempotent — skips when the cron secret already has an access token.
 *
 * Usage (from repo root):
 *   npm run seed:meta-tier-cron-token --workspace=apps/api
 */
import { seedMetaTierCronTokenFromReviewDemo } from '../src/services/meta-tier-cron-token.service.js';

async function main(): Promise<void> {
  const result = await seedMetaTierCronTokenFromReviewDemo();
  console.log(
    JSON.stringify({
      seeded: result.seeded,
      alreadyPresent: result.alreadyPresent,
      sourceClerkUserId: result.sourceClerkUserId,
      ...(result.reason ? { reason: result.reason } : {}),
    })
  );
  if (!result.seeded && !result.alreadyPresent) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'seed failed');
  process.exitCode = 1;
});
