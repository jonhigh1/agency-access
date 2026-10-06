import { describe, expect, it } from 'vitest';
import { sanitizeMetaPageEngagementProofForDisplay } from '../sanitize-page-engagement-proof';

describe('sanitizeMetaPageEngagementProofForDisplay', () => {
  it('keeps only post ids and dates and caps at three posts', () => {
    const proof = {
      page: { id: 'page_1', name: 'Main Page', managedTasks: [] },
      posts: [
        { id: 'p1', createdTime: '2026-01-01T00:00:00+0000', message: 'secret caption' } as {
          id: string;
          createdTime: string;
          message: string;
        },
        { id: 'p2', createdTime: '2026-01-02T00:00:00+0000', story: 'secret story' } as {
          id: string;
          createdTime: string;
          story: string;
        },
        { id: 'p3', createdTime: '2026-01-03T00:00:00+0000' },
        { id: 'p4', createdTime: '2026-01-04T00:00:00+0000' },
      ],
    };

    const sanitized = sanitizeMetaPageEngagementProofForDisplay(proof);

    expect(sanitized.posts).toEqual([
      { id: 'p1', createdTime: '2026-01-01T00:00:00+0000' },
      { id: 'p2', createdTime: '2026-01-02T00:00:00+0000' },
      { id: 'p3', createdTime: '2026-01-03T00:00:00+0000' },
    ]);
    expect(JSON.stringify(sanitized)).not.toContain('secret');
  });
});
