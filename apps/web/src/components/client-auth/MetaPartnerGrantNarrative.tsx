'use client';

import type { MetaAssetKind } from '@agency-platform/shared';
import {
  buildMetaPartnerGrantNarrative,
  META_GRANT_AUTOMATION_LABEL,
  resolveMetaGrantAutomationMode,
} from '@/lib/invite/meta-partner-grant-narrative';

const KIND_LABEL: Record<MetaAssetKind, string> = {
  ad_account: 'Ad accounts',
  page: 'Pages',
  instagram_account: 'Instagram accounts',
  catalog: 'Catalogs',
  dataset: 'Pixels & datasets',
  unknown: 'Other assets',
};

interface MetaPartnerGrantNarrativeProps {
  agencyBusinessId: string | null;
  agencyBusinessName?: string | null;
  clientBusinessId?: string | null;
  clientBusinessName?: string | null;
  /** Asset kinds selected or present on the grant checklist. */
  selectedKinds: MetaAssetKind[];
  /** When true, show the zero-portfolio / user-Pages distinction note. */
  showZeroPortfolioNote?: boolean;
}

function AutomationBadge({ mode }: { mode: 'automatic' | 'manual' }) {
  const isAutomatic = mode === 'automatic';
  return (
    <span
      className={
        isAutomatic
          ? 'inline-flex items-center rounded border border-[rgb(var(--teal))] bg-[rgb(var(--teal))]/10 px-2 py-0.5 text-xs font-semibold text-success-ink'
          : 'inline-flex items-center rounded border border-black bg-muted/30 px-2 py-0.5 text-xs font-semibold text-ink dark:border-white'
      }
    >
      {META_GRANT_AUTOMATION_LABEL[mode]}
    </span>
  );
}

export function MetaPartnerGrantNarrative({
  agencyBusinessId,
  agencyBusinessName,
  clientBusinessId,
  clientBusinessName,
  selectedKinds,
  showZeroPortfolioNote = false,
}: MetaPartnerGrantNarrativeProps) {
  const narrative = buildMetaPartnerGrantNarrative({
    agencyBusinessId,
    agencyBusinessName,
    clientBusinessId,
    clientBusinessName,
  });

  const uniqueKinds = Array.from(new Set(selectedKinds)).filter(
    (kind) => kind !== 'unknown'
  );

  return (
    <section
      aria-label="Partner access narrative"
      className="border-l-2 border-black bg-[rgb(var(--card))] p-4 space-y-3 dark:border-white"
    >
      <div>
        <p className="label-micro">How your agency gets access</p>
        <h3 className="mt-1 font-display text-base font-bold text-ink">{narrative.headline}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{narrative.body}</p>
        <p className="mt-2 text-sm text-muted-foreground">{narrative.oauthOrchestrationNote}</p>
        <p className="mt-2 text-sm text-muted-foreground">{narrative.revokeNote}</p>
      </div>

      {narrative.clientPortfolioLine ? (
        <p className="text-sm font-medium text-ink">{narrative.clientPortfolioLine}</p>
      ) : null}

      {narrative.agencyPartnerLine ? (
        <p className="text-sm font-medium text-ink">{narrative.agencyPartnerLine}</p>
      ) : agencyBusinessId === null ? (
        <p className="text-sm text-muted-foreground" role="status">
          Loading agency Business Portfolio ID…
        </p>
      ) : null}

      {uniqueKinds.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {uniqueKinds.map((kind) => {
            const mode = resolveMetaGrantAutomationMode(kind);
            return (
              <li key={kind} className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-ink">{KIND_LABEL[kind]}</span>
                <AutomationBadge mode={mode} />
                {mode === 'manual' ? (
                  <span className="text-xs text-muted-foreground">
                    Partner share in Meta Business Settings
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="text-xs text-muted-foreground">{narrative.discoveryNote}</p>
      {showZeroPortfolioNote ? (
        <p className="text-xs text-muted-foreground">{narrative.zeroPortfolioPagesNote}</p>
      ) : null}
    </section>
  );
}
