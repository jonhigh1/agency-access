import { describe, expect, it } from 'vitest';
import { buildBusinessManagementStepCaption } from '../review-demo-business-caption.js';

describe('buildBusinessManagementStepCaption', () => {
  it('does not say "when a Page is connected" when a Page asset is in the session', () => {
    const caption = buildBusinessManagementStepCaption({
      adAccountPartnerVerified: true,
      pagePartner: {
        businessId: 'bm-1',
        assetId: 'page-1',
        assetKind: 'page',
        permittedTasks: [],
        verified: false,
      },
    });

    expect(caption).not.toMatch(/when a Page is connected/i);
    expect(caption).toContain('Add agency to Page');
  });
});
