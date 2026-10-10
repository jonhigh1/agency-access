import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerPosthogIdentityClient, setPosthogUserIdentity, resetPosthogIdentityForTests } from '../posthog-identity';

describe('PostHog user identity', () => {
  beforeEach(() => resetPosthogIdentityForTests());
  function client(initial: string | undefined = undefined) {
    let properties: Record<string, unknown> = { $user_id: initial };
    return {
      identify: vi.fn((id: string) => { properties.$user_id = id; }),
      reset: vi.fn(() => { properties = {}; }),
      register: vi.fn((next: Record<string, unknown>) => { Object.assign(properties, next); }),
      get_property: vi.fn((key: string) => properties[key]),
    };
  }
  it('applies auth resolved before deferred SDK initialization without PII', () => {
    setPosthogUserIdentity('user-1'); const sdk = client();
    registerPosthogIdentityClient(sdk);
    expect(sdk.identify).toHaveBeenCalledExactlyOnceWith('user-1');
  });
  it('resets before switching accounts and does not merge two signed-in people', () => {
    const sdk = client(); registerPosthogIdentityClient(sdk);
    setPosthogUserIdentity('user-1'); setPosthogUserIdentity('user-1'); setPosthogUserIdentity('user-2');
    expect(sdk.identify).toHaveBeenCalledTimes(2);
    expect(sdk.reset).toHaveBeenCalledTimes(1);
    expect(sdk.reset.mock.invocationCallOrder[0]).toBeLessThan(sdk.identify.mock.invocationCallOrder[1]);
  });
  it('clears persisted identities on logout or entry to an anonymous recipient flow', () => {
    const sdk = client('previous-user'); setPosthogUserIdentity(null);
    registerPosthogIdentityClient(sdk); setPosthogUserIdentity(null);
    expect(sdk.reset).toHaveBeenCalledTimes(1); expect(sdk.identify).not.toHaveBeenCalled();
  });
  it('waits for Clerk rather than changing identity during unresolved auth', () => {
    const sdk = client('previous-user'); registerPosthogIdentityClient(sdk);
    expect(sdk.reset).not.toHaveBeenCalled(); expect(sdk.identify).not.toHaveBeenCalled();
  });
  it('isolates recipient activity when returning to the agency and across full page loads', () => {
    const sdk = client(); registerPosthogIdentityClient(sdk);
    setPosthogUserIdentity(null, true);
    resetPosthogIdentityForTests();
    registerPosthogIdentityClient(sdk);
    setPosthogUserIdentity('agency-user', false);
    expect(sdk.reset).toHaveBeenCalledTimes(1);
    expect(sdk.reset.mock.invocationCallOrder[0]).toBeLessThan(sdk.identify.mock.invocationCallOrder[0]);
  });
});
