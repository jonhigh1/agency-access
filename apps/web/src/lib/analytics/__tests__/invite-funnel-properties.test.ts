import { afterEach, describe, expect, it } from 'vitest';
import {
  buildInviteFunnelProperties,
  isInviteFunnelEvent,
  resetInviteFunnelContextForTests,
  setAgencyViewerAnalyticsContext,
  setInviteFunnelContext,
  withInviteFunnelProperties,
} from '../invite-funnel-properties';

afterEach(() => {
  resetInviteFunnelContextForTests();
});

describe('buildInviteFunnelProperties', () => {
  it('anonymous client: agency from the request, no Clerk id, not a preview', () => {
    expect(
      buildInviteFunnelProperties({
        accessRequestId: 'req-1',
        requestAgencyId: 'agency-a',
        viewerClerkUserId: null,
        viewerAgencyId: null,
        requestAgencyInternal: false,
      })
    ).toEqual({
      access_request_id: 'req-1',
      agency_id: 'agency-a',
      clerk_user_id: null,
      is_preview: false,
      is_internal: false,
    });
  });

  it('agency viewing its own link is a preview', () => {
    const props = buildInviteFunnelProperties({
      accessRequestId: 'req-1',
      requestAgencyId: 'agency-a',
      viewerClerkUserId: 'user_viewer',
      viewerAgencyId: 'agency-a',
      requestAgencyInternal: false,
      viewerInternal: false,
    });
    expect(props.is_preview).toBe(true);
    expect(props.clerk_user_id).toBe('user_viewer');
  });

  it('a different signed-in agency opening the link is not a preview', () => {
    const props = buildInviteFunnelProperties({
      accessRequestId: 'req-1',
      requestAgencyId: 'agency-a',
      viewerAgencyId: 'agency-b',
    });
    expect(props.is_preview).toBe(false);
    expect(props.agency_id).toBe('agency-a');
  });

  it('is_internal is true when the request agency, the viewer, or dev bypass is internal', () => {
    expect(buildInviteFunnelProperties({ requestAgencyInternal: true }).is_internal).toBe(true);
    expect(
      buildInviteFunnelProperties({ requestAgencyInternal: false, viewerInternal: true }).is_internal
    ).toBe(true);
    expect(buildInviteFunnelProperties({ isDevelopmentBypass: true }).is_internal).toBe(true);
  });

  it('is_internal is null when no server verdict is known', () => {
    expect(buildInviteFunnelProperties({ accessRequestId: 'req-1' }).is_internal).toBeNull();
  });

  it('treats blank ids as missing', () => {
    expect(
      buildInviteFunnelProperties({ accessRequestId: '', requestAgencyId: ' ', viewerClerkUserId: '' })
    ).toMatchObject({ access_request_id: null, agency_id: null, clerk_user_id: null });
  });

  it('falls back to the viewer agency when the request agency is unknown', () => {
    expect(buildInviteFunnelProperties({ viewerAgencyId: 'agency-b' }).agency_id).toBe('agency-b');
  });
});

describe('isInviteFunnelEvent', () => {
  it.each([
    'invite_opened',
    'invite_sent',
    'invite_link_copied',
    'client_authorization_started',
    'client_authorization_completed',
    'client_authorization_complete_failed',
    'client_platform_authorized',
    'client_meta_grant_completed',
    'client_oauth_exchange_success',
    'meta_assets_selected',
  ])('%s is a funnel event', (event) => {
    expect(isInviteFunnelEvent(event)).toBe(true);
  });

  it.each(['client_list_load_failed', 'dashboard_viewed', 'access_request_created', 'subscription_started'])(
    '%s is not a funnel event',
    (event) => {
      expect(isInviteFunnelEvent(event)).toBe(false);
    }
  );
});

describe('withInviteFunnelProperties', () => {
  it('leaves properties untouched when no context is registered', () => {
    const props = { access_request_id: 'req-1', surface: 'detail' };
    expect(withInviteFunnelProperties('invite_sent', props)).toBe(props);
  });

  it('never enriches non-funnel events', () => {
    setInviteFunnelContext(
      buildInviteFunnelProperties({ accessRequestId: 'req-1', requestAgencyId: 'agency-a' })
    );
    expect(withInviteFunnelProperties('dashboard_viewed', { a: 1 })).toEqual({ a: 1 });
  });

  it('merges invite page context into grant events; explicit values win', () => {
    setInviteFunnelContext(
      buildInviteFunnelProperties({
        accessRequestId: 'req-1',
        requestAgencyId: 'agency-a',
        requestAgencyInternal: false,
      })
    );
    expect(
      withInviteFunnelProperties('client_authorization_completed', {
        access_request_id: undefined,
        total_platforms: 2,
      })
    ).toEqual({
      access_request_id: 'req-1',
      agency_id: 'agency-a',
      clerk_user_id: null,
      is_preview: false,
      is_internal: false,
      total_platforms: 2,
    });
    expect(
      withInviteFunnelProperties('client_platform_authorized', { access_request_id: null })
    ).toMatchObject({ access_request_id: 'req-1' });
    expect(
      withInviteFunnelProperties('invite_opened', { access_request_id: 'req-2' })
    ).toMatchObject({ access_request_id: 'req-2' });
  });

  it('adds context to events fired without properties', () => {
    setInviteFunnelContext(buildInviteFunnelProperties({ accessRequestId: 'req-1' }));
    expect(withInviteFunnelProperties('invite_progress_check_requested')).toMatchObject({
      access_request_id: 'req-1',
    });
  });

  it('agency surfaces: viewer context tags send events, never as a preview', () => {
    setAgencyViewerAnalyticsContext({
      agencyId: 'agency-a',
      clerkUserId: 'user_agency',
      isInternal: true,
    });
    expect(
      withInviteFunnelProperties('invite_sent', {
        access_request_id: 'req-9',
        channel: 'copy',
      })
    ).toEqual({
      access_request_id: 'req-9',
      agency_id: 'agency-a',
      clerk_user_id: 'user_agency',
      is_preview: false,
      is_internal: true,
      channel: 'copy',
    });
  });

  it('ignores an empty access_request_id placeholder in favour of context', () => {
    setInviteFunnelContext(buildInviteFunnelProperties({ accessRequestId: 'req-1' }));
    expect(withInviteFunnelProperties('invite_sent', { access_request_id: '' })).toMatchObject({
      access_request_id: 'req-1',
    });
  });

  it('invite page context takes precedence over the agency viewer context', () => {
    setAgencyViewerAnalyticsContext({ agencyId: 'agency-b', clerkUserId: 'user_b', isInternal: false });
    setInviteFunnelContext(
      buildInviteFunnelProperties({
        accessRequestId: 'req-1',
        requestAgencyId: 'agency-a',
        viewerAgencyId: 'agency-b',
        viewerClerkUserId: 'user_b',
      })
    );
    expect(withInviteFunnelProperties('invite_opened', {})).toMatchObject({
      agency_id: 'agency-a',
      is_preview: false,
    });
    setInviteFunnelContext(null);
    expect(withInviteFunnelProperties('invite_opened', {})).toMatchObject({ agency_id: 'agency-b' });
  });

  it('keeps a known is_internal verdict when a later caller only knows the same user', () => {
    setAgencyViewerAnalyticsContext({ agencyId: 'agency-a', clerkUserId: 'user_a', isInternal: true });
    setAgencyViewerAnalyticsContext({ agencyId: 'agency-a', clerkUserId: 'user_a', isInternal: null });
    expect(withInviteFunnelProperties('invite_sent', {})).toMatchObject({ is_internal: true });

    setAgencyViewerAnalyticsContext({ agencyId: 'agency-c', clerkUserId: 'user_c', isInternal: null });
    expect(withInviteFunnelProperties('invite_sent', {})).toMatchObject({
      agency_id: 'agency-c',
      is_internal: null,
    });
  });
});
