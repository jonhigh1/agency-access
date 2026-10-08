import { capturePosthogEvent, capturePosthogEvents } from '@/lib/analytics/capture-posthog';
import type { CtaReasonKind } from '@/lib/invite/cta-reason';

export type InviteSurface =
  | 'invite_page'
  | 'detail'
  | 'success'
  | 'modal'
  | 'onboarding'
  | 'dashboard';
export type InviteChannel = 'copy' | 'email' | 'sms';

type InviteOpenedProps = {
  access_request_token: string;
  access_request_id?: string | null;
  status?: string | null;
  surface: InviteSurface;
  platform_count?: number;
};

type InviteLinkCopiedProps = {
  access_request_id: string;
  access_request_token: string;
  status?: string | null;
  surface: InviteSurface;
};

type InviteSentProps = {
  access_request_id: string;
  access_request_token: string;
  channel: InviteChannel;
  surface: InviteSurface;
  status?: string | null;
};

type InviteReminderSentProps = {
  access_request_id: string;
  access_request_token: string;
  status: string;
  channel: InviteChannel;
  surface: InviteSurface;
};

function captureInviteEvent(eventName: string, properties?: Record<string, unknown>): void {
  void capturePosthogEvent(eventName, properties);
}

export function trackInviteOpened(properties: InviteOpenedProps): void {
  captureInviteEvent('invite_opened', properties);
}

export function trackInviteLinkCopied(properties: InviteLinkCopiedProps): void {
  captureInviteEvent('invite_link_copied', properties);
}

export function trackInviteSent(properties: InviteSentProps): void {
  captureInviteEvent('invite_sent', properties);
}

/** Fires invite_link_copied + invite_sent (channel=copy) in one serialized PostHog capture. */
export function trackInviteLinkCopyAndSent(properties: InviteLinkCopiedProps): void {
  void capturePosthogEvents([
    { event: 'invite_link_copied', properties },
    {
      event: 'invite_sent',
      properties: {
        ...properties,
        channel: 'copy',
      },
    },
  ]);
}

export function trackInviteReminderSent(properties: InviteReminderSentProps): void {
  captureInviteEvent('invite_reminder_sent', properties);
}

const INVITE_OPENED_SESSION_PREFIX = 'invite-opened:';

export function trackInviteOpenedOncePerSession(properties: InviteOpenedProps): void {
  if (typeof window === 'undefined') {
    trackInviteOpened(properties);
    return;
  }

  const sessionKey = `${INVITE_OPENED_SESSION_PREFIX}${properties.access_request_token}`;
  try {
    if (sessionStorage.getItem(sessionKey)) {
      return;
    }
    sessionStorage.setItem(sessionKey, '1');
  } catch {
    // sessionStorage unavailable — still track once this page load.
  }

  trackInviteOpened(properties);
}

/* -------------------------------------------------------------------------- */
/* Redesigned-flow funnel events (U11, R12/KD5)                                */
/*                                                                             */
/* Every payload below carries kind-level data only: reason kinds, row ids,    */
/* counts, and booleans. No tokens, emails, business names, or asset names.    */
/* Call sites fire from handlers and state transitions — never render bodies — */
/* so re-renders cannot double-fire.                                           */
/* -------------------------------------------------------------------------- */

type InviteBusinessCountProps = { business_count: number };

type InviteBusinessShownProps = InviteBusinessCountProps;

type InviteBusinessChosenProps = InviteBusinessCountProps;

type InviteAssetsLoadedProps = {
  available_ad_accounts: number;
  available_pages: number;
  available_instagram: number;
  available_catalogs: number;
  available_datasets: number;
  business_count: number;
  selection_required: boolean;
  has_load_warnings: boolean;
};

type InviteCtaBlockedProps = {
  /** Product-level or group-level platform id, e.g. `meta_ads`. */
  platform: string;
  reason_kind: CtaReasonKind;
};

type InviteSelectionSavedProps = {
  platform: string;
  total_selected: number;
  product_count: number;
};

type InviteGrantChecklistToggledProps = {
  /** Static checklist row id from the manual-grant checklist content. */
  row_id: string;
  checked: boolean;
};

export type InviteVerifyResultKind = 'verified' | 'partial' | 'waiting';

type InviteVerifyResultProps = {
  result_kind: InviteVerifyResultKind;
  verified_count: number;
  unresolved_count: number;
};

/** Fires when the receipt ("Sharing from …") becomes visible. */
export function trackInviteReceiptShown(properties: InviteBusinessShownProps): void {
  captureInviteEvent('invite_receipt_shown', properties);
}

/** Fires when the plain-language business question becomes visible. */
export function trackInviteQuestionShown(properties: InviteBusinessShownProps): void {
  captureInviteEvent('invite_question_shown', properties);
}

/** Fires on an explicit confirm from the business question card. */
export function trackInviteBusinessChosen(properties: InviteBusinessChosenProps): void {
  captureInviteEvent('invite_business_chosen', properties);
}

/** Fires once per business when that business's asset discovery resolves. */
export function trackInviteAssetsLoaded(properties: InviteAssetsLoadedProps): void {
  captureInviteEvent('invite_assets_loaded', properties);
}

/** Fires when the share step's primary action enters a blocked state. */
export function trackInviteCtaBlocked(properties: InviteCtaBlockedProps): void {
  captureInviteEvent('invite_cta_blocked', properties);
}

/** Fires once per successful save of the selection to the server. */
export function trackInviteSelectionSaved(properties: InviteSelectionSavedProps): void {
  captureInviteEvent('invite_selection_saved', properties);
}

/** Fires on each manual-grant checklist row check or uncheck. */
export function trackInviteGrantChecklistToggled(
  properties: InviteGrantChecklistToggledProps
): void {
  captureInviteEvent('invite_grant_checklist_toggled', properties);
}

/** Fires when a Meta manual-share verification returns server truth. */
export function trackInviteVerifyResult(properties: InviteVerifyResultProps): void {
  captureInviteEvent('invite_verify_result', properties);
}

/** Fires when the client raises "Check again" from the flow shell. */
export function trackInviteProgressCheckRequested(): void {
  captureInviteEvent('invite_progress_check_requested');
}

/* -------------------------------------------------------------------------- */
/* Meta decoupled-confirm funnel events (Phase 4)                              */
/*                                                                             */
/* Confirm (the save) and grant completion are decoupled: the step-3 checklist */
/* hosts the pending grant work. These events measure that checklist. Counts   */
/* and kinds only — never asset names, business ids, or emails.                */
/* -------------------------------------------------------------------------- */

type ClientGrantChecklistViewedProps = { remaining_count: number };

type ClientGrantItemCompletedProps = {
  /** Meta asset kind, e.g. `ad_account`. */
  item_kind: string;
  /** `panel` = settled inside a checklist panel; `server` = a refetch flipped the rows. */
  source: 'panel' | 'server';
};

type ClientAssetsDeclineToggledProps = {
  /** Declinable Meta asset kind, e.g. `catalog`. */
  asset_kind: string;
  /** True when the toggle now marks the kind as declined. */
  checked: boolean;
};

type ClientFinishClickedWithPendingProps = { remaining_count: number };

/** Fires once per wizard instance when the step-3 grant checklist becomes visible. */
export function trackClientGrantChecklistViewed(
  properties: ClientGrantChecklistViewedProps
): void {
  captureInviteEvent('client_grant_checklist_viewed', properties);
}

/** Fires when a checklist item reaches `done` — from a panel settle or a server-row flip. */
export function trackClientGrantItemCompleted(properties: ClientGrantItemCompletedProps): void {
  captureInviteEvent('client_grant_item_completed', properties);
}

/** Fires on each decline toggle in the Meta asset selector. */
export function trackClientAssetsDeclineToggled(properties: ClientAssetsDeclineToggledProps): void {
  captureInviteEvent('client_assets_decline_toggled', properties);
}

/** Fires when the client leaves the checklist with grant items still pending. */
export function trackClientFinishClickedWithPending(
  properties: ClientFinishClickedWithPendingProps
): void {
  captureInviteEvent('client_finish_clicked_with_pending', properties);
}

/** Fires when the client re-enters the grant checklist from the follow-up card. */
export function trackClientChecklistResumed(): void {
  captureInviteEvent('client_checklist_resumed');
}

export function buildInviteReminderMailto(input: {
  clientEmail: string;
  clientName: string;
  authorizationUrl: string;
  expirationText?: string | null;
}): string {
  const expirationLine = input.expirationText
    ? `\n\nThis link expires on ${input.expirationText}.`
    : '';

  const subject = encodeURIComponent('Reminder: authorize platform access when ready');
  const body = encodeURIComponent(
    `Hi ${input.clientName},\n\nThis is a friendly reminder to authorize platform access when you're ready. Open the secure link below and complete authorization on your schedule — we only receive access tokens after you finish.${expirationLine}\n\n${input.authorizationUrl}\n\nIf you were not expecting this request, contact us before continuing.`
  );

  return `mailto:${encodeURIComponent(input.clientEmail)}?subject=${subject}&body=${body}`;
}

export function buildInviteSentMailto(input: {
  clientEmail: string;
  clientName: string;
  authorizationUrl: string;
  expirationText?: string | null;
}): string {
  const expirationLine = input.expirationText
    ? `\n\nThis link expires on ${input.expirationText}.`
    : '';

  const subject = encodeURIComponent(`Authorize platform access for ${input.clientName}`);
  const body = encodeURIComponent(
    `Hi ${input.clientName},\n\nWhen you're ready, use this secure link to authorize platform access. Tokens are issued only after you complete authorization.${expirationLine}\n\n${input.authorizationUrl}\n\nIf you were not expecting this request, contact us before continuing.`
  );

  return `mailto:${encodeURIComponent(input.clientEmail)}?subject=${subject}&body=${body}`;
}
