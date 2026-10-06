/**
 * Stable name + Meta object ID formatting for client invite surfaces.
 * App Review business_management proof requires both fields visible together.
 */

export function formatMetaEntityIdentity(name: string, id: string): string {
  const trimmedName = name.trim() || id;
  const trimmedId = id.trim();
  if (!trimmedId) return trimmedName;
  return `${trimmedName} · ID ${trimmedId}`;
}

/** Selected Page chip: prefer human-readable name; full identity in `title`. */
export function formatMetaPageChipDisplay(
  name: string,
  id: string,
): { label: string; title: string } {
  const trimmedName = name.trim();
  const trimmedId = id.trim();
  const displayName = trimmedName || trimmedId;
  const hasDistinctName =
    trimmedName.length > 0 && trimmedName !== trimmedId && !/^\d+$/.test(trimmedName);
  return {
    label: hasDistinctName ? trimmedName : displayName,
    title: formatMetaEntityIdentity(displayName, trimmedId),
  };
}

/** Combobox secondary line: always includes the Meta object ID. */
export function metaAssetOptionDescription(
  id: string,
  detail?: string | null
): string {
  const trimmedDetail = detail?.trim();
  if (trimmedDetail) {
    return `ID ${id} · ${trimmedDetail}`;
  }
  return `ID ${id}`;
}

export interface MetaEntityIdentityRow {
  kind: string;
  name: string;
  id: string;
}

/** Flatten selected entities for a read-only summary list. */
export function buildMetaSelectedIdentityRows(input: {
  clientBusiness?: { name: string; id: string } | null;
  adAccounts?: Array<{ name: string; id: string }>;
  pages?: Array<{ name: string; id: string }>;
  instagramAccounts?: Array<{ name: string; id: string }>;
  catalogs?: Array<{ name: string; id: string }>;
  datasets?: Array<{ name: string; id: string }>;
}): MetaEntityIdentityRow[] {
  const rows: MetaEntityIdentityRow[] = [];
  if (input.clientBusiness?.id) {
    rows.push({
      kind: 'Business Portfolio',
      name: input.clientBusiness.name || input.clientBusiness.id,
      id: input.clientBusiness.id,
    });
  }
  for (const account of input.adAccounts ?? []) {
    rows.push({ kind: 'Ad account', name: account.name, id: account.id });
  }
  for (const page of input.pages ?? []) {
    rows.push({ kind: 'Page', name: page.name, id: page.id });
  }
  for (const account of input.instagramAccounts ?? []) {
    rows.push({ kind: 'Instagram', name: account.name, id: account.id });
  }
  for (const catalog of input.catalogs ?? []) {
    rows.push({ kind: 'Catalog', name: catalog.name, id: catalog.id });
  }
  for (const dataset of input.datasets ?? []) {
    rows.push({ kind: 'Pixel / dataset', name: dataset.name, id: dataset.id });
  }
  return rows;
}
