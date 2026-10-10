/**
 * Meta OAuth popup wait helpers for the invite wizard (card 3 / U6).
 */

export function waitForMetaPopup(popup: Window): {
  promise: Promise<{ connectionId: string; platform: string }>;
  cleanup: () => void;
  cancel: () => void;
} {
  let timeout: number;
  let closeCheck: number;
  let finish: (result: { connectionId: string; platform: string }) => void;
  let fail: (error: Error) => void;
  let settled = false;
  const promise = new Promise<{ connectionId: string; platform: string }>((resolve, reject) => {
    finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    fail = (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
  });
  const cleanup = () => {
    window.removeEventListener('message', onMessage);
    window.clearTimeout(timeout);
    window.clearInterval(closeCheck);
  };
  const onMessage = (event: MessageEvent) => {
    const data = event.data;
    if (event.origin !== window.location.origin || event.source !== popup || data?.type !== 'authhub:oauth-result') return;
    if (data.success && typeof data.connectionId === 'string' && data.platform === 'meta') {
      finish({ connectionId: data.connectionId, platform: data.platform });
    } else {
      fail(new Error(data.errorCode === 'OAUTH_DENIED'
        ? 'You declined or cancelled access. Try again when ready.'
        : 'Meta could not complete authorization. Try again.'));
    }
  };
  window.addEventListener('message', onMessage);
  timeout = window.setTimeout(() => {
    fail(new Error('Meta authorization timed out. Close the pop-up and try again.'));
  }, 120_000);
  closeCheck = window.setInterval(() => {
    if (popup.closed) {
      fail(new Error('Meta authorization closed before it finished. Try again.'));
    }
  }, 500);
  return { promise, cleanup, cancel: () => fail(new Error('Meta authorization was cancelled.')) };
}
