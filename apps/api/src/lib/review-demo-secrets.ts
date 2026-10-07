import { META_TIER_CRON_TOKEN_SECRET_NAME } from '@agency-platform/shared';

export function reviewDemoMetaSecretName(clerkUserId: string): string {
  return `review_demo_meta_${clerkUserId}`;
}

export function metaTierCronTokenSecretName(): string {
  return META_TIER_CRON_TOKEN_SECRET_NAME;
}
