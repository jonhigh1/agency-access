import { beforeEach, describe, expect, it, vi } from 'vitest';

const { captureMock } = vi.hoisted(() => ({
  captureMock: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: {
    capture: captureMock,
  },
}));

import {
  trackClientOAuthExchangeFailure,
  trackClientOAuthExchangeSuccess,
  trackOAuthCallbackFailure,
  trackOAuthCallbackSuccess,
} from '../oauth-events';

describe('oauth-events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tracks oauth_callback_success with normalized platform', () => {
    trackOAuthCallbackSuccess({
      platform: 'meta',
      auth_source: 'agency_meta_popup',
      agency_id: 'agency-1',
    });

    expect(captureMock).toHaveBeenCalledWith('oauth_callback_success', {
      platform: 'meta',
      auth_source: 'agency_meta_popup',
      agency_id: 'agency-1',
    });
  });

  it('tracks oauth_callback_failure and legacy oauth_callback_error', () => {
    trackOAuthCallbackFailure({
      platform: null,
      error_code: 'TOKEN_EXCHANGE_FAILED',
      error_message: 'Exchange failed',
      auth_source: 'agency_redirect',
      agency_id: 'agency-1',
    });

    expect(captureMock).toHaveBeenCalledWith('oauth_callback_failure', {
      platform: 'unknown',
      error_code: 'TOKEN_EXCHANGE_FAILED',
      error_message: 'Exchange failed',
      auth_source: 'agency_redirect',
      agency_id: 'agency-1',
    });

    expect(captureMock).toHaveBeenCalledWith('oauth_callback_error', {
      agency_id: 'agency-1',
      platform: 'unknown',
      error_code: 'TOKEN_EXCHANGE_FAILED',
      error_message: 'Exchange failed',
      auth_source: 'agency_redirect',
      access_request_token: undefined,
    });
  });

  it('tracks client oauth exchange success with client and shared events', () => {
    trackClientOAuthExchangeSuccess({
      platform: 'meta',
      access_request_token: 'token-abc',
      connection_id: 'conn-1',
      auth_source: 'client_meta_popup',
    });

    expect(captureMock).toHaveBeenCalledWith('oauth_callback_success', {
      platform: 'meta',
      auth_source: 'client_meta_popup',
      access_request_token: 'token-abc',
      connection_id: 'conn-1',
    });

    expect(captureMock).toHaveBeenCalledWith('client_oauth_exchange_success', {
      platform: 'meta',
      access_request_token: 'token-abc',
      connection_id: 'conn-1',
      auth_source: 'client_meta_popup',
    });
  });

  it('tracks client oauth exchange failure with client and shared events', () => {
    trackClientOAuthExchangeFailure({
      platform: 'meta',
      error_code: 'META_POPUP_FAILED',
      error_message: 'Popup blocked',
      auth_source: 'client_meta_popup',
      access_request_token: 'token-abc',
    });

    expect(captureMock).toHaveBeenCalledWith('oauth_callback_failure', {
      platform: 'meta',
      error_code: 'META_POPUP_FAILED',
      error_message: 'Popup blocked',
      auth_source: 'client_meta_popup',
      access_request_token: 'token-abc',
    });

    expect(captureMock).toHaveBeenCalledWith('client_oauth_exchange_failure', {
      platform: 'meta',
      access_request_token: 'token-abc',
      error_code: 'META_POPUP_FAILED',
      error_message: 'Popup blocked',
      auth_source: 'client_meta_popup',
    });
  });
});
