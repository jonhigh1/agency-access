import type { MetaPageEngagementProof } from '@agency-platform/shared';

const MAX_PUBLIC_POST_DATES = 3;

/** Drop post text fields and cap dates for pages_read_engagement validation display. */
export function sanitizeMetaPageEngagementProofForDisplay(
  proof: MetaPageEngagementProof
): MetaPageEngagementProof {
  return {
    ...proof,
    posts: proof.posts.slice(0, MAX_PUBLIC_POST_DATES).map((post) => ({
      id: post.id,
      ...(post.createdTime ? { createdTime: post.createdTime } : {}),
    })),
  };
}
