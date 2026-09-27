/**
 * Pure CTA reason resolver for the client invite share screen (R4, KTD2).
 *
 * The wizard renders its primary action unconditionally and asks this resolver
 * what the action must say right now. Every caller-supplied fact describes the
 * current moment, so the returned reason is always live and truthful. The
 * resolver owns no state and performs no I/O.
 *
 * Mapping rules:
 * - Exactly one reason wins. Precedence: terminal request state, save in
 *   flight, post-save advance, loading, fetch error, business lookup, then the
 *   per-product selection rules.
 * - Loading and in-flight states yield neutral reasons. They NEVER yield a
 *   selection demand, because the client has not yet been able to select.
 * - Failure states name the failure and the retry affordance ("Try again").
 * - After save the action becomes the advance action; it is gated on grant
 *   verification and reports grant progress while any grant is pending.
 */

export type RequestAvailability = 'available' | 'expired' | 'revoked';

/**
 * How the resolver treats a product with zero selected assets.
 * - `selection-required`: the client must select at least one asset.
 * - `follow-up-save`: zero available assets is itself saveable (the platform
 *   records the follow-up), so zero selections do not block.
 * - `create-required`: zero available assets cannot be saved; the client must
 *   create an asset first (KTD10).
 */
export type ZeroSelectionMode = 'selection-required' | 'follow-up-save' | 'create-required';

export interface CtaProductSelectionState {
  /** Product-level id, e.g. `meta_ads`. */
  product: string;
  /** Number of assets the client selected for this product. */
  selectedCount: number;
  /** How a zero selection is treated for this product. */
  zeroSelectionMode: ZeroSelectionMode;
}

export interface CtaReasonInput {
  /** At least one asset-selecting product has not reported its assets yet. */
  assetsLoading: boolean;
  /** The business lookup (Business Manager ID) is still pending. */
  businessLookupPending: boolean;
  /** The business lookup failed. */
  businessLookupError: string | null;
  /** The client-side asset fetch failed. */
  assetsFetchError: string | null;
  /** Per-product selection state for every asset-selecting product. */
  products: CtaProductSelectionState[];
  /** The selection was saved to the server. */
  saved: boolean;
  /** A save (or equivalent grant automation) request is in flight. */
  saveInFlight: boolean;
  /** At least one grant step is required after save. */
  grantsRequired: boolean;
  /** At least one required grant step is still pending. */
  grantsPending: boolean;
  /** Client business name used by the creation reason. */
  businessName?: string | null;
  /** Terminal invite states. Callers without terminal wiring pass `available`. */
  requestAvailability?: RequestAvailability;
}

/** What the primary action is right now. */
export type CtaKind = 'ready' | 'disabled' | 'advance';

export interface CtaResolution {
  kind: CtaKind;
  /** True when the action must not be clickable. Always true for `disabled`. */
  disabled: boolean;
  /** The single live reason for the current state, when one exists. */
  reason?: string;
}

export const CTA_REASONS = {
  preparing: 'Preparing your accounts',
  saving: 'Saving your selection',
  selectAtLeastOne: 'Select at least one ad account to continue',
  assetsFetchFailed: "We couldn't load your accounts. Try again.",
  businessLookupFailed: "We couldn't load your business details. Try again.",
  grantPending: 'Access grants are still in progress. Complete the grant steps above.',
  expired: 'This access request has expired.',
  revoked: 'This access request was revoked.',
} as const;

/** KTD10: the zero-asset reason names the creation action. */
export function createAccountReason(businessName?: string | null): string {
  return `Create an ad account in ${businessName?.trim() || 'your business'} to continue`;
}

const disabledWithReason = (reason: string): CtaResolution => ({ kind: 'disabled', disabled: true, reason });
const enabled = (kind: Exclude<CtaKind, 'disabled'>): CtaResolution => ({ kind, disabled: false });

export function resolveCta(input: CtaReasonInput): CtaResolution {
  // 1. Terminal invite states outrank everything.
  if (input.requestAvailability === 'expired') {
    return disabledWithReason(CTA_REASONS.expired);
  }
  if (input.requestAvailability === 'revoked') {
    return disabledWithReason(CTA_REASONS.revoked);
  }

  // 2. A save in flight always wins: a second click must do nothing.
  if (input.saveInFlight) {
    return disabledWithReason(CTA_REASONS.saving);
  }

  // 3. Post-save: the action becomes the advance action, gated on grants.
  if (input.saved) {
    if (input.grantsRequired && input.grantsPending) {
      return { kind: 'advance', disabled: true, reason: CTA_REASONS.grantPending };
    }
    return enabled('advance');
  }

  // 4. Loading is neutral. Never a selection demand: the client has not yet
  //    seen the accounts they are being asked to select from.
  if (input.assetsLoading || input.businessLookupPending) {
    return disabledWithReason(CTA_REASONS.preparing);
  }

  // 5. Failure states name the failure and the retry affordance.
  if (input.assetsFetchError) {
    return disabledWithReason(CTA_REASONS.assetsFetchFailed);
  }
  if (input.businessLookupError) {
    return disabledWithReason(CTA_REASONS.businessLookupFailed);
  }

  // 6. Per-product selection rules. Creation comes first: the client cannot
  //    select what does not exist yet.
  for (const product of input.products) {
    if (product.selectedCount > 0) continue;
    if (product.zeroSelectionMode === 'create-required') {
      return disabledWithReason(createAccountReason(input.businessName));
    }
  }
  for (const product of input.products) {
    if (product.selectedCount > 0) continue;
    if (product.zeroSelectionMode === 'selection-required') {
      return disabledWithReason(CTA_REASONS.selectAtLeastOne);
    }
  }

  // 7. Everything is selected, or every zero selection is a saveable follow-up.
  return enabled('ready');
}
