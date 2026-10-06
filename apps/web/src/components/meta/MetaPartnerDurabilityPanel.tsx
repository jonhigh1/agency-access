'use client';

import {
  META_AGENCY_SETTINGS_PARTNER_COPY,
  META_AUTOMATION_MATRIX_LINES,
} from '@/lib/content/meta-partner-durability';
import { META_GRANT_METHOD_LABELS } from '@/lib/content/meta-grant-access';
import { META_PARTNER_GRANT_ADVANCED_COPY } from '@/lib/invite/meta-partner-grant-narrative';
import { ManageAssetsSectionCard } from '@/components/manage-assets-ui';

const CLIENT_MATRIX_DETAIL: Record<string, string> = {
  'Facebook Pages': 'AuthHub assigns partner access and confirms the result.',
  'Ad accounts': 'Assign Partner in Meta Business Settings, then Check access in AuthHub.',
  'Business Portfolio link (client ↔ agency BM)':
    'Manual steps in Meta Business Settings until automatic assignment is available.',
  'Instagram, catalogs, pixels & datasets': 'Partner share or assignment in Meta Business Settings.',
};

export function MetaPartnerDurabilityPanel() {
  return (
    <ManageAssetsSectionCard
      eyebrow={META_AGENCY_SETTINGS_PARTNER_COPY.eyebrow}
      title={META_AGENCY_SETTINGS_PARTNER_COPY.title}
      description={META_AGENCY_SETTINGS_PARTNER_COPY.description}
    >
      <div className="space-y-4 text-sm text-muted-foreground">
        <p className="text-ink">{META_AGENCY_SETTINGS_PARTNER_COPY.oauthNote}</p>
        <p>{META_AGENCY_SETTINGS_PARTNER_COPY.revokeNote}</p>
        <div>
          <p className="label-micro text-ink">{META_AGENCY_SETTINGS_PARTNER_COPY.matrixHeading}</p>
          <ul className="mt-2 space-y-2">
            {META_AUTOMATION_MATRIX_LINES.map((row) => (
              <li key={row.asset} className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium text-ink">{row.asset}</span>
                <span
                  className={
                    row.mode === 'automatic'
                      ? 'rounded border border-[rgb(var(--teal))] bg-[rgb(var(--teal))]/10 px-2 py-0.5 text-xs font-semibold text-success-ink'
                      : 'rounded border border-black bg-muted/30 px-2 py-0.5 text-xs font-semibold text-ink dark:border-white'
                  }
                >
                  {META_GRANT_METHOD_LABELS[row.mode]}
                </span>
                <span className="text-xs">{CLIENT_MATRIX_DETAIL[row.asset] ?? row.detail}</span>
              </li>
            ))}
          </ul>
        </div>
        <details className="border-t border-black/10 pt-3 dark:border-white/10">
          <summary className="cursor-pointer text-xs font-semibold text-ink">Advanced (Graph paths)</summary>
          <ul className="mt-2 space-y-2 text-xs">
            <li>{META_PARTNER_GRANT_ADVANCED_COPY.automationMatrixDetail.pages}</li>
            <li>{META_PARTNER_GRANT_ADVANCED_COPY.automationMatrixDetail.adAccounts}</li>
            <li>{META_PARTNER_GRANT_ADVANCED_COPY.automationMatrixDetail.portfolioLink}</li>
            <li>{META_PARTNER_GRANT_ADVANCED_COPY.businessScopedDiscovery}</li>
          </ul>
        </details>
      </div>
    </ManageAssetsSectionCard>
  );
}
