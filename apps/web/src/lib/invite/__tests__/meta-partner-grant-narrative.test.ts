import { describe, expect, it } from 'vitest';
import {
  buildMetaPartnerGrantNarrative,
  META_GRANT_AUTOMATION_LABEL,
  resolveMetaGrantAutomationMode,
} from '../meta-partner-grant-narrative';

describe('meta-partner-grant-narrative', () => {
  it('labels Pages automatic and ad accounts manual', () => {
    expect(resolveMetaGrantAutomationMode('page')).toBe('automatic');
    expect(resolveMetaGrantAutomationMode('ad_account')).toBe('manual');
    expect(META_GRANT_AUTOMATION_LABEL.automatic).toBe('Automatic');
    expect(META_GRANT_AUTOMATION_LABEL.manual).toBe('Manual');
  });

  it('calls out agency Partner Business Portfolio id in narrative copy', () => {
    const narrative = buildMetaPartnerGrantNarrative({
      agencyBusinessId: '3808519629379919',
      agencyBusinessName: 'Outdoor DIY',
      clientBusinessId: 'biz_client_2',
      clientBusinessName: 'DogTimez Retail',
    });

    expect(narrative.headline).toMatch(/Partner/i);
    expect(narrative.oauthOrchestrationNote).toMatch(/orchestr/i);
    expect(narrative.revokeNote).toMatch(/remove the Partner/i);
    expect(narrative.agencyPartnerLine).toContain('3808519629379919');
    expect(narrative.agencyPartnerLine).toMatch(/Partner recipient/i);
    expect(narrative.clientPortfolioLine).toContain('biz_client_2');
    expect(narrative.discoveryNote).not.toMatch(/business_management/i);
    expect(narrative.discoveryNote).toMatch(/Business Portfolio/i);
    expect(narrative.zeroPortfolioPagesNote).not.toMatch(/pages_show_list/i);
    expect(narrative.zeroPortfolioPagesNote).toMatch(/Facebook profile/i);
  });
});
