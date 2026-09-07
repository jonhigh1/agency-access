import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearInviteOAuthReturnToken,
  readInviteOAuthReturnToken,
  rememberInviteOAuthReturnToken,
} from '../client-invite-oauth';

describe('client-invite-oauth', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('stores and reads the invite return token', () => {
    rememberInviteOAuthReturnToken('token-abc');
    expect(readInviteOAuthReturnToken()).toBe('token-abc');
  });

  it('clears the invite return token', () => {
    rememberInviteOAuthReturnToken('token-abc');
    clearInviteOAuthReturnToken();
    expect(readInviteOAuthReturnToken()).toBeNull();
  });
});
