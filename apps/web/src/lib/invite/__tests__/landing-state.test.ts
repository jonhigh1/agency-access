import { describe, it, expect } from 'vitest';
import type { MetaFulfillmentResult } from '@agency-platform/shared';
import {
  buildMetaSelectionPrefill,
  hasConfirmedMetaSelection,
  hasOpenMetaFulfillment,
  intersectSelectionPrefill,
  isTerminalRequestCode,
  resolveInviteLandingState,
  terminalKindFromCode,
  type InviteLandingInput,
} from '../landing-state';

const platformGroup = (platformGroup: string, product: string) => ({
  platformGroup,
  products: [{ product, accessLevel: 'admin' }],
});

const baseInput = (): InviteLandingInput => ({
  platforms: [platformGroup('google', 'google_ads')],
  completedPlatforms: new Set<string>(),
  unresolvedProducts: [],
  requestStatus: 'pending',
  isComplete: false,
  terminalErrorCode: null,
  resume: null,
  metaFulfillment: [],
});

it('keeps a fresh request at intake when every product still needs authorization', () => {
  expect(resolveInviteLandingState({
    ...baseInput(),
    unresolvedProducts: [
      { product: 'google_ads', platformGroup: 'google', reason: 'authorization_required' },
    ],
  }).phase).toBe('intake');
});

const fulfillmentRow = (overrides: Partial<MetaFulfillmentResult>): MetaFulfillmentResult => ({
  id: 'row-1',
  assetKind: 'ad_account',
  assetId: 'act_111',
  assetName: 'Acme Ads',
  recipientType: 'system_user',
  recipientId: 'recipient-1',
  recipientName: 'Agency System User',
  requestedTasks: [],
  verifiedTasks: [],
  status: 'selected',
  updatedAt: '2026-09-26T00:00:00.000Z',
  ...overrides,
});

describe('terminal request codes', () => {
  it('recognizes the four terminal codes and rejects ordinary failures', () => {
    expect(isTerminalRequestCode('REQUEST_EXPIRED')).toBe(true);
    expect(isTerminalRequestCode('REQUEST_REVOKED')).toBe(true);
    expect(isTerminalRequestCode('ACCESS_REQUEST_NOT_FOUND')).toBe(true);
    // The API's own not-found code for a missing access request: without it a
    // dead link loops on the retry card and the branded terminal never renders.
    expect(isTerminalRequestCode('REQUEST_NOT_FOUND')).toBe(true);
    expect(isTerminalRequestCode('NETWORK_ERROR')).toBe(false);
    expect(isTerminalRequestCode(null)).toBe(false);
    expect(isTerminalRequestCode(undefined)).toBe(false);
  });

  it('maps each terminal code to its terminal kind', () => {
    expect(terminalKindFromCode('REQUEST_EXPIRED')).toBe('expired');
    expect(terminalKindFromCode('REQUEST_REVOKED')).toBe('revoked');
    expect(terminalKindFromCode('ACCESS_REQUEST_NOT_FOUND')).toBe('unavailable');
    expect(terminalKindFromCode('REQUEST_NOT_FOUND')).toBe('unavailable');
  });
});

describe('buildMetaSelectionPrefill', () => {
  it('groups fulfillment rows by asset kind into id lists', () => {
    const prefill = buildMetaSelectionPrefill([
      fulfillmentRow({}),
      fulfillmentRow({ id: 'row-2', assetKind: 'page', assetId: 'pg_1', assetName: 'Acme Page' }),
      fulfillmentRow({ id: 'row-3', assetKind: 'instagram_account', assetId: 'ig_1', assetName: 'Acme IG' }),
      fulfillmentRow({ id: 'row-4', assetKind: 'catalog', assetId: 'cat_1', assetName: 'Acme Catalog' }),
      fulfillmentRow({ id: 'row-5', assetKind: 'dataset', assetId: 'ds_1', assetName: 'Acme Pixel' }),
    ]);

    expect(prefill).toEqual({
      adAccounts: ['act_111'],
      pages: ['pg_1'],
      instagramAccounts: ['ig_1'],
      catalogs: ['cat_1'],
      datasets: ['ds_1'],
    });
  });

  it('excludes revoked and excluded rows and dedupes repeated assets', () => {
    const prefill = buildMetaSelectionPrefill([
      fulfillmentRow({}),
      fulfillmentRow({ id: 'row-2', status: 'revoked', assetId: 'act_222' }),
      fulfillmentRow({ id: 'row-3', status: 'excluded', assetId: 'act_333' }),
      fulfillmentRow({ id: 'row-4', status: 'verified', assetId: 'act_111' }),
    ]);

    expect(prefill).toEqual({
      adAccounts: ['act_111'],
      pages: [],
      instagramAccounts: [],
      catalogs: [],
      datasets: [],
    });
  });

  it('returns null when no rows survive', () => {
    expect(buildMetaSelectionPrefill([])).toBeNull();
    expect(buildMetaSelectionPrefill(undefined)).toBeNull();
    expect(buildMetaSelectionPrefill([fulfillmentRow({ status: 'excluded' })])).toBeNull();
  });
});

describe('hasConfirmedMetaSelection', () => {
  it('is true when at least one row is a saved selectable selection', () => {
    expect(hasConfirmedMetaSelection([fulfillmentRow({})])).toBe(true);
    expect(hasConfirmedMetaSelection([fulfillmentRow({ status: 'sharing_attempted' })])).toBe(true);
  });

  it('is false for empty input and for rows that carry no client choice', () => {
    expect(hasConfirmedMetaSelection([])).toBe(false);
    expect(hasConfirmedMetaSelection(undefined)).toBe(false);
    // Declines create no fulfillment rows, so they cannot fake a confirmation.
    expect(hasConfirmedMetaSelection([fulfillmentRow({ status: 'excluded' })])).toBe(false);
    expect(hasConfirmedMetaSelection([fulfillmentRow({ status: 'revoked' })])).toBe(false);
  });
});

describe('hasOpenMetaFulfillment', () => {
  it('is true while any row still needs grant work', () => {
    expect(hasOpenMetaFulfillment([fulfillmentRow({})])).toBe(true);
    expect(hasOpenMetaFulfillment([fulfillmentRow({ status: 'manual_action_required' })])).toBe(true);
  });

  it('is false once every row is verified or excluded', () => {
    expect(hasOpenMetaFulfillment([])).toBe(false);
    expect(hasOpenMetaFulfillment(undefined)).toBe(false);
    expect(hasOpenMetaFulfillment([fulfillmentRow({ status: 'verified' })])).toBe(false);
    expect(hasOpenMetaFulfillment([fulfillmentRow({ status: 'excluded' })])).toBe(false);
    expect(
      hasOpenMetaFulfillment([
        fulfillmentRow({ status: 'verified' }),
        fulfillmentRow({ id: 'row-2', assetId: 'act_9', status: 'excluded' }),
      ])
    ).toBe(false);
  });
});

describe('intersectSelectionPrefill', () => {
  const prefill = {
    adAccounts: ['act_111', 'act_gone'],
    pages: ['pg_1'],
    instagramAccounts: ['ig_gone'],
    catalogs: ['cat_1'],
    datasets: [],
  };

  it('keeps only ids still present in the fresh asset fetch', () => {
    const result = intersectSelectionPrefill(prefill, {
      adAccounts: [{ id: 'act_111' }],
      pages: [{ id: 'pg_1' }],
      instagramAccounts: [],
      productCatalogs: [{ id: 'cat_1' }],
      pixels: [],
    });

    expect(result).toEqual({
      adAccounts: ['act_111'],
      pages: ['pg_1'],
      instagramAccounts: [],
      catalogs: ['cat_1'],
      datasets: [],
    });
  });

  it('returns null when nothing survives the intersection', () => {
    expect(intersectSelectionPrefill(prefill, { adAccounts: [], pages: [] })).toBeNull();
  });

  it('returns null for missing prefill or missing assets', () => {
    expect(intersectSelectionPrefill(null, { adAccounts: [{ id: 'act_1' }] })).toBeNull();
    expect(intersectSelectionPrefill(prefill, null)).toBeNull();
    expect(intersectSelectionPrefill(prefill, undefined)).toBeNull();
  });
});

describe('resolveInviteLandingState', () => {
  it('routes terminal error codes to the terminal phase before anything else', () => {
    const expired = resolveInviteLandingState({ ...baseInput(), terminalErrorCode: 'REQUEST_EXPIRED' });
    expect(expired.phase).toBe('terminal');
    expect(expired.terminalKind).toBe('expired');

    const revoked = resolveInviteLandingState({ ...baseInput(), terminalErrorCode: 'REQUEST_REVOKED' });
    expect(revoked.phase).toBe('terminal');
    expect(revoked.terminalKind).toBe('revoked');

    const unavailable = resolveInviteLandingState({
      ...baseInput(),
      terminalErrorCode: 'ACCESS_REQUEST_NOT_FOUND',
      requestStatus: 'completed',
    });
    expect(unavailable.phase).toBe('terminal');
    expect(unavailable.terminalKind).toBe('unavailable');

    // The API's own not-found code ends the flow too (visual QA: a dead link
    // looped on the retry card instead of the branded terminal).
    const notFound = resolveInviteLandingState({
      ...baseInput(),
      terminalErrorCode: 'REQUEST_NOT_FOUND',
    });
    expect(notFound.phase).toBe('terminal');
    expect(notFound.terminalKind).toBe('unavailable');
  });

  it('lands a completed request on the done screen', () => {
    const state = resolveInviteLandingState({
      ...baseInput(),
      requestStatus: 'completed',
      resume: { platform: 'meta', connectionId: 'conn-1' },
    });
    expect(state.phase).toBe('complete');
    expect(state.wizardStart).toBeUndefined();
  });

  it('resumes an OAuth return with a confirmed selection at the step-3 checklist', () => {
    const state = resolveInviteLandingState({
      ...baseInput({
        platforms: [platformGroup('meta', 'meta_ads')],
      }),
      resume: { platform: 'meta', connectionId: 'conn-meta-1' },
      metaFulfillment: [fulfillmentRow({}), fulfillmentRow({ id: 'row-2', status: 'excluded', assetId: 'act_222' })],
      unresolvedProducts: [
        { product: 'meta_ads', platformGroup: 'meta', reason: 'sharing_required' },
      ],
    });

    expect(state.phase).toBe('platforms');
    expect(state.wizardStart).toEqual({
      platform: 'meta',
      step: 3,
      connectionId: 'conn-meta-1',
      metaSelectionPrefill: {
        adAccounts: ['act_111'],
        pages: [],
        instagramAccounts: [],
        catalogs: [],
        datasets: [],
      },
    });
  });

  it('keeps an OAuth return without a confirmed selection at the share step', () => {
    const state = resolveInviteLandingState({
      ...baseInput({
        platforms: [platformGroup('meta', 'meta_ads')],
      }),
      resume: { platform: 'meta', connectionId: 'conn-meta-1' },
      metaFulfillment: [fulfillmentRow({ status: 'excluded' })],
      unresolvedProducts: [
        { product: 'meta_ads', platformGroup: 'meta', reason: 'authorization_required' },
      ],
    });

    expect(state.wizardStart).toEqual({
      platform: 'meta',
      step: 2,
      connectionId: 'conn-meta-1',
      metaSelectionPrefill: null,
    });
  });

  it('resumes a non-Meta platform at asset selection without prefill', () => {
    const state = resolveInviteLandingState({
      ...baseInput({ platforms: [platformGroup('google', 'google_ads')] }),
      resume: { platform: 'google', connectionId: 'conn-google-1' },
      metaFulfillment: [fulfillmentRow({})],
      unresolvedProducts: [
        { product: 'google_ads', platformGroup: 'google', reason: 'selection_required' },
      ],
    });

    expect(state.phase).toBe('platforms');
    expect(state.wizardStart).toEqual({
      platform: 'google',
      step: 2,
      connectionId: 'conn-google-1',
      metaSelectionPrefill: null,
    });
  });

  it('prefers the terminal phase over a resume', () => {
    const state = resolveInviteLandingState({
      ...baseInput({ platforms: [platformGroup('meta', 'meta_ads')] }),
      terminalErrorCode: 'REQUEST_EXPIRED',
      resume: { platform: 'meta', connectionId: 'conn-meta-1' },
    });
    expect(state.phase).toBe('terminal');
  });

  it('keeps a fully connected request on the platform phase until finalization confirms', () => {
    const state = resolveInviteLandingState({
      ...baseInput({ platforms: [platformGroup('google', 'google_ads')] }),
      completedPlatforms: new Set(['google']),
      isComplete: true,
    });
    expect(state.phase).toBe('platforms');
    expect(state.wizardStart).toBeUndefined();
  });

  it('lands a revisiting client with unfinished platform work on the platform phase', () => {
    const state = resolveInviteLandingState({
      ...baseInput({ platforms: [platformGroup('meta', 'meta_ads')] }),
      unresolvedProducts: [
        { product: 'meta_ads', platformGroup: 'meta', reason: 'sharing_required' },
      ],
    });
    expect(state.phase).toBe('platforms');
    expect(state.wizardStart).toBeUndefined();
  });

  it('lands a returning client whose prior platform completed on the platform phase', () => {
    const state = resolveInviteLandingState({
      ...baseInput({
        platforms: [platformGroup('google', 'google_ads'), platformGroup('meta', 'meta_ads')],
      }),
      completedPlatforms: new Set(['google']),
    });
    expect(state.phase).toBe('platforms');
    expect(state.wizardStart).toBeUndefined();
  });

  it('lands a fresh visit with no progress on the intake phase', () => {
    expect(resolveInviteLandingState(baseInput()).phase).toBe('intake');
  });
});

describe('resolveInviteLandingState — confirmed Meta selection resume (Phase 3)', () => {
  it('sends a confirmed Meta selection with unfinished grants to the step-3 checklist', () => {
    const state = resolveInviteLandingState({
      ...baseInput(),
      platforms: [platformGroup('meta', 'meta_ads')],
      metaConnectionId: 'conn-meta-9',
      metaFulfillment: [
        fulfillmentRow({}),
        fulfillmentRow({ id: 'row-2', assetKind: 'page', assetId: 'pg_1', status: 'sharing_attempted' }),
      ],
      unresolvedProducts: [
        { product: 'meta_ads', platformGroup: 'meta', reason: 'sharing_required' },
      ],
    });

    expect(state).toEqual({
      phase: 'platforms',
      wizardStart: {
        platform: 'meta',
        step: 3,
        connectionId: 'conn-meta-9',
        metaSelectionPrefill: {
          adAccounts: ['act_111'],
          pages: ['pg_1'],
          instagramAccounts: [],
          catalogs: [],
          datasets: [],
        },
      },
    });
  });

  it('does not send exclusion-only fulfillment to the checklist', () => {
    const state = resolveInviteLandingState({
      ...baseInput(),
      platforms: [platformGroup('meta', 'meta_ads')],
      metaConnectionId: 'conn-meta-9',
      metaFulfillment: [fulfillmentRow({ status: 'excluded' })],
      unresolvedProducts: [
        { product: 'meta_ads', platformGroup: 'meta', reason: 'sharing_required' },
      ],
    });

    expect(state.wizardStart).toBeUndefined();
    expect(state.phase).toBe('platforms');
  });

  it('does not invent a checklist for a declines-only payload', () => {
    const state = resolveInviteLandingState({
      ...baseInput(),
      platforms: [platformGroup('meta', 'meta_ads')],
      metaConnectionId: 'conn-meta-9',
      metaFulfillment: [],
      unresolvedProducts: [
        { product: 'meta_ads', platformGroup: 'meta', reason: 'sharing_required' },
      ],
    });

    expect(state.wizardStart).toBeUndefined();
    expect(state.phase).toBe('platforms');
  });

  it('does not let a session-merged completed set shadow the checklist', () => {
    const state = resolveInviteLandingState({
      ...baseInput(),
      platforms: [platformGroup('meta', 'meta_ads')],
      completedPlatforms: new Set(['meta']),
      serverCompletedPlatforms: new Set<string>(),
      metaConnectionId: 'conn-meta-9',
      metaFulfillment: [fulfillmentRow({})],
      isComplete: false,
    });

    expect(state.wizardStart).toEqual({
      platform: 'meta',
      step: 3,
      connectionId: 'conn-meta-9',
      metaSelectionPrefill: {
        adAccounts: ['act_111'],
        pages: [],
        instagramAccounts: [],
        catalogs: [],
        datasets: [],
      },
    });
  });

  it('respects a server-completed Meta and skips the checklist', () => {
    const state = resolveInviteLandingState({
      ...baseInput(),
      platforms: [platformGroup('meta', 'meta_ads')],
      completedPlatforms: new Set(['meta']),
      serverCompletedPlatforms: new Set(['meta']),
      metaConnectionId: 'conn-meta-9',
      metaFulfillment: [fulfillmentRow({})],
      isComplete: false,
    });

    expect(state.wizardStart).toBeUndefined();
    expect(state.phase).toBe('platforms');
  });

  it('still lands a completed request on the done screen over the checklist', () => {
    const state = resolveInviteLandingState({
      ...baseInput(),
      platforms: [platformGroup('meta', 'meta_ads')],
      metaConnectionId: 'conn-meta-9',
      metaFulfillment: [fulfillmentRow({})],
      requestStatus: 'completed',
    });

    expect(state).toEqual({ phase: 'complete' });
  });
});
