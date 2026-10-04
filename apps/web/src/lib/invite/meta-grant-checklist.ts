/**
 * Pure Meta grant-checklist resolver for the client invite flow.
 *
 * The post-save screen shows one checklist row per Meta asset kind and asks
 * this resolver what each row means right now. Server truth (the payload's
 * `metaFulfillment` rows) rolls up per kind, a client-side decline list
 * removes kinds the client said they cannot share, and an optional overlay
 * carries optimistic local state until the server refetch lands. The resolver
 * owns no state and performs no I/O.
 *
 * Rules, in precedence order:
 * 1. One item per kind with at least one selection, plus one item per
 *    declined kind (deduped by kind). A decline without selections yields a
 *    `declined` item; a decline WITH selections is ignored — the selection
 *    wins and the kind is judged purely by its rows.
 * 2. Per-kind state from that kind's rows: every row `verified` is `done`;
 *    any `manual_action_required` | `blocked` | `stale` | `revoked` row is
 *    `action_required`; otherwise `pending`. An `excluded` row is neither
 *    verified nor action-level, so it falls through to `pending` and its
 *    asset still counts as remaining (the exclusion is agency bookkeeping,
 *    not a client obligation).
 * 3. The overlay overrides the computed state for non-declined kinds
 *    (optimistic local wins until the refetch). It never applies to
 *    declined items.
 * 4. `remainingCount` per item is the selection count minus verified rows,
 *    floored at zero. A kind with selections but zero rows is a fresh save:
 *    `pending` with the full selection count. The resolver never invents a
 *    Done — only verified rows can.
 * 5. Copy is client-voiced and derived from the final state (plus the worst
 *    action row for `action_required`). Server `nextAction` strings are
 *    agency-voiced ("Ask the client to...") and never reused here.
 */

import type {
  MetaAssetDecline,
  MetaAssetKind,
  MetaFulfillmentResult,
  MetaFulfillmentStatus,
} from '@agency-platform/shared';

/** The four states a checklist row can be in. */
export type MetaGrantItemState = 'done' | 'pending' | 'action_required' | 'declined';

/** Selection counts per kind, keyed by the wizard's field names. */
export interface MetaGrantSelectedKinds {
  adAccounts: number;
  pages: number;
  instagramAccounts: number;
  catalogs: number;
  datasets: number;
}

export interface MetaGrantChecklistItem {
  /** The assetKind — the stable React key and the overlay key. */
  key: string;
  assetKind: MetaAssetKind;
  label: string;
  state: MetaGrantItemState;
  /** Selected assets of this kind not yet verified. */
  remainingCount: number;
  declined: boolean;
  /** Client-facing copy. Never the server's agency-voiced `nextAction`. */
  clientAction: string;
}

export interface MetaGrantChecklistInput {
  /** Fulfillment rows from the invite payload. Absent on a fresh save. */
  rows?: ReadonlyArray<MetaFulfillmentResult>;
  /** Kinds the client explicitly declined to share. */
  declines?: ReadonlyArray<MetaAssetDecline>;
  /** Selected asset counts per kind. */
  selectedKinds: MetaGrantSelectedKinds;
  /** Optimistic state overrides keyed by assetKind; wins until the refetch. */
  overlay?: Readonly<Record<string, MetaGrantItemState>>;
}

export interface MetaGrantChecklist {
  items: MetaGrantChecklistItem[];
  /** Sum of per-item remaining counts. */
  remainingCount: number;
  /** True when at least one item exists. */
  hasAny: boolean;
}

/**
 * Client-voiced copy for every checklist state, plus one entry per action
 * cause. Tests import this instead of duplicating literals.
 */
export const META_GRANT_CLIENT_ACTIONS = {
  done: 'Access verified by Meta',
  pending: 'Preparing your access request',
  actionManual: 'Finish the sharing steps in Meta, then verify',
  actionBlocked: 'Meta could not grant this — review and retry',
  actionStale: 'Meta was reconnected — verify access again',
  actionRevoked: 'Access was revoked — reconnect to restore it',
  declined: 'You chose not to share this',
} as const;

/**
 * The checklist kinds in stable display order. This one table drives the
 * selectedKinds field mapping, the item ordering, and the dedup: a single
 * pass over it emits at most one item per kind.
 */
const CHECKLIST_KINDS: ReadonlyArray<{
  selectedKey: keyof MetaGrantSelectedKinds;
  assetKind: MetaAssetKind;
  label: string;
}> = [
  { selectedKey: 'adAccounts', assetKind: 'ad_account', label: 'Ad accounts' },
  { selectedKey: 'pages', assetKind: 'page', label: 'Pages' },
  { selectedKey: 'instagramAccounts', assetKind: 'instagram_account', label: 'Instagram accounts' },
  { selectedKey: 'catalogs', assetKind: 'catalog', label: 'Catalogs' },
  { selectedKey: 'datasets', assetKind: 'dataset', label: 'Pixels & datasets' },
];

/** Row statuses that make the whole kind `action_required`. */
const ACTION_STATUSES: ReadonlySet<MetaFulfillmentStatus> = new Set([
  'manual_action_required',
  'blocked',
  'stale',
  'revoked',
]);

/** Worst-row copy precedence for `action_required` items. */
const ACTION_COPY_PRECEDENCE: ReadonlyArray<{
  status: MetaFulfillmentStatus;
  copy: string;
}> = [
  { status: 'revoked', copy: META_GRANT_CLIENT_ACTIONS.actionRevoked },
  { status: 'blocked', copy: META_GRANT_CLIENT_ACTIONS.actionBlocked },
  { status: 'stale', copy: META_GRANT_CLIENT_ACTIONS.actionStale },
  { status: 'manual_action_required', copy: META_GRANT_CLIENT_ACTIONS.actionManual },
];

function clientActionFor(
  state: MetaGrantItemState,
  kindRows: readonly MetaFulfillmentResult[]
): string {
  switch (state) {
    case 'done':
      return META_GRANT_CLIENT_ACTIONS.done;
    case 'pending':
      return META_GRANT_CLIENT_ACTIONS.pending;
    case 'declined':
      return META_GRANT_CLIENT_ACTIONS.declined;
    case 'action_required': {
      const worst = ACTION_COPY_PRECEDENCE.find((entry) =>
        kindRows.some((row) => row.status === entry.status)
      );
      // An overlay can force `action_required` without backing rows; the
      // manual-steps copy is the safest generic ask in that impossible path.
      return worst ? worst.copy : META_GRANT_CLIENT_ACTIONS.actionManual;
    }
  }
}

export function buildMetaGrantChecklist(input: MetaGrantChecklistInput): MetaGrantChecklist {
  const rows = input.rows ?? [];
  const overlay = input.overlay ?? {};

  // Group rows by kind. `unknown` is a Graph placeholder kind, not a
  // checklist kind, so its rows never roll up into any item.
  const rowsByKind = new Map<MetaAssetKind, MetaFulfillmentResult[]>();
  for (const row of rows) {
    const bucket = rowsByKind.get(row.assetKind);
    if (bucket) {
      bucket.push(row);
    } else {
      rowsByKind.set(row.assetKind, [row]);
    }
  }

  const declinedKinds = new Set<string>(
    (input.declines ?? []).map((assetDecline) => assetDecline.assetKind)
  );

  const items: MetaGrantChecklistItem[] = [];
  for (const { selectedKey, assetKind, label } of CHECKLIST_KINDS) {
    const selectedCount = Math.max(0, input.selectedKinds[selectedKey] ?? 0);
    const kindRows = rowsByKind.get(assetKind) ?? [];
    // Selection wins over a decline: a declined kind with selections is a
    // normal selected kind judged by its rows.
    const declined = declinedKinds.has(assetKind) && selectedCount === 0;

    // A kind with fulfillment rows but zero blob selections still renders.
    // On a step-3 resume the asset selector never mounts, so the selection
    // blob is empty — the server rows are then the only evidence that this
    // kind was ever selected. Skipping them would render an empty checklist
    // for every resuming client.
    if (selectedCount === 0 && kindRows.length === 0 && !declined) continue;

    const rowsByAsset = new Map<string, MetaFulfillmentResult[]>();
    for (const row of kindRows) {
      const assetRows = rowsByAsset.get(row.assetId);
      if (assetRows) assetRows.push(row);
      else rowsByAsset.set(row.assetId, [row]);
    }
    // Fulfillment rows are per (asset, recipient). An asset is verified only
    // after every recipient row verifies; row count is not asset count.
    const verifiedCount = Array.from(rowsByAsset.values()).filter((assetRows) =>
      assetRows.every((row) => row.status === 'verified')
    ).length;
    let state: MetaGrantItemState;
    if (declined) {
      state = 'declined';
    } else if (kindRows.length > 0 && verifiedCount === kindRows.length) {
      state = 'done';
    } else if (kindRows.some((row) => ACTION_STATUSES.has(row.status))) {
      state = 'action_required';
    } else {
      // Only selected / sharing_attempted / excluded rows — or a fresh save
      // with no rows at all (rule 4: never invent a Done).
      state = 'pending';
    }

    // Optimistic local state wins until the server refetch lands. Declined
    // items are a client decision, not a server status — never overlaid.
    const overlayState = overlay[assetKind];
    if (overlayState && !declined) {
      state = overlayState;
    }

    // Unverified unit count: from the selection when the blob is present,
    // otherwise from the row count (the resume case — each row is one asset
    // the client confirmed sharing).
    const unverifiedCount =
      selectedCount > 0 ? selectedCount - verifiedCount : rowsByAsset.size - verifiedCount;

    items.push({
      key: assetKind,
      assetKind,
      label,
      state,
      remainingCount: declined ? 0 : Math.max(0, unverifiedCount),
      declined,
      clientAction: clientActionFor(state, kindRows),
    });
  }

  const remainingCount = items.reduce((sum, item) => sum + item.remainingCount, 0);
  return { items, remainingCount, hasAny: items.length > 0 };
}
