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
});
