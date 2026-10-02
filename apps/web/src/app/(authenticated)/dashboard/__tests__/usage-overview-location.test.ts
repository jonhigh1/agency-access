// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const dashboardPagePath = path.resolve(__dirname, '../page.tsx');
const settingsPagePath = path.resolve(__dirname, '../../settings/page.tsx');
const usageOverviewCardPath = path.resolve(
  __dirname,
  '../../../../components/settings/usage-overview-card.tsx'
);

function readFile(filePath: string) {
  return fs.readFileSync(filePath, 'utf-8');
}

describe('Usage Overview placement and routing', () => {
  it('does not render Usage Overview on dashboard page', () => {
    const dashboardCode = readFile(dashboardPagePath);

    expect(dashboardCode).not.toContain('Usage Overview');
    expect(dashboardCode).not.toContain('/settings/billing');
  });

  it('renders Usage Overview from settings page', () => {
    const settingsCode = readFile(settingsPagePath);

    expect(settingsCode).toContain('UsageOverviewCard');
  });

  it('uses settings billing tab query route for usage details', () => {
    const usageOverviewCardCode = readFile(usageOverviewCardPath);

    expect(usageOverviewCardCode).toContain('/settings?tab=billing');
    expect(usageOverviewCardCode).not.toContain('/settings/billing');
  });
});
