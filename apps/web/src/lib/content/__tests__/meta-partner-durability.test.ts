import { describe, expect, it } from 'vitest';
import {
  META_AGENCY_SETTINGS_PARTNER_COPY,
  META_AUTOMATION_MATRIX_LINES,
  META_PARTNER_DURABILITY,
} from '../meta-partner-durability';

describe('meta-partner-durability copy', () => {
  it('separates OAuth orchestration from durable Partner access and names revoke', () => {
    expect(META_PARTNER_DURABILITY.oauthOrchestration).toMatch(/orchestr/i);
    expect(META_PARTNER_DURABILITY.oauthOrchestration).toMatch(/expire/i);
    expect(META_PARTNER_DURABILITY.oauthOrchestration).not.toMatch(/revoke Partner/i);
    expect(META_PARTNER_DURABILITY.revokePartner).toMatch(/remove the Partner/i);
    expect(META_PARTNER_DURABILITY.revokePartner).toMatch(/does not by itself revoke/i);
  });

  it('automation matrix labels Pages automatic and ad accounts manual', () => {
    const pages = META_AUTOMATION_MATRIX_LINES.find((row) => row.asset.includes('Pages'));
    const adAccounts = META_AUTOMATION_MATRIX_LINES.find((row) => row.asset.includes('Ad accounts'));
    expect(pages?.mode).toBe('automatic');
    expect(adAccounts?.mode).toBe('manual');
    expect(JSON.stringify(META_AUTOMATION_MATRIX_LINES)).not.toMatch(/catalog_management/i);
    expect(JSON.stringify(META_AUTOMATION_MATRIX_LINES)).not.toMatch(/engager profile/i);
  });

  it('agency settings copy references Partner durability', () => {
    expect(META_AGENCY_SETTINGS_PARTNER_COPY.description).toMatch(/Partner/i);
    expect(META_AGENCY_SETTINGS_PARTNER_COPY.matrixHeading).toMatch(/Automatic vs Manual/i);
  });
});
