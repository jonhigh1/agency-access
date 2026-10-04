import { describe, expect, it } from 'vitest';
import type { MetaAssetDecline, MetaFulfillmentResult } from '@agency-platform/shared';
import {
  META_GRANT_CLIENT_ACTIONS,
  buildMetaGrantChecklist,
  type MetaGrantSelectedKinds,
} from '../meta-grant-checklist';

let rowSeq = 0;

/** A verified ad-account row by default; overrides describe the interesting part. */
function row(overrides: Partial<MetaFulfillmentResult> = {}): MetaFulfillmentResult {
  rowSeq += 1;
  return {
    id: `row-${rowSeq}`,
    assetKind: 'ad_account',
    assetId: `asset-${rowSeq}`,
    assetName: `Asset ${rowSeq}`,
    recipientType: 'business',
    recipientId: `biz-${rowSeq}`,
    recipientName: `Recipient ${rowSeq}`,
    requestedTasks: ['ADVERTISE'],
    verifiedTasks: [],
    status: 'verified',
    updatedAt: '2026-10-03T00:00:00.000Z',
    ...overrides,
  };
}

function kinds(overrides: Partial<MetaGrantSelectedKinds> = {}): MetaGrantSelectedKinds {
  return {
    adAccounts: 0,
    pages: 0,
    instagramAccounts: 0,
    catalogs: 0,
    datasets: 0,
    ...overrides,
  };
}

function decline(assetKind: MetaAssetDecline['assetKind']): MetaAssetDecline {
  return { assetKind, declinedAt: '2026-10-03T00:00:00.000Z' };
}

describe('buildMetaGrantChecklist', () => {
  it('rolls a kind up across multiple rows and recipients', () => {
    const result = buildMetaGrantChecklist({
      rows: [
        row({ assetKind: 'ad_account', recipientId: 'biz-a', status: 'verified' }),
        row({ assetKind: 'ad_account', recipientId: 'biz-b', status: 'verified' }),
        row({ assetKind: 'ad_account', recipientId: 'biz-c', status: 'selected' }),
      ],
      selectedKinds: kinds({ adAccounts: 3 }),
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      key: 'ad_account',
      assetKind: 'ad_account',
      label: 'Ad accounts',
      state: 'pending',
      remainingCount: 1,
      declined: false,
      clientAction: META_GRANT_CLIENT_ACTIONS.pending,
    });
    expect(result.remainingCount).toBe(1);
    expect(result.hasAny).toBe(true);
  });

  it('marks a kind done when every row for it is verified', () => {
    const result = buildMetaGrantChecklist({
      rows: [
        row({ assetKind: 'page', status: 'verified' }),
        row({ assetKind: 'page', status: 'verified' }),
      ],
      selectedKinds: kinds({ pages: 2 }),
    });

    expect(result.items[0]).toMatchObject({
      key: 'page',
      state: 'done',
      remainingCount: 0,
      declined: false,
      clientAction: META_GRANT_CLIENT_ACTIONS.done,
    });
  });

  it('keeps an asset pending until every recipient row is verified', () => {
    const result = buildMetaGrantChecklist({
      rows: [
        row({ assetKind: 'ad_account', assetId: 'act_1', recipientId: 'biz-a', status: 'verified' }),
        row({ assetKind: 'ad_account', assetId: 'act_1', recipientId: 'biz-b', status: 'selected' }),
      ],
      selectedKinds: kinds({ adAccounts: 1 }),
    });

    expect(result.items[0]).toMatchObject({ state: 'pending', remainingCount: 1 });
    expect(result.remainingCount).toBe(1);
  });

  it('escalates a kind to action_required when any row needs action', () => {
    const result = buildMetaGrantChecklist({
      rows: [
        row({ assetKind: 'ad_account', status: 'verified' }),
        row({ assetKind: 'ad_account', status: 'stale' }),
      ],
      selectedKinds: kinds({ adAccounts: 2 }),
    });

    expect(result.items[0].state).toBe('action_required');
    expect(result.items[0].clientAction).toBe(META_GRANT_CLIENT_ACTIONS.actionStale);
  });

  it('picks the worst action copy by precedence, not row order', () => {
    const copyFor = (statuses: MetaFulfillmentResult['status'][]) =>
      buildMetaGrantChecklist({
        rows: statuses.map((status) => row({ assetKind: 'catalog', status })),
        selectedKinds: kinds({ catalogs: statuses.length }),
      }).items[0].clientAction;

    expect(copyFor(['manual_action_required', 'revoked'])).toBe(
      META_GRANT_CLIENT_ACTIONS.actionRevoked
    );
    expect(copyFor(['stale', 'manual_action_required'])).toBe(META_GRANT_CLIENT_ACTIONS.actionStale);
    expect(copyFor(['blocked', 'stale'])).toBe(META_GRANT_CLIENT_ACTIONS.actionBlocked);
  });

  it('shows a declined kind with zero selections as declined and ignores its overlay', () => {
    const result = buildMetaGrantChecklist({
      rows: [row({ assetKind: 'ad_account', status: 'verified' })],
      declines: [decline('catalog')],
      selectedKinds: kinds({ adAccounts: 1 }),
      overlay: { catalog: 'done' },
    });

    const catalog = result.items.find((item) => item.key === 'catalog');
    expect(catalog).toMatchObject({
      key: 'catalog',
      state: 'declined',
      remainingCount: 0,
      declined: true,
      clientAction: META_GRANT_CLIENT_ACTIONS.declined,
    });
    expect(result.remainingCount).toBe(0);
    expect(result.hasAny).toBe(true);
  });

  it('treats a declined kind that also has selections as a normal selected kind', () => {
    const result = buildMetaGrantChecklist({
      rows: [
        row({ assetKind: 'page', status: 'verified' }),
        row({ assetKind: 'page', status: 'verified' }),
      ],
      declines: [decline('page')],
      selectedKinds: kinds({ pages: 2 }),
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      key: 'page',
      state: 'done',
      remainingCount: 0,
      declined: false,
    });
  });

  it('applies the overlay to a non-declined kind', () => {
    const result = buildMetaGrantChecklist({
      rows: [row({ assetKind: 'catalog', status: 'manual_action_required' })],
      selectedKinds: kinds({ catalogs: 1 }),
      overlay: { catalog: 'done' },
    });

    expect(result.items[0].state).toBe('done');
    expect(result.items[0].clientAction).toBe(META_GRANT_CLIENT_ACTIONS.done);
  });

  it('marks a fresh save with no rows as pending with the full remaining count', () => {
    const result = buildMetaGrantChecklist({
      rows: [],
      selectedKinds: kinds({ adAccounts: 2, datasets: 1 }),
    });

    expect(result.items.map((item) => item.key)).toEqual(['ad_account', 'dataset']);
    expect(result.items.map((item) => item.state)).toEqual(['pending', 'pending']);
    expect(result.items.map((item) => item.remainingCount)).toEqual([2, 1]);
    expect(result.remainingCount).toBe(3);
  });

  it('returns an empty checklist for empty input', () => {
    const result = buildMetaGrantChecklist({
      rows: [],
      declines: [],
      selectedKinds: kinds(),
      overlay: {},
    });

    expect(result).toEqual({ items: [], remainingCount: 0, hasAny: false });
  });

  it('renders a kind from fulfillment rows alone when the selection blob is empty (resume)', () => {
    // Step-3 resume: the selector never mounts, so selectedKinds are all
    // zero. The server rows are the only evidence the kind was selected.
    const result = buildMetaGrantChecklist({
      rows: [
        row({ assetKind: 'page', assetId: 'page_1', status: 'verified' }),
        row({ assetKind: 'page', assetId: 'page_2', status: 'selected' }),
      ],
      declines: [],
      selectedKinds: kinds(),
      overlay: {},
    });

    const page = result.items.find((item) => item.assetKind === 'page');
    expect(page).toBeDefined();
    expect(page?.state).toBe('pending');
    expect(page?.remainingCount).toBe(1);
    expect(result.remainingCount).toBe(1);
    expect(result.hasAny).toBe(true);
  });

  it('marks a rows-only kind done when every row is verified', () => {
    const result = buildMetaGrantChecklist({
      rows: [
        row({ assetKind: 'ad_account', assetId: 'act_1', status: 'verified' }),
        row({ assetKind: 'ad_account', assetId: 'act_2', status: 'verified' }),
      ],
      declines: [],
      selectedKinds: kinds(),
      overlay: {},
    });

    const adAccounts = result.items.find((item) => item.assetKind === 'ad_account');
    expect(adAccounts?.state).toBe('done');
    expect(adAccounts?.remainingCount).toBe(0);
    expect(result.remainingCount).toBe(0);
  });

  it('sums remaining counts across items and orders kinds stably', () => {
    const result = buildMetaGrantChecklist({
      rows: [row({ assetKind: 'page', status: 'verified' })],
      selectedKinds: kinds({
        adAccounts: 2,
        pages: 1,
        instagramAccounts: 3,
        catalogs: 1,
        datasets: 2,
      }),
    });

    expect(result.items.map((item) => item.key)).toEqual([
      'ad_account',
      'page',
      'instagram_account',
      'catalog',
      'dataset',
    ]);
    expect(result.remainingCount).toBe(2 + 0 + 3 + 1 + 2);
    expect(result.hasAny).toBe(true);
  });

  it('ignores rows of an unknown asset kind', () => {
    const result = buildMetaGrantChecklist({
      rows: [row({ assetKind: 'unknown', status: 'verified' })],
      selectedKinds: kinds(),
    });

    expect(result.items).toEqual([]);
  });
});
