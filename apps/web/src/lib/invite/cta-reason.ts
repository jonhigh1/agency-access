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
 *   flight, post-save advance, loading, fetch error, business lookup, any
 *   selection (ready), then the zero-selection rules.
 * - One selection across all products is enough. Partial access is saveable;
 *   products left empty become pending work, not a block.
 * - Loading and in-flight states yield neutral reasons. They NEVER yield a
 *   selection demand, because the client has not yet been able to select.
 * - Failure states name the failure and the retry affordance ("Try again").
 * - After save the action becomes the advance action, always enabled: confirm
 *   is decoupled from completion, and grant steps live in the step-3
 *   checklist (see meta-grant-checklist.ts).
 */

export type RequestAvailability = 'available' | 'expired' | 'revoked';

/**
 * How the resolver treats a product with zero selected assets.
 * - `selection-required`: the client must select at least one asset.
 * - `follow-up-save`: zero available assets is itself saveable (the platform
 *   records the follow-up), so zero selections do not block.
 * - `declined-save`: every requested Meta asset type was explicitly declined,
 *   so the decline decision is saveable.
 * - `create-required`: zero available assets cannot be saved; the client must
 *   create an asset first (KTD10).
 */
export type ZeroSelectionMode =
  | 'selection-required'
  | 'follow-up-save'
  | 'declined-save'
  | 'create-required';

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
  /** Client business name used by the creation reason. */
  businessName?: string | null;
  /** Terminal invite states. Callers without terminal wiring pass `available`. */
  requestAvailability?: RequestAvailability;
}

/** What the primary action is right now. */
export type CtaKind = 'ready' | 'disabled' | 'advance';

/**
 * U11: machine-readable reason kinds for the blocked state. Analytics carries
 * these — never the free-text `reason` strings, which are UI copy.
 */
export type CtaReasonKind =
  | 'expired'
  | 'revoked'
  | 'saving'
  | 'loading'
  | 'fetch_error'
  | 'business_lookup_error'
  | 'create_required'
  | 'select_required';

export interface CtaResolution {
  kind: CtaKind;
  /** True when the action must not be clickable. Always true for `disabled`. */
  disabled: boolean;
  /** The single live reason for the current state, when one exists. */
  reason?: string;
  /** The kind-level form of `reason`, present only while the action is blocked. */
  reasonKind?: CtaReasonKind;
}

export const CTA_REASONS = {
  preparing: 'Preparing your accounts',
  saving: 'Saving your selection',
  selectAtLeastOne: 'Select at least one ad account to continue',
  selectAtLeastOnePage: 'Select at least one Page to continue',
  assetsFetchFailed: "We couldn't load your accounts. Try again.",
  businessLookupFailed: "We couldn't load your business details. Try again.",
  expired: 'This access request has expired.',
  revoked: 'This access request was revoked.',
} as const;

/** KTD10: the zero-asset reason names the creation action. */
export function createAccountReason(businessName?: string | null): string {
  return `Create an ad account in ${businessName?.trim() || 'your business'} to continue`;
}

/** Pages-only products must not be told to select an "ad account" (#25). */
const SELECT_REASON_BY_PRODUCT: Record<string, string> = {
  meta_pages: CTA_REASONS.selectAtLeastOnePage,
  linkedin_pages: CTA_REASONS.selectAtLeastOnePage,
};

function selectRequiredReason(product: string): string {
  return SELECT_REASON_BY_PRODUCT[product] ?? CTA_REASONS.selectAtLeastOne;
}

const disabledWithReason = (reasonKind: CtaReasonKind, reason: string): CtaResolution => ({
  kind: 'disabled',
  disabled: true,
  reason,
  reasonKind,
});
const enabled = (kind: Exclude<CtaKind, 'disabled'>): CtaResolution => ({ kind, disabled: false });

export function resolveCta(input: CtaReasonInput): CtaResolution {
  // 1. Terminal invite states outrank everything.
  if (input.requestAvailability === 'expired') {
    return disabledWithReason('expired', CTA_REASONS.expired);
  }
  if (input.requestAvailability === 'revoked') {
    return disabledWithReason('revoked', CTA_REASONS.revoked);
  }

  // 2. A save in flight always wins: a second click must do nothing.
  if (input.saveInFlight) {
    return disabledWithReason('saving', CTA_REASONS.saving);
  }

  // 3. Post-save: the action becomes the advance action, always enabled.
  //    Confirm is decoupled from completion — pending grant steps are the
  //    step-3 checklist's job, not the CTA's.
  if (input.saved) {
    return enabled('advance');
  }

  // 4. Loading is neutral. Never a selection demand: the client has not yet
  //    seen the accounts they are being asked to select from.
  if (input.assetsLoading || input.businessLookupPending) {
    return disabledWithReason('loading', CTA_REASONS.preparing);
  }

  // 5. Failure states name the failure and the retry affordance.
  if (input.assetsFetchError) {
    return disabledWithReason('fetch_error', CTA_REASONS.assetsFetchFailed);
  }
  if (input.businessLookupError) {
    return disabledWithReason('business_lookup_error', CTA_REASONS.businessLookupFailed);
  }

  // 6. A selection anywhere is shareable. Partial access is a real outcome:
  //    products with no selection stay out of the save and surface as pending
  //    work later, never as a block here. The Meta products share one
  //    selection blob, so a product-by-product demand would block a client who
  //    chose an ad account and a Page but has no Instagram account.
  if (input.products.some((product) => product.selectedCount > 0)) {
    return enabled('ready');
  }

  // 7. Nothing is selected. Creation comes first: the client cannot select
  //    what does not exist yet.
  for (const product of input.products) {
    if (product.zeroSelectionMode === 'create-required') {
      return disabledWithReason('create_required', createAccountReason(input.businessName));
    }
  }
  for (const product of input.products) {
    if (product.zeroSelectionMode === 'selection-required') {
      return disabledWithReason('select_required', selectRequiredReason(product.product));
    }
  }

  // 8. Every zero selection is a saveable follow-up or an explicit decline.
  return enabled('ready');
}
