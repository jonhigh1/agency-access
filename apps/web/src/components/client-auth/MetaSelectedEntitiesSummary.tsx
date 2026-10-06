'use client';

import {
  buildMetaSelectedIdentityRows,
  formatMetaEntityIdentity,
} from '@/lib/invite/meta-entity-identity';

interface NamedEntity {
  id: string;
  name: string;
}

interface MetaSelectedEntitiesSummaryProps {
  clientBusiness?: NamedEntity | null;
  adAccounts?: NamedEntity[];
  pages?: NamedEntity[];
  instagramAccounts?: NamedEntity[];
  catalogs?: NamedEntity[];
  datasets?: NamedEntity[];
}

export function MetaSelectedEntitiesSummary(props: MetaSelectedEntitiesSummaryProps) {
  const rows = buildMetaSelectedIdentityRows({
    clientBusiness: props.clientBusiness ?? null,
    adAccounts: props.adAccounts,
    pages: props.pages,
    instagramAccounts: props.instagramAccounts,
    catalogs: props.catalogs,
    datasets: props.datasets,
  });

  if (rows.length === 0) return null;

  return (
    <section
      aria-label="Selected Meta assets"
      className="border-l-2 border-black bg-[rgb(var(--card))] p-4 space-y-2 dark:border-white"
    >
      <p className="label-micro">Selected for sharing</p>
      <ul className="space-y-1.5 text-sm text-ink">
        {rows.map((row) => (
          <li key={`${row.kind}:${row.id}`}>
            <span className="font-medium">{row.kind}:</span>{' '}
            <span className="font-mono text-xs sm:text-sm">
              {formatMetaEntityIdentity(row.name, row.id)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
