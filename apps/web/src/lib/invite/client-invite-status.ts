/**
 * Unified client-invite status vocabulary (CF-01).
 *
 * One primary status per surface: Done | Needs you | Waiting | In progress.
 * Meta grant rows, wizard headers, and agency unresolved summaries derive
 * labels from here so "Connected" never sits beside "Preparing" and "Waiting".
 */

import type { MetaFulfillmentResult } from '@agency-platform/shared';
import type { MetaGrantChecklist, MetaGrantChecklistItem, MetaGrantItemState, MetaGrantMethod } from './meta-grant-checklist';
import {
  resolveUnresolvedReasonRule,
  type InvitePlatformStatus,
} from './platform-status';

/** Primary status words — match InviteStatusChip (Done / Needs you / Waiting / In progress). */
export type ClientInvitePrimaryStatus = 'done' | 'needs_you' | 'waiting' | 'declined';

export const CLIENT_INVITE_STATUS_WORD: Record<ClientInvitePrimaryStatus, string> = {
  done: 'Done',
  needs_you: 'Needs you',
  waiting: 'Waiting',
  declined: 'Declined',
};

export const META_GRANT_ROW_COPY = {
  done: 'Access verified by Meta',
  needsYouManual: 'Share in Meta Business Settings, then tap Check access',
  needsYouAutomatic: 'Grant access below',
  waitingOnMeta: 'Checking your share with Meta — this usually takes a few minutes',
  actionManual: 'Finish the sharing steps in Meta, then verify',
  actionBlocked: 'Meta could not grant this — review and retry',
  actionStale: 'Meta was reconnected — verify access again',
  actionRevoked: 'Access was revoked — reconnect to restore it',
  declined: 'You chose not to share this',
} as const;

const ACTION_COPY_BY_STATUS: ReadonlyArray<{
  status: MetaFulfillmentResult['status'];
  copy: string;
}> = [
  { status: 'revoked', copy: META_GRANT_ROW_COPY.actionRevoked },
  { status: 'blocked', copy: META_GRANT_ROW_COPY.actionBlocked },
  { status: 'stale', copy: META_GRANT_ROW_COPY.actionStale },
  { status: 'manual_action_required', copy: META_GRANT_ROW_COPY.actionManual },
];

export function resolveMetaGrantPrimaryStatus(
  state: MetaGrantItemState,
  grantMethod: MetaGrantMethod | undefined,
  kindRows: readonly MetaFulfillmentResult[]
): ClientInvitePrimaryStatus {
  switch (state) {
    case 'done':
      return 'done';
    case 'declined':
      return 'declined';
    case 'action_required':
      return 'needs_you';
    case 'pending': {
      const onlyAutomatedCheckInFlight =
        grantMethod === 'automatic' &&
        kindRows.length > 0 &&
        kindRows.every(
          (row) => row.status === 'sharing_attempted' || row.status === 'excluded'
        );
      if (onlyAutomatedCheckInFlight) {
        return 'waiting';
      }
      return 'needs_you';
    }
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function metaGrantRowClientAction(
  state: MetaGrantItemState,
  grantMethod: MetaGrantMethod | undefined,
  kindRows: readonly MetaFulfillmentResult[]
): string {
  const primary = resolveMetaGrantPrimaryStatus(state, grantMethod, kindRows);
  if (primary === 'done') return META_GRANT_ROW_COPY.done;
  if (primary === 'declined') return META_GRANT_ROW_COPY.declined;
  if (primary === 'waiting') return META_GRANT_ROW_COPY.waitingOnMeta;
  if (state === 'action_required') {
    const worst = ACTION_COPY_BY_STATUS.find((entry) =>
      kindRows.some((row) => row.status === entry.status)
    );
    return worst ? worst.copy : META_GRANT_ROW_COPY.actionManual;
  }
  return grantMethod === 'manual'
    ? META_GRANT_ROW_COPY.needsYouManual
    : META_GRANT_ROW_COPY.needsYouAutomatic;
}

export function metaGrantProgressLabel(
  item: Pick<MetaGrantChecklistItem, 'primaryStatus' | 'remainingCount' | 'state'>,
  selectedCount: number,
  verifiedCount: number
): string | null {
  if (item.state === 'declined' || item.state === 'done') return null;
  if (item.primaryStatus === 'waiting') {
    const total = Math.max(selectedCount, verifiedCount + item.remainingCount);
    if (total <= 0) return null;
    return `${verifiedCount} of ${total} verified`;
  }
  if (item.remainingCount > 0) {
    return `${item.remainingCount} left`;
  }
  return null;
}

export interface MetaGrantPhaseHeader {
  title: string;
  subtitle: string;
  /** When true, step 3 may use the green Connected treatment. */
  successTone: boolean;
}

export function resolveMetaGrantPhaseHeader(checklist: MetaGrantChecklist): MetaGrantPhaseHeader {
  if (!checklist.hasAny || checklist.remainingCount === 0) {
    return {
      title: 'Connected',
      subtitle: 'Access granted to the accounts you selected.',
      successTone: true,
    };
  }

  const openItems = checklist.items.filter(
    (item) => item.state !== 'done' && item.state !== 'declined'
  );
  const needsYou = openItems.some((item) => item.primaryStatus === 'needs_you');
  const count = checklist.remainingCount;

  if (needsYou) {
    return {
      title: 'Meta signed in',
      subtitle: `${count} step${count === 1 ? '' : 's'} need${count === 1 ? 's' : ''} you — finish sharing below.`,
      successTone: false,
    };
  }

  return {
    title: 'Meta signed in',
    subtitle: 'Waiting on Meta to confirm your share — nothing else is needed from you right now.',
    successTone: false,
  };
}

/** Map invite platform checklist status to chip + agency vocabulary. */
export function clientInviteStatusWordFromPlatformStatus(
  status: InvitePlatformStatus
): string {
  switch (status) {
    case 'done':
      return CLIENT_INVITE_STATUS_WORD.done;
    case 'action-needed':
    case 'attention':
    case 'connect-first':
      return status === 'connect-first' ? 'In progress' : CLIENT_INVITE_STATUS_WORD.needs_you;
    case 'waiting-on-agency':
      return CLIENT_INVITE_STATUS_WORD.waiting;
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

/** Agency-facing short label for an unresolved product reason (same vocabulary). */
export function agencyUnresolvedStatusLabel(reason: string): string {
  const rule = resolveUnresolvedReasonRule(reason);
  switch (rule.status) {
    case 'done':
      return CLIENT_INVITE_STATUS_WORD.done;
    case 'action-needed':
    case 'attention':
    case 'connect-first':
      return rule.status === 'connect-first'
        ? 'In progress'
        : CLIENT_INVITE_STATUS_WORD.needs_you;
    case 'waiting-on-agency':
      return CLIENT_INVITE_STATUS_WORD.waiting;
    default: {
      const _exhaustive: never = rule.status;
      return _exhaustive;
    }
  }
}
