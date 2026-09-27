import { describe, expect, it } from 'vitest';
import {
  CTA_REASONS,
  resolveCta,
  type CtaReasonInput,
  type CtaResolution,
} from '../cta-reason';

function buildInput(overrides: Partial<CtaReasonInput> = {}): CtaReasonInput {
  return {
    assetsLoading: false,
    businessLookupPending: false,
    businessLookupError: null,
    assetsFetchError: null,
    products: [
      {
        product: 'meta_ads',
        selectedCount: 0,
        zeroSelectionMode: 'selection-required',
      },
    ],
    saved: false,
    saveInFlight: false,
    grantsRequired: false,
    grantsPending: false,
    businessName: 'Client One',
    requestAvailability: 'available',
    ...overrides,
  };
}

function expectDisabled(resolution: CtaResolution, reason: string) {
  expect(resolution.kind).toBe('disabled');
  expect(resolution.disabled).toBe(true);
  expect(resolution.reason).toBe(reason);
}

describe('resolveCta', () => {
  it('yields a neutral disabled reason while assets load and never a selection demand', () => {
    const resolution = resolveCta(buildInput({ assetsLoading: true }));

    expectDisabled(resolution, CTA_REASONS.preparing);
    expect(resolution.reason).not.toMatch(/select/i);
  });

  it('stays neutral while the business lookup is pending', () => {
    const resolution = resolveCta(buildInput({ businessLookupPending: true }));

    expectDisabled(resolution, CTA_REASONS.preparing);
  });

  it('demands at least one selection once assets are loaded and nothing is selected', () => {
    const resolution = resolveCta(buildInput());

    expectDisabled(resolution, 'Select at least one ad account to continue');
  });

  it('names the create action when the selected business has no ad accounts', () => {
    const resolution = resolveCta(
      buildInput({
        products: [
          {
            product: 'meta_ads',
            selectedCount: 0,
            zeroSelectionMode: 'create-required',
          },
        ],
      })
    );

    expectDisabled(resolution, 'Create an ad account in Client One to continue');
  });

  it('falls back to a generic business name in the create reason when none is known', () => {
    const resolution = resolveCta(
      buildInput({
        businessName: null,
        products: [
          {
            product: 'meta_ads',
            selectedCount: 0,
            zeroSelectionMode: 'create-required',
          },
        ],
      })
    );

    expectDisabled(resolution, 'Create an ad account in your business to continue');
  });

  it('reports the asset fetch failure with a retry signal instead of a selection demand', () => {
    const resolution = resolveCta(
      buildInput({ assetsFetchError: 'Failed to load accounts' })
    );

    expectDisabled(resolution, CTA_REASONS.assetsFetchFailed);
    expect(resolution.reason).toMatch(/try again/i);
    expect(resolution.reason).not.toMatch(/select at least one/i);
  });

  it('reports a business lookup failure instead of a selection demand', () => {
    const resolution = resolveCta(
      buildInput({ businessLookupError: 'Business Manager lookup failed' })
    );

    expectDisabled(resolution, CTA_REASONS.businessLookupFailed);
    expect(resolution.reason).toMatch(/try again/i);
  });

  it('is ready when every asset-selecting product has a selection', () => {
    const resolution = resolveCta(
      buildInput({
        products: [
          {
            product: 'meta_ads',
            selectedCount: 2,
            zeroSelectionMode: 'selection-required',
          },
        ],
      })
    );

    expect(resolution).toEqual({ kind: 'ready', disabled: false });
  });

  it('is ready when a zero selection is covered by the follow-up save path', () => {
    const resolution = resolveCta(
      buildInput({
        products: [
          {
            product: 'linkedin_pages',
            selectedCount: 0,
            zeroSelectionMode: 'follow-up-save',
          },
        ],
      })
    );

    expect(resolution).toEqual({ kind: 'ready', disabled: false });
  });

  it('stays disabled while any product in a grouped request still needs a selection', () => {
    const resolution = resolveCta(
      buildInput({
        products: [
          {
            product: 'linkedin_ads',
            selectedCount: 1,
            zeroSelectionMode: 'selection-required',
          },
          {
            product: 'linkedin_pages',
            selectedCount: 0,
            zeroSelectionMode: 'selection-required',
          },
        ],
      })
    );

    expectDisabled(resolution, 'Select at least one ad account to continue');
  });

  it('is disabled with a neutral saving reason while the save request is in flight', () => {
    const resolution = resolveCta(
      buildInput({
        products: [
          {
            product: 'meta_ads',
            selectedCount: 2,
            zeroSelectionMode: 'selection-required',
          },
        ],
        saveInFlight: true,
      })
    );

    expectDisabled(resolution, CTA_REASONS.saving);
  });

  it('emits a disabled advance action with a grant-progress reason while grants are pending', () => {
    const resolution = resolveCta(
      buildInput({
        products: [
          {
            product: 'meta_ads',
            selectedCount: 2,
            zeroSelectionMode: 'selection-required',
          },
        ],
        saved: true,
        grantsRequired: true,
        grantsPending: true,
      })
    );

    expect(resolution.kind).toBe('advance');
    expect(resolution.disabled).toBe(true);
    expect(resolution.reason).toBe(CTA_REASONS.grantPending);
  });

  it('emits an enabled advance action once grants are verified', () => {
    const resolution = resolveCta(
      buildInput({
        products: [
          {
            product: 'meta_ads',
            selectedCount: 2,
            zeroSelectionMode: 'selection-required',
          },
        ],
        saved: true,
        grantsRequired: true,
        grantsPending: false,
      })
    );

    expect(resolution).toEqual({ kind: 'advance', disabled: false });
  });

  it('emits an enabled advance action when no grants are required after save', () => {
    const resolution = resolveCta(
      buildInput({
        products: [
          {
            product: 'meta_ads',
            selectedCount: 2,
            zeroSelectionMode: 'selection-required',
          },
        ],
        saved: true,
      })
    );

    expect(resolution).toEqual({ kind: 'advance', disabled: false });
  });

  it('never reports a stale done after grants reset from a changed selection', () => {
    // A selection toggle after verification resets the saved and grant flags
    // (U2 semantics). The resolver must read the live flags, not assume done.
    const beforeReset = resolveCta(
      buildInput({
        products: [
          {
            product: 'meta_ads',
            selectedCount: 2,
            zeroSelectionMode: 'selection-required',
          },
        ],
        saved: true,
        grantsRequired: true,
        grantsPending: false,
      })
    );
    expect(beforeReset).toEqual({ kind: 'advance', disabled: false });

    const afterReset = resolveCta(
      buildInput({
        products: [
          {
            product: 'meta_ads',
            selectedCount: 0,
            zeroSelectionMode: 'selection-required',
          },
        ],
        saved: false,
        grantsRequired: true,
        grantsPending: true,
      })
    );

    expectDisabled(afterReset, 'Select at least one ad account to continue');
    expect(afterReset.reason).not.toBe(CTA_REASONS.grantPending);
  });

  it('disables with a terminal reason when the request expired', () => {
    const resolution = resolveCta(buildInput({ requestAvailability: 'expired' }));

    expectDisabled(resolution, CTA_REASONS.expired);
  });

  it('disables with a terminal reason when the request was revoked', () => {
    const resolution = resolveCta(buildInput({ requestAvailability: 'revoked' }));

    expectDisabled(resolution, CTA_REASONS.revoked);
  });

  it('treats a missing requestAvailability as available', () => {
    const input = buildInput({
      products: [
        {
          product: 'meta_ads',
          selectedCount: 1,
          zeroSelectionMode: 'selection-required',
        },
      ],
    });
    delete (input as Partial<CtaReasonInput>).requestAvailability;

    expect(resolveCta(input)).toEqual({ kind: 'ready', disabled: false });
  });

  it('keeps the terminal reason ahead of an in-flight save', () => {
    const resolution = resolveCta(
      buildInput({
        saveInFlight: true,
        requestAvailability: 'expired',
      })
    );

    expectDisabled(resolution, CTA_REASONS.expired);
  });

  it('keeps the saving reason ahead of loading and selection states', () => {
    const resolution = resolveCta(
      buildInput({
        assetsLoading: true,
        assetsFetchError: 'Failed to load accounts',
        saveInFlight: true,
      })
    );

    expectDisabled(resolution, CTA_REASONS.saving);
  });

  it('keeps loading ahead of the selection demand even when products report zero', () => {
    const resolution = resolveCta(
      buildInput({
        assetsLoading: true,
        assetsFetchError: null,
        businessLookupError: 'Business Manager lookup failed',
      })
    );

    expectDisabled(resolution, CTA_REASONS.preparing);
  });

  it('maps an empty product list to a ready action', () => {
    const resolution = resolveCta(buildInput({ products: [] }));

    expect(resolution).toEqual({ kind: 'ready', disabled: false });
  });
});
