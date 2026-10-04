import { beforeEach, describe, expect, it, vi } from 'vitest';

const { capturePosthogEventMock, capturePosthogEventsMock } = vi.hoisted(() => ({
  capturePosthogEventMock: vi.fn(),
  capturePosthogEventsMock: vi.fn(),
}));

vi.mock('../capture-posthog', () => ({
  capturePosthogEvent: capturePosthogEventMock,
  capturePosthogEvents: capturePosthogEventsMock,
}));

import {
  trackClientAssetsDeclineToggled,
  trackClientChecklistResumed,
  trackClientFinishClickedWithPending,
  trackClientGrantChecklistViewed,
  trackClientGrantItemCompleted,
  trackInviteAssetsLoaded,
  trackInviteBusinessChosen,
  trackInviteCtaBlocked,
  trackInviteGrantChecklistToggled,
  trackInviteLinkCopied,
  trackInviteLinkCopyAndSent,
  trackInviteOpened,
  trackInviteProgressCheckRequested,
  trackInviteQuestionShown,
  trackInviteReceiptShown,
  trackInviteReminderSent,
  trackInviteSelectionSaved,
  trackInviteSent,
  trackInviteVerifyResult,
} from '../invite-events';

describe('invite-events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks invite_opened with access_request_token', () => {
    trackInviteOpened({
      access_request_token: 'tok-abc',
      access_request_id: 'req-1',
      status: 'pending',
      surface: 'invite_page',
    });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('invite_opened', {
      access_request_token: 'tok-abc',
      access_request_id: 'req-1',
      status: 'pending',
      surface: 'invite_page',
    });
  });

  it('tracks invite_link_copied with surface', () => {
    trackInviteLinkCopied({
      access_request_id: 'req-1',
      access_request_token: 'tok-abc',
      status: 'pending',
      surface: 'detail',
    });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('invite_link_copied', {
      access_request_id: 'req-1',
      access_request_token: 'tok-abc',
      status: 'pending',
      surface: 'detail',
    });
  });

  it('tracks invite_sent with channel', () => {
    trackInviteSent({
      access_request_id: 'req-1',
      access_request_token: 'tok-abc',
      channel: 'email',
      surface: 'success',
    });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('invite_sent', {
      access_request_id: 'req-1',
      access_request_token: 'tok-abc',
      channel: 'email',
      surface: 'success',
    });
  });

  it('tracks invite copy + send together via capturePosthogEvents', () => {
    trackInviteLinkCopyAndSent({
      access_request_id: 'req-1',
      access_request_token: 'tok-abc',
      status: 'pending',
      surface: 'detail',
    });

    expect(capturePosthogEventsMock).toHaveBeenCalledWith([
      {
        event: 'invite_link_copied',
        properties: {
          access_request_id: 'req-1',
          access_request_token: 'tok-abc',
          status: 'pending',
          surface: 'detail',
        },
      },
      {
        event: 'invite_sent',
        properties: {
          access_request_id: 'req-1',
          access_request_token: 'tok-abc',
          status: 'pending',
          surface: 'detail',
          channel: 'copy',
        },
      },
    ]);
    expect(capturePosthogEventMock).not.toHaveBeenCalled();
  });

  it('tracks invite_reminder_sent with channel', () => {
    trackInviteReminderSent({
      access_request_id: 'req-1',
      access_request_token: 'tok-abc',
      status: 'pending',
      channel: 'copy',
      surface: 'detail',
    });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('invite_reminder_sent', {
      access_request_id: 'req-1',
      access_request_token: 'tok-abc',
      status: 'pending',
      channel: 'copy',
      surface: 'detail',
    });
  });
});

describe('invite-events — redesigned flow funnel (U11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks invite_receipt_shown with a count only', () => {
    trackInviteReceiptShown({ business_count: 1 });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('invite_receipt_shown', {
      business_count: 1,
    });
  });

  it('tracks invite_question_shown with a count only', () => {
    trackInviteQuestionShown({ business_count: 3 });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('invite_question_shown', {
      business_count: 3,
    });
  });

  it('tracks invite_business_chosen with a count only', () => {
    trackInviteBusinessChosen({ business_count: 2 });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('invite_business_chosen', {
      business_count: 2,
    });
  });

  it('tracks invite_assets_loaded with availability counts and flags only', () => {
    trackInviteAssetsLoaded({
      available_ad_accounts: 2,
      available_pages: 1,
      available_instagram: 0,
      available_catalogs: 4,
      available_datasets: 1,
      business_count: 2,
      selection_required: true,
      has_load_warnings: false,
    });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('invite_assets_loaded', {
      available_ad_accounts: 2,
      available_pages: 1,
      available_instagram: 0,
      available_catalogs: 4,
      available_datasets: 1,
      business_count: 2,
      selection_required: true,
      has_load_warnings: false,
    });
  });

  it('tracks invite_cta_blocked with the reason kind only — never free text', () => {
    trackInviteCtaBlocked({ platform: 'meta_ads', reason_kind: 'select_required' });

    const [, properties] = capturePosthogEventMock.mock.calls[0];
    expect(properties).toEqual({ platform: 'meta_ads', reason_kind: 'select_required' });
    expect(properties.reason_kind).toBe('select_required');
  });

  it('tracks invite_selection_saved with counts only', () => {
    trackInviteSelectionSaved({ platform: 'meta_ads', total_selected: 3, product_count: 1 });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('invite_selection_saved', {
      platform: 'meta_ads',
      total_selected: 3,
      product_count: 1,
    });
  });

  it('tracks invite_grant_checklist_toggled with the row id and check state', () => {
    trackInviteGrantChecklistToggled({ row_id: 'step-2-2', checked: true });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('invite_grant_checklist_toggled', {
      row_id: 'step-2-2',
      checked: true,
    });
  });

  it('tracks invite_verify_result with the result kind and counts', () => {
    trackInviteVerifyResult({ result_kind: 'partial', verified_count: 1, unresolved_count: 2 });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('invite_verify_result', {
      result_kind: 'partial',
      verified_count: 1,
      unresolved_count: 2,
    });
  });

  it('tracks invite_progress_check_requested without properties', () => {
    trackInviteProgressCheckRequested();

    expect(capturePosthogEventMock).toHaveBeenCalledTimes(1);
    expect(capturePosthogEventMock).toHaveBeenCalledWith(
      'invite_progress_check_requested',
      undefined
    );
  });

describe('invite-events — Meta decoupled-confirm funnel (client_*)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks client_grant_checklist_viewed with the remaining count only', () => {
    trackClientGrantChecklistViewed({ remaining_count: 2 });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('client_grant_checklist_viewed', {
      remaining_count: 2,
    });
  });

  it('tracks client_grant_item_completed with the item kind and source only', () => {
    trackClientGrantItemCompleted({ item_kind: 'page', source: 'panel' });
    trackClientGrantItemCompleted({ item_kind: 'ad_account', source: 'server' });

    expect(capturePosthogEventMock).toHaveBeenNthCalledWith(1, 'client_grant_item_completed', {
      item_kind: 'page',
      source: 'panel',
    });
    expect(capturePosthogEventMock).toHaveBeenNthCalledWith(2, 'client_grant_item_completed', {
      item_kind: 'ad_account',
      source: 'server',
    });
  });

  it('tracks client_assets_decline_toggled with the asset kind and check state', () => {
    trackClientAssetsDeclineToggled({ asset_kind: 'catalog', checked: true });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('client_assets_decline_toggled', {
      asset_kind: 'catalog',
      checked: true,
    });
  });

  it('tracks client_finish_clicked_with_pending with the remaining count', () => {
    trackClientFinishClickedWithPending({ remaining_count: 3 });

    expect(capturePosthogEventMock).toHaveBeenCalledWith('client_finish_clicked_with_pending', {
      remaining_count: 3,
    });
  });

  it('tracks client_checklist_resumed without properties', () => {
    trackClientChecklistResumed();

    expect(capturePosthogEventMock).toHaveBeenCalledTimes(1);
    expect(capturePosthogEventMock).toHaveBeenCalledWith('client_checklist_resumed', undefined);
  });

  it('carries only kind-level data across the decoupled-confirm events', () => {
    const secretToken = 'tok_live_do_not_send';

    trackClientGrantChecklistViewed({ remaining_count: 1 });
    trackClientGrantItemCompleted({ item_kind: 'catalog', source: 'panel' });
    trackClientGrantItemCompleted({ item_kind: 'dataset', source: 'server' });
    trackClientAssetsDeclineToggled({ asset_kind: 'page', checked: true });
    trackClientFinishClickedWithPending({ remaining_count: 2 });
    trackClientChecklistResumed();

    const sensitiveKeyPattern = /(token|email|_name$|^name|asset_name|secret)/i;
    for (const [, properties] of capturePosthogEventMock.mock.calls) {
      for (const [key, value] of Object.entries(properties ?? {})) {
        expect(key).not.toMatch(sensitiveKeyPattern);
        if (typeof value === 'string') {
          expect(value).not.toContain(secretToken);
          expect(value).not.toMatch('@');
        }
      }
    }
  });
});

  it('carries only kind-level data — no tokens, emails, business names, or asset names', () => {
    const secretToken = 'tok_live_do_not_send';

    trackInviteReceiptShown({ business_count: 1 });
    trackInviteQuestionShown({ business_count: 2 });
    trackInviteBusinessChosen({ business_count: 2 });
    trackInviteAssetsLoaded({
      available_ad_accounts: 1,
      available_pages: 1,
      available_instagram: 1,
      available_catalogs: 1,
      available_datasets: 1,
      business_count: 1,
      selection_required: false,
      has_load_warnings: false,
    });
    trackInviteCtaBlocked({ platform: 'meta_ads', reason_kind: 'create_required' });
    trackInviteSelectionSaved({ platform: 'meta_ads', total_selected: 4, product_count: 1 });
    trackInviteGrantChecklistToggled({ row_id: 'step-1', checked: true });
    trackInviteVerifyResult({ result_kind: 'waiting', verified_count: 0, unresolved_count: 2 });
    trackInviteProgressCheckRequested();

    const sensitiveKeyPattern = /(token|email|_name$|^name|asset_name|secret)/i;
    for (const [, properties] of capturePosthogEventMock.mock.calls) {
      for (const [key, value] of Object.entries(properties ?? {})) {
        expect(key).not.toMatch(sensitiveKeyPattern);
        if (typeof value === 'string') {
          expect(value).not.toContain(secretToken);
          expect(value).not.toMatch('@');
        }
      }
    }
  });
});
