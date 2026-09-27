import { describe, it, expect } from 'vitest';
import type { MetaFulfillmentResult } from '@agency-platform/shared';
import {
  buildMetaSelectionPrefill,
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
  it('recognizes the three terminal codes and rejects ordinary failures', () => {
    expect(isTerminalRequestCode('REQUEST_EXPIRED')).toBe(true);
    expect(isTerminalRequestCode('REQUEST_REVOKED')).toBe(true);
    expect(isTerminalRequestCode('ACCESS_REQUEST_NOT_FOUND')).toBe(true);
    expect(isTerminalRequestCode('REQUEST_NOT_FOUND')).toBe(false);
    expect(isTerminalRequestCode('NETWORK_ERROR')).toBe(false);
    expect(isTerminalRequestCode(null)).toBe(false);
    expect(isTerminalRequestCode(undefined)).toBe(false);
  });

  it('maps each terminal code to its terminal kind', () => {
    expect(terminalKindFromCode('REQUEST_EXPIRED')).toBe('expired');
    expect(terminalKindFromCode('REQUEST_REVOKED')).toBe('revoked');
    expect(terminalKindFromCode('ACCESS_REQUEST_NOT_FOUND')).toBe('unavailable');
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

  it('resumes an OAuth return at the share step with Meta prefill from fulfillment rows', () => {
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
      step: 2,
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
