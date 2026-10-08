import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
}));

let resolveImport: ((value: { default: { capture: typeof captureMock } }) => void) | null = null;
let importPromise: Promise<{ default: { capture: typeof captureMock } }>;

vi.mock('posthog-js', () => {
  importPromise = new Promise((resolve) => {
    resolveImport = resolve;
  });
  return importPromise;
});

describe('capture-posthog', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    captureMock.mockReset();
    resolveImport = null;
    importPromise = new Promise((resolve) => {
      resolveImport = resolve;
    });
    vi.doMock('posthog-js', () => importPromise);
    const { resetCapturePosthogForTests } = await import('../capture-posthog');
    resetCapturePosthogForTests();
  });

  it('captures a single event after posthog loads', async () => {
    const { capturePosthogEvent } = await import('../capture-posthog');
    const pending = capturePosthogEvent('invite_link_copied', { surface: 'detail' });
    resolveImport!({ default: { capture: captureMock } });
    await pending;

    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock).toHaveBeenCalledWith('invite_link_copied', { surface: 'detail' });
  });

  it('strips PII from invite_* events at the PostHog boundary', async () => {
    const { capturePosthogEvent } = await import('../capture-posthog');
    const pending = capturePosthogEvent('invite_opened', {
      access_request_id: 'req-1',
      surface: 'invite_page',
      agency_name: 'Agency Co',
      client_name: 'Client Co',
      client_email: 'client@example.com',
      email: 'other@example.com',
    });
    resolveImport!({ default: { capture: captureMock } });
    await pending;

    expect(captureMock).toHaveBeenCalledWith('invite_opened', {
      access_request_id: 'req-1',
      surface: 'invite_page',
    });
  });

  it('strips client PII from client_* events at the PostHog boundary', async () => {
    const { capturePosthogEvent } = await import('../capture-posthog');
    const pending = capturePosthogEvent('client_authorization_started', {
      access_request_id: 'req-1',
      client_email: 'client@example.com',
      client_name: 'Client Co',
      agency_name: 'Agency Co',
      is_preview: false,
    });
    resolveImport!({ default: { capture: captureMock } });
    await pending;

    expect(captureMock).toHaveBeenCalledWith('client_authorization_started', {
      access_request_id: 'req-1',
      is_preview: false,
    });
  });

  it('strips invite and custom bearer values at the PostHog boundary', async () => {
    const { capturePosthogEvent } = await import('../capture-posthog');
    const pending = capturePosthogEvent('oauth_callback_failure', {
      access_request_token: 'invite-secret',
      token: 'provider-secret',
      error_code: 'OAUTH_FAILED',
    });
    resolveImport!({ default: { capture: captureMock } });
    await pending;

    expect(captureMock).toHaveBeenCalledWith('oauth_callback_failure', { error_code: 'OAUTH_FAILED' });
  });

  it('serializes concurrent captures so both events are recorded', async () => {
    const { capturePosthogEvent } = await import('../capture-posthog');

    const first = capturePosthogEvent('invite_link_copied', { surface: 'detail' });
    const second = capturePosthogEvent('invite_sent', { channel: 'copy', surface: 'detail' });

    resolveImport!({ default: { capture: captureMock } });
    await Promise.all([first, second]);

    expect(captureMock).toHaveBeenCalledTimes(2);
    expect(captureMock.mock.calls[0]).toEqual(['invite_link_copied', { surface: 'detail' }]);
    expect(captureMock.mock.calls[1]).toEqual([
      'invite_sent',
      { channel: 'copy', surface: 'detail' },
    ]);
  });

  it('captures paired invite events in order from one posthog load', async () => {
    const { capturePosthogEvents } = await import('../capture-posthog');
    const pending = capturePosthogEvents([
      {
        event: 'invite_link_copied',
        properties: {
          access_request_id: 'req-1',
          access_request_token: 'tok-abc',
          surface: 'detail',
        },
      },
      {
        event: 'invite_sent',
        properties: {
          access_request_id: 'req-1',
          access_request_token: 'tok-abc',
          channel: 'copy',
          surface: 'detail',
        },
      },
    ]);

    resolveImport!({ default: { capture: captureMock } });
    await pending;

    expect(captureMock).toHaveBeenCalledTimes(2);
    expect(captureMock.mock.calls).toEqual([
      ['invite_link_copied', { access_request_id: 'req-1', surface: 'detail' }],
      ['invite_sent', { access_request_id: 'req-1', channel: 'copy', surface: 'detail' }],
    ]);
  });

  it('adds funnel join props at call time and still strips PII and tokens', async () => {
    const { capturePosthogEvent } = await import('../capture-posthog');
    const funnel = await import('../invite-funnel-properties');
    funnel.setInviteFunnelContext(
      funnel.buildInviteFunnelProperties({
        accessRequestId: 'req-1',
        requestAgencyId: 'agency-a',
        requestAgencyInternal: false,
      })
    );
    const pending = capturePosthogEvent('client_authorization_completed', {
      access_request_token: 'tok-abc',
      client_email: 'client@example.com',
      total_platforms: 1,
    });
    // Context cleared before the lazy import settles must not drop the props.
    funnel.setInviteFunnelContext(null);
    resolveImport!({ default: { capture: captureMock } });
    await pending;

    expect(captureMock).toHaveBeenCalledWith('client_authorization_completed', {
      access_request_id: 'req-1',
      agency_id: 'agency-a',
      clerk_user_id: null,
      is_preview: false,
      is_internal: false,
      total_platforms: 1,
    });
  });
});
