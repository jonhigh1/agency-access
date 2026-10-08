import type { ReviewDemoPagePartnerResult } from '@agency-platform/shared';

export function buildBusinessManagementStepCaption(input: {
  pagePartner?: ReviewDemoPagePartnerResult;
  adAccountPartnerVerified: boolean;
}): string {
  if (input.pagePartner?.verified) {
    return 'AuthHub added the agency to the Page as a partner and verified access via Graph readback.';
  }
  if (input.pagePartner?.graphError?.code === 3) {
    return 'Manual ad-account partner share was verified via Graph readback. Page partner add is not available for this app capability.';
  }
  if (input.adAccountPartnerVerified) {
    if (input.pagePartner?.assetId) {
      if (input.pagePartner.pendingMessage) {
        return 'Manual ad-account partner share verified via Graph readback. Page partner status is not checked yet — use Add agency to Page.';
      }
      return 'Manual ad-account partner share verified via Graph readback. Use Add agency to Page to run the production Page partner POST and verify readback.';
    }
    return 'Manual ad-account partner share verified via Graph readback. Use Add agency to Page when a Page is available in this session.';
  }
  return 'Client Business Portfolio assets scoped to this session, manual ad-account partner verification, and optional Page partner add.';
}
