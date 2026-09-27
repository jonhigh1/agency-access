/**
 * Pure platform-status reducer for the invite progress checklist (R3, KTD6).
 *
 * One requested platform maps to exactly one truthful status and one line of
 * client-facing copy. The reducer owns no state and performs no I/O; every
 * input is the server-reported authorization progress plus the requested
 * platform list from the payload.
 *
 * Mapping rules:
 * - `done` comes from `completedPlatforms` only. Nothing reads as done before
 *   the server says so, so no completion icon renders prematurely.
 * - `connect-first` is derived: requested, not completed, and absent from
 *   `unresolvedProducts` (no OAuth connection has happened yet).
 * - Client-actor reasons (selection, sharing, reconnect) read as
 *   `action-needed`; the API's own nextAction copy confirms the client is the
 *   actor for those states (AE5).
 * - Agency-actor and verification-in-flight reasons read as
 *   `waiting-on-agency`.
 * - Any reason outside the documented vocabulary falls back to `attention`
 *   with generic copy. A raw enum value never reaches the screen.
 * - When one platform has several unresolved products, the entry that asks
 *   something of the client wins; ties keep the first product in list order.
 */

import {
  PLATFORM_NAMES,
  type ClientAccessRequestPlatformGroup,
  type ClientUnresolvedProduct,
  type Platform,
} from '@agency-platform/shared';

/** The one status vocabulary for the invite progress checklist. */
export type InvitePlatformStatus =
  | 'connect-first'
  | 'done'
  | 'action-needed'
  | 'waiting-on-agency'
  | 'attention';

/**
 * Mirrors `UnresolvedProductReason` in
 * apps/api/src/services/access-request.service.ts: the 15 named reasons plus
 * the MetaFulfillmentStatus values the API can emit as an unresolved reason.
 * `UNRESOLVED_REASON_RULES` below is a total record over this union: a new API
 * reason must be added here and mapped, or typecheck fails.
 */
export type InviteUnresolvedProductReason =
  | 'no_assets'
  | 'selection_required'
  | 'assignee_selection_required'
  | 'sharing_required'
  | 'missing_tasks'
  | 'stale'
  | 'pending'
  | 'granted'
  | 'failed'
  | 'unresolved'
  | 'authorization_required'
  | 'oauth_only_insufficient'
  | 'pending_native_grant'
  | 'follow_up_needed'
  | 'unsupported_automation_path'
  // MetaFulfillmentStatus values the API surfaces as an unresolved reason.
  | 'selected'
  | 'sharing_attempted'
  | 'verified'
  | 'manual_action_required'
  | 'blocked'
  | 'revoked'
  | 'excluded';

export interface InvitePlatformStatusRule {
  status: InvitePlatformStatus;
  copy: (platformName: string) => string;
}

export const DONE_COPY = 'Access confirmed.';

export const connectFirstCopy = (platformName: string): string =>
  `Connect ${platformName} to continue.`;

export const GENERIC_ATTENTION_COPY = (platformName: string): string =>
  `${platformName} needs attention. Contact your agency if this does not clear.`;

const waitingOnAgency = (copy: (platformName: string) => string): InvitePlatformStatusRule => ({
  status: 'waiting-on-agency',
  copy,
});
const actionNeeded = (copy: (platformName: string) => string): InvitePlatformStatusRule => ({
  status: 'action-needed',
  copy,
});

/**
 * Total reason-to-(status, copy) map. Client copy names the platform and the
 * next action; it never shows a reason identifier.
 */
export const UNRESOLVED_REASON_RULES: Record<
  InviteUnresolvedProductReason,
  InvitePlatformStatusRule
> = {
  no_assets: actionNeeded(
    (p) => `No ${p} accounts were found. Create one in ${p}, then check again.`
  ),
  selection_required: actionNeeded((p) => `Choose which ${p} accounts to share.`),
  assignee_selection_required: waitingOnAgency((p) =>
    `Your agency is choosing who receives ${p} access. Nothing is needed from you.`
  ),
  sharing_required: actionNeeded((p) => `Finish sharing your ${p} accounts to complete this step.`),
  missing_tasks: actionNeeded((p) =>
    `${p} is missing some approved permissions. Redo the access step to grant them.`
  ),
  stale: actionNeeded((p) => `${p} access needs a refresh. Connect ${p} again.`),
  pending: waitingOnAgency((p) => `Verifying your ${p} access. This usually takes a few minutes.`),
  granted: waitingOnAgency((p) => `${p} access was recorded. Waiting on final verification.`),
  failed: actionNeeded((p) => `The ${p} access step did not go through. Try the step again.`),
  unresolved: waitingOnAgency((p) => GENERIC_ATTENTION_COPY(p)),
  authorization_required: { status: 'connect-first', copy: connectFirstCopy },
  oauth_only_insufficient: actionNeeded((p) =>
    `Connecting is not enough for ${p}. Finish the extra approval step.`
  ),
  pending_native_grant: waitingOnAgency((p) => `Waiting for the ${p} access grant to finish.`),
  follow_up_needed: waitingOnAgency((p) =>
    `Your agency is finishing ${p} access. Nothing is needed from you.`
  ),
  unsupported_automation_path: waitingOnAgency((p) =>
    `Your agency will finish ${p} access manually.`
  ),
  selected: actionNeeded((p) => `Your ${p} accounts are chosen. Finish sharing them to continue.`),
  sharing_attempted: waitingOnAgency((p) =>
    `Checking your ${p} share. This usually takes a few minutes.`
  ),
  verified: waitingOnAgency((p) => `Final checks are running on ${p}.`),
  manual_action_required: actionNeeded((p) =>
    `${p} needs one manual step from you. Complete the step, then check again.`
  ),
  blocked: actionNeeded((p) =>
    `${p} access is blocked. Complete the required step, then check again.`
  ),
  revoked: actionNeeded((p) => `${p} access was removed. Connect ${p} again to restore it.`),
  excluded: waitingOnAgency((p) =>
    `Your agency adjusted the ${p} access list. They will follow up if needed.`
  ),
};

const isDocumentedReason = (reason: string): reason is InviteUnresolvedProductReason =>
  Object.hasOwn(UNRESOLVED_REASON_RULES, reason);

/** Documented reasons resolve to their rule; anything else falls back to attention. */
export function resolveUnresolvedReasonRule(reason: string): InvitePlatformStatusRule {
  return isDocumentedReason(reason)
    ? UNRESOLVED_REASON_RULES[reason]
    : { status: 'attention', copy: GENERIC_ATTENTION_COPY };
}

const STATUS_PRIORITY: Record<InvitePlatformStatus, number> = {
  'action-needed': 3,
  attention: 2,
  'waiting-on-agency': 1,
  'connect-first': 0,
  done: 0,
};

export interface InvitePlatformChecklistInput {
  platforms: ReadonlyArray<ClientAccessRequestPlatformGroup>;
  completedPlatforms: ReadonlySet<string>;
  unresolvedProducts?: ReadonlyArray<ClientUnresolvedProduct>;
}

export interface InvitePlatformChecklistEntry {
  platform: Platform;
  platformName: string;
  status: InvitePlatformStatus;
  copy: string;
}

/**
 * One entry per requested platform, in request order. This checklist is the
 * flow's single progress surface: no percentage, no step counter, no
 * completion signal before `done`.
 */
export function buildInvitePlatformChecklist(
  input: InvitePlatformChecklistInput
): InvitePlatformChecklistEntry[] {
  const unresolvedByPlatform = new Map<string, ClientUnresolvedProduct[]>();
  for (const item of input.unresolvedProducts || []) {
    const existing = unresolvedByPlatform.get(item.platformGroup);
    unresolvedByPlatform.set(item.platformGroup, existing ? [...existing, item] : [item]);
  }

  return input.platforms.map((group) => {
    const platform = group.platformGroup as Platform;
    const platformName = PLATFORM_NAMES[platform] ?? String(group.platformGroup);

    if (input.completedPlatforms.has(group.platformGroup)) {
      return { platform, platformName, status: 'done' as const, copy: DONE_COPY };
    }

    let winner: InvitePlatformStatusRule | null = null;
    for (const item of unresolvedByPlatform.get(group.platformGroup) || []) {
      const rule = resolveUnresolvedReasonRule(item.reason);
      if (!winner || STATUS_PRIORITY[rule.status] > STATUS_PRIORITY[winner.status]) {
        winner = rule;
      }
    }

    if (winner) {
      return { platform, platformName, status: winner.status, copy: winner.copy(platformName) };
    }

    return {
      platform,
      platformName,
      status: 'connect-first',
      copy: connectFirstCopy(platformName),
    };
  });
}

/**
 * Checklist status to InviteStatusChip status. Kept as a plain literal record
 * so this lib never imports a component.
 */
export const INVITE_CHIP_STATUS_BY_PLATFORM_STATUS: Record<
  InvitePlatformStatus,
  'complete' | 'active' | 'waiting' | 'attention'
> = {
  done: 'complete',
  'action-needed': 'attention',
  'waiting-on-agency': 'waiting',
  attention: 'attention',
  'connect-first': 'active',
};
