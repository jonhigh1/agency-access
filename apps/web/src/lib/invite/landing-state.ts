/**
 * Pure landing-state mapper for the invite flow (R3, R7; KTD7, KTD12).
 *
 * Decides where a client lands from server truth plus the resume params the
 * page already carries: terminal (expired/revoked), done, platform work, or
 * intake. The mapper owns no state and performs no I/O.
 *
 * Phase rules, in precedence order:
 * 1. A terminal error code (`REQUEST_EXPIRED`, `REQUEST_REVOKED`, or the
 *    `ACCESS_REQUEST_NOT_FOUND` wrapper some save paths emit) routes to the
 *    terminal phase. Expiry outranks everything, including a resume.
 * 2. A server-completed request lands on the done screen.
 * 3. An OAuth return or refresh (`?step=2&connectionId=&platform=`) resumes at
 *    the share step for that platform with the same connection — no second
 *    OAuth connection is created. Meta adds a selection prefill derived from
 *    the payload's `metaFulfillment` rows (KTD1: zero backend change); other
 *    platforms resume at asset selection without prefill.
 * 4. A request whose platforms are all connected stays on the platform phase
 *    until finalization confirms it (the page's completion flow owns that).
 * 5. Any recorded progress — connected platforms or unresolved products —
 *    lands on the platform phase; only a visit with no progress sees intake.
 *    This kills the mid-flow refresh fallback to intake (G1).
 *
 * The unresolved-reason vocabulary is the shared one from
 * `platform-status.ts` (KTD12): the checklist and this mapper read the same
 * reasons, so the phase and the checklist can never disagree.
 */

import type {
  ClientAccessRequestPlatformGroup,
  ClientUnresolvedProduct,
  MetaAssetKind,
  MetaFulfillmentResult,
  MetaFulfillmentStatus,
  Platform,
} from '@agency-platform/shared';

/** Error codes that end the flow. The API wraps expiry as
 * `ACCESS_REQUEST_NOT_FOUND` in some save paths, so it is matched here too. */
export const TERMINAL_REQUEST_CODES = [
  'REQUEST_EXPIRED',
  'REQUEST_REVOKED',
  'ACCESS_REQUEST_NOT_FOUND',
] as const;

export type TerminalRequestCode = (typeof TERMINAL_REQUEST_CODES)[number];

export type InviteTerminalKind = 'expired' | 'revoked' | 'unavailable';

export function isTerminalRequestCode(code: string | null | undefined): code is TerminalRequestCode {
  return typeof code === 'string' && (TERMINAL_REQUEST_CODES as readonly string[]).includes(code);
}

export function terminalKindFromCode(code: string): InviteTerminalKind {
  if (code === 'REQUEST_REVOKED') return 'revoked';
  if (code === 'ACCESS_REQUEST_NOT_FOUND') return 'unavailable';
  return 'expired';
}

/** Saved Meta asset ids a resuming client had chosen, keyed by asset kind. */
export interface InviteSelectionPrefill {
  adAccounts: string[];
  pages: string[];
  instagramAccounts: string[];
  catalogs: string[];
  datasets: string[];
}

/** Fulfillment rows record the client's saved selection. Rows the agency
 * excluded or that were revoked are not the client's choice any more, so they
 * do not prefill. */
const PREFILLABLE_STATUSES: ReadonlySet<MetaFulfillmentStatus> = new Set<MetaFulfillmentStatus>([
  'selected',
  'sharing_attempted',
  'verified',
  'manual_action_required',
  'blocked',
  'stale',
]);

const EMPTY_PREFILL: InviteSelectionPrefill = {
  adAccounts: [],
  pages: [],
  instagramAccounts: [],
  catalogs: [],
  datasets: [],
};

const KIND_TO_PREFILL_KEY: Record<Exclude<MetaAssetKind, 'unknown'>, keyof InviteSelectionPrefill> = {
  ad_account: 'adAccounts',
  page: 'pages',
  instagram_account: 'instagramAccounts',
  catalog: 'catalogs',
  dataset: 'datasets',
};

export function buildMetaSelectionPrefill(
  rows?: ReadonlyArray<MetaFulfillmentResult> | null
): InviteSelectionPrefill | null {
  const prefill: InviteSelectionPrefill = { ...EMPTY_PREFILL };
  let any = false;

  for (const row of rows || []) {
    if (!PREFILLABLE_STATUSES.has(row.status)) continue;
    if (row.assetKind === 'unknown') continue;
    const key = KIND_TO_PREFILL_KEY[row.assetKind];
    if (prefill[key].includes(row.assetId)) continue;
    prefill[key] = [...prefill[key], row.assetId];
    any = true;
  }

  return any ? prefill : null;
}

/** The subset of a fresh Meta asset fetch the intersection reads. */
export interface InviteSelectableAssets {
  adAccounts?: ReadonlyArray<{ id: string }>;
  pages?: ReadonlyArray<{ id: string }>;
  instagramAccounts?: ReadonlyArray<{ id: string }>;
  productCatalogs?: ReadonlyArray<{ id: string }>;
  pixels?: ReadonlyArray<{ id: string }>;
}

const idsOf = (assets?: ReadonlyArray<{ id: string }>): ReadonlySet<string> =>
  new Set((assets || []).map((asset) => asset.id));

const intersectIds = (selected: string[], available: ReadonlySet<string>): string[] =>
  selected.filter((id) => available.has(id));

/** Saved selections only prefill when the fresh fetch still shows the asset. */
export function intersectSelectionPrefill(
  prefill: InviteSelectionPrefill | null | undefined,
  assets: InviteSelectableAssets | null | undefined
): InviteSelectionPrefill | null {
  if (!prefill || !assets) return null;

  const result: InviteSelectionPrefill = {
    adAccounts: intersectIds(prefill.adAccounts, idsOf(assets.adAccounts)),
    pages: intersectIds(prefill.pages, idsOf(assets.pages)),
    instagramAccounts: intersectIds(prefill.instagramAccounts, idsOf(assets.instagramAccounts)),
    catalogs: intersectIds(prefill.catalogs, idsOf(assets.productCatalogs)),
    datasets: intersectIds(prefill.datasets, idsOf(assets.pixels)),
  };

  const any = Object.values(result).some((ids) => ids.length > 0);
  return any ? result : null;
}

export interface InviteResumeParams {
  platform: Platform;
  connectionId: string;
}

export interface InviteWizardStart {
  platform: Platform;
  step: 2;
  connectionId: string;
  /** Meta only: saved selections from the payload's fulfillment rows. */
  metaSelectionPrefill: InviteSelectionPrefill | null;
}

export type InviteLandingPhase = 'terminal' | 'complete' | 'platforms' | 'intake';

export interface InviteLandingState {
  phase: InviteLandingPhase;
  terminalKind?: InviteTerminalKind;
  wizardStart?: InviteWizardStart;
}

export interface InviteLandingInput {
  platforms: ReadonlyArray<ClientAccessRequestPlatformGroup>;
  completedPlatforms: ReadonlySet<string>;
  unresolvedProducts?: ReadonlyArray<ClientUnresolvedProduct>;
  requestStatus?: string;
  /** `authorizationProgress.isComplete` from the payload. */
  isComplete?: boolean;
  /** Terminal code from the load, a save, or a refresh response. */
  terminalErrorCode?: string | null;
  /** OAuth return or refresh params, already validated by the caller. */
  resume?: InviteResumeParams | null;
  metaFulfillment?: ReadonlyArray<MetaFulfillmentResult>;
}

export function resolveInviteLandingState(input: InviteLandingInput): InviteLandingState {
  // 1. Terminal states outrank everything, including a resume (R3, AE6).
  if (isTerminalRequestCode(input.terminalErrorCode)) {
    return { phase: 'terminal', terminalKind: terminalKindFromCode(input.terminalErrorCode) };
  }

  // 2. A server-completed request is done; revisit shows the done screen.
  if (input.requestStatus === 'completed') {
    return { phase: 'complete' };
  }

  // 3. OAuth return or refresh: resume the same connection at the share step.
  if (input.resume) {
    return {
      phase: 'platforms',
      wizardStart: {
        platform: input.resume.platform,
        step: 2,
        connectionId: input.resume.connectionId,
        metaSelectionPrefill:
          input.resume.platform === 'meta'
            ? buildMetaSelectionPrefill(input.metaFulfillment)
            : null,
      },
    };
  }

  const hasPlatforms = (input.platforms?.length ?? 0) > 0;
  const allPlatformsComplete =
    hasPlatforms && input.platforms.every((group) => input.completedPlatforms.has(group.platformGroup));

  // 4. Everything connected, nothing confirmed yet: the completion flow takes
  //    over from the platform phase.
  if (allPlatformsComplete || input.isComplete) {
    return { phase: 'platforms' };
  }

  // 5. Any recorded progress lands on the platform phase; intake is for a
  //    visit with no progress at all (G1: never fall back mid-flow). The
  //    unresolved reasons themselves are read verbatim here and interpreted
  //    only by the shared reason-to-status map (platform-status.ts, KTD12),
  //    so this phase and the checklist can never disagree.
  const hasProgress =
    input.completedPlatforms.size > 0 || (input.unresolvedProducts?.length ?? 0) > 0;

  return { phase: hasProgress ? 'platforms' : 'intake' };
}
