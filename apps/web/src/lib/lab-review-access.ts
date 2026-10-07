import { hasLabReviewAccess } from '@agency-platform/shared';

function getLabUserIds(): string[] {
  return (process.env.NEXT_PUBLIC_META_REVIEW_LAB_USER_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isReviewDemoRouteEnabled(): boolean {
  return process.env.NEXT_PUBLIC_META_REVIEW_DEMO_ENABLED === 'true';
}

export function hasLabReviewAccessForClerkUser(user: {
  id: string;
  publicMetadata?: unknown;
} | null | undefined): boolean {
  if (!user) return false;
  if (getLabUserIds().includes(user.id)) return true;
  return hasLabReviewAccess(user.publicMetadata);
}
