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
 *    platforms resume at asset selection without prefill. A Meta return whose
 *    rows hold a confirmed selection skips straight to the step-3 grant
 *    checklist: the selection is saved, so the remaining work is the grants.
 * 4. A plain revisit whose fulfillment rows hold a confirmed Meta selection
 *    while `authorizationProgress` is not complete also resumes at that
 *    checklist. It reads the SERVER-completed platforms, not the page's
 *    session-merged set, so a stale sessionStorage entry for meta cannot
 *    shadow it (and server-verified meta is never resurrected).
 * 5. A request whose platforms are all connected stays on the platform phase
 *    until finalization confirms it (the page's completion flow owns that).
 * 6. Any recorded progress — connected platforms or authorization work —
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
 * `ACCESS_REQUEST_NOT_FOUND` in some save paths, and surfaces its own
 * `REQUEST_NOT_FOUND` for a missing request — both end the flow, so a dead
 * link renders the branded terminal instead of looping on the retry card. */
export const TERMINAL_REQUEST_CODES = [
  'REQUEST_EXPIRED',
  'REQUEST_REVOKED',
  'ACCESS_REQUEST_NOT_FOUND',
  'REQUEST_NOT_FOUND',
] as const;

export type TerminalRequestCode = (typeof TERMINAL_REQUEST_CODES)[number];

export type InviteTerminalKind = 'expired' | 'revoked' | 'unavailable';

export function isTerminalRequestCode(code: string | null | undefined): code is TerminalRequestCode {
  return typeof code === 'string' && (TERMINAL_REQUEST_CODES as readonly string[]).includes(code);
}

export function terminalKindFromCode(code: string): InviteTerminalKind {
  if (code === 'REQUEST_REVOKED') return 'revoked';
  if (code === 'ACCESS_REQUEST_NOT_FOUND') return 'unavailable';
  if (code === 'REQUEST_NOT_FOUND') return 'unavailable';
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

/** True when the prefill carries at least one selectable asset id. Owns the
 * prefill shape so a new key cannot silently skip emptiness checks. */
export function hasSelectableAssets(prefill: InviteSelectionPrefill | null | undefined): boolean {
  if (!prefill) return false;
  return (
    prefill.adAccounts.length > 0 ||
    prefill.pages.length > 0 ||
    prefill.instagramAccounts.length > 0 ||
    prefill.catalogs.length > 0 ||
    prefill.datasets.length > 0
  );
}

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

/** True when the payload carries a saved Meta selection: the client confirmed
 * an asset list at least once. Declines create no fulfillment rows, so they
 * cannot fake a confirmation, and excluded/revoked rows are not prefillable. */
export function hasConfirmedMetaSelection(rows?: ReadonlyArray<MetaFulfillmentResult>): boolean {
  return buildMetaSelectionPrefill(rows) !== null;
}

/** True while any fulfillment row still needs grant work: neither `verified`
 * (Meta granted it) nor `excluded` (agency bookkeeping, not client work). */
export function hasOpenMetaFulfillment(rows?: ReadonlyArray<MetaFulfillmentResult>): boolean {
  return (rows ?? []).some((row) => row.status !== 'verified' && row.status !== 'excluded');
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
  /** 2 = share/selection step; 3 = Meta grant checklist. */
  step: 2 | 3;
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
  /** Connection id of the request's meta platform group, from
   * `payload.connections` — the checklist resume needs it to reuse the
   * connection instead of creating a second one. */
  metaConnectionId?: string;
  /** The payload's own `authorizationProgress.completedPlatforms` — server
   * truth, distinct from `completedPlatforms`, which the page session-merges.
   * The checklist resume reads this one so a stale sessionStorage entry for
   * meta cannot shadow it. */
  serverCompletedPlatforms?: ReadonlySet<string>;
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

  // 3. OAuth return or refresh: resume the same connection. Meta with a
  //    confirmed selection goes straight to the grant checklist — the
  //    selection is already saved, so the remaining work is the grants.
  if (input.resume) {
    return {
      phase: 'platforms',
      wizardStart: {
        platform: input.resume.platform,
        step:
          input.resume.platform === 'meta' && hasConfirmedMetaSelection(input.metaFulfillment)
            ? 3
            : 2,
        connectionId: input.resume.connectionId,
        metaSelectionPrefill:
          input.resume.platform === 'meta'
            ? buildMetaSelectionPrefill(input.metaFulfillment)
            : null,
      },
    };
  }

  // 3.5 Plain revisit with a confirmed Meta selection and unfinished grant
  //     work: resume the step-3 checklist. Reads the SERVER-completed set, so
  //     the session-merged `completedPlatforms` cannot shadow it and verified
  //     meta is never resurrected. (The completed-request and resume branches
  //     above already returned.)
  const metaRequested = (input.platforms ?? []).some((group) => group.platformGroup === 'meta');
  if (
    !input.resume &&
    metaRequested &&
    !input.isComplete &&
    hasConfirmedMetaSelection(input.metaFulfillment) &&
    !(input.serverCompletedPlatforms?.has('meta') ?? false)
  ) {
    return {
      phase: 'platforms',
      wizardStart: {
        platform: 'meta',
        step: 3,
        connectionId: input.metaConnectionId ?? '',
        metaSelectionPrefill: buildMetaSelectionPrefill(input.metaFulfillment),
      },
    };
  }

  const hasPlatforms = (input.platforms?.length ?? 0) > 0;
  const allPlatformsComplete =
    hasPlatforms && input.platforms.every((group) => input.completedPlatforms.has(group.platformGroup));

  // 5. Everything connected, nothing confirmed yet: the completion flow takes
  //    over from the platform phase.
  if (allPlatformsComplete || input.isComplete) {
    return { phase: 'platforms' };
  }

  // Missing authorization describes a fresh request, not saved progress.
  // Other unresolved reasons describe work already started on a platform.
  const hasProgress =
    input.completedPlatforms.size > 0 ||
    (input.unresolvedProducts?.some((product) => product.reason !== 'authorization_required') ?? false);

  return { phase: hasProgress ? 'platforms' : 'intake' };
}
