import { describe, expect, it } from '@jest/globals';
import {
  REVIEW_DEMO_STEP_ORDER,
  hasLabReviewAccess,
  ReviewDemoStepPayloadSchema,
} from '../review-demo.js';

describe('review-demo shared helpers', () => {
  it('grants lab access for labRole reviewer or agency and lab:true', () => {
    expect(hasLabReviewAccess({ labRole: 'reviewer' })).toBe(true);
    expect(hasLabReviewAccess({ labRole: 'agency' })).toBe(true);
    expect(hasLabReviewAccess({ lab: true })).toBe(true);
    expect(hasLabReviewAccess({ labRole: 'member' })).toBe(false);
    expect(hasLabReviewAccess(null)).toBe(false);
  });

  it('orders review steps across the four core permissions', () => {
    expect(REVIEW_DEMO_STEP_ORDER).toEqual([
      'pages_show_list',
      'pages_read_engagement',
      'ads_management',
      'business_management',
    ]);
  });

  it('validates discriminated step payloads', () => {
    const parsed = ReviewDemoStepPayloadSchema.safeParse({
      stepId: 'pages_show_list',
      pages: [{ id: '1', name: 'AuthHub Review Page' }],
      graphCaptions: ['GET /me/accounts'],
    });
    expect(parsed.success).toBe(true);
  });
});
