import posthog from 'posthog-js';

type OAuthCallbackSuccessProps = {
  platform: string;
  auth_source: 'agency_redirect' | 'agency_meta_popup' | 'client_redirect' | 'client_meta_popup';
  agency_id?: string | null;
  connection_id?: string | null;
  access_request_token?: string | null;
  requires_business_selection?: boolean;
};

type OAuthCallbackFailureProps = {
  platform: string | null;
  error_code: string;
  auth_source: 'agency_redirect' | 'agency_meta_popup' | 'client_redirect' | 'client_meta_popup';
  error_message?: string | null;
  agency_id?: string | null;
  access_request_token?: string | null;
};

function normalizePlatform(platform: string | null | undefined): string {
  if (typeof platform === 'string' && platform.trim().length > 0) {
    return platform;
  }

  return 'unknown';
}

export function trackOAuthCallbackSuccess(properties: OAuthCallbackSuccessProps): void {
  const platform = normalizePlatform(properties.platform);

  try {
    posthog.capture('oauth_callback_success', {
      ...properties,
      platform,
    });
  } catch {
    // Non-blocking analytics path.
  }
}

export function trackOAuthCallbackFailure(properties: OAuthCallbackFailureProps): void {
  const platform = properties.platform ? normalizePlatform(properties.platform) : 'unknown';

  try {
    posthog.capture('oauth_callback_failure', {
      ...properties,
      platform,
    });
    // Keep legacy event name for existing PostHog insights during transition.
    posthog.capture('oauth_callback_error', {
      agency_id: properties.agency_id,
      platform,
      error_code: properties.error_code,
      error_message: properties.error_message,
      auth_source: properties.auth_source,
      access_request_token: properties.access_request_token,
    });
  } catch {
    // Non-blocking analytics path.
  }
}

export function trackClientOAuthExchangeSuccess(properties: {
  platform: string;
  access_request_token: string;
  connection_id: string;
  auth_source: 'client_redirect' | 'client_meta_popup';
}): void {
  trackOAuthCallbackSuccess({
    platform: properties.platform,
    auth_source: properties.auth_source,
    access_request_token: properties.access_request_token,
    connection_id: properties.connection_id,
  });

  try {
    posthog.capture('client_oauth_exchange_success', {
      platform: normalizePlatform(properties.platform),
      access_request_token: properties.access_request_token,
      connection_id: properties.connection_id,
      auth_source: properties.auth_source,
    });
  } catch {
    // Non-blocking analytics path.
  }
}

export function trackClientOAuthExchangeFailure(properties: {
  platform?: string | null;
  access_request_token?: string | null;
  error_code: string;
  error_message?: string | null;
  auth_source: 'client_redirect' | 'client_meta_popup';
}): void {
  trackOAuthCallbackFailure({
    platform: properties.platform ?? null,
    error_code: properties.error_code,
    error_message: properties.error_message,
    auth_source: properties.auth_source,
    access_request_token: properties.access_request_token,
  });

  try {
    posthog.capture('client_oauth_exchange_failure', {
      platform: properties.platform ? normalizePlatform(properties.platform) : 'unknown',
      access_request_token: properties.access_request_token,
      error_code: properties.error_code,
      error_message: properties.error_message,
      auth_source: properties.auth_source,
    });
  } catch {
    // Non-blocking analytics path.
  }
}
