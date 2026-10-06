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
      className="space-y-4 border border-black/20 bg-[rgb(var(--card))] p-5 dark:border-white/20"
    >
      <div className="space-y-2">
        <p className="label-micro">How your agency gets access</p>
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
      </div>

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

      <details className="group border-t border-black/10 pt-3 dark:border-white/10">
        <summary className="cursor-pointer text-sm font-semibold text-ink marker:content-none list-none [&::-webkit-details-marker]:hidden">
          <span className="underline decoration-black/20 underline-offset-2 group-open:decoration-coral dark:decoration-white/30">
            How access stays durable on Meta
          </span>
        </summary>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <p className="font-display text-base font-bold text-ink">{narrative.headline}</p>
          <p>{narrative.body}</p>
          <p>{narrative.oauthOrchestrationNote}</p>
          <p>{narrative.revokeNote}</p>
          {showZeroPortfolioNote ? <p>{narrative.zeroPortfolioPagesNote}</p> : null}
        </div>
      </details>
    </section>
  );
}
