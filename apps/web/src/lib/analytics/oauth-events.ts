import { capturePosthogEvent } from '@/lib/analytics/capture-posthog';

type OAuthCallbackSuccessProps = {
  platform: string;
  auth_source: 'agency_redirect' | 'agency_meta_popup' | 'client_redirect' | 'client_meta_popup';
  agency_id?: string | null;
  connection_id?: string | null;
  requires_business_selection?: boolean;
};

type OAuthCallbackFailureProps = {
  platform: string | null;
  error_code: string;
  auth_source: 'agency_redirect' | 'agency_meta_popup' | 'client_redirect' | 'client_meta_popup';
  error_message?: string | null;
  agency_id?: string | null;
};

function normalizePlatform(platform: string | null | undefined): string {
  if (typeof platform === 'string' && platform.trim().length > 0) {
    return platform;
  }

  return 'unknown';
}

export function trackOAuthCallbackSuccess(properties: OAuthCallbackSuccessProps): void {
  const platform = normalizePlatform(properties.platform);
  void capturePosthogEvent('oauth_callback_success', {
    ...properties,
    platform,
  });
}

export function trackOAuthCallbackFailure(properties: OAuthCallbackFailureProps): void {
  const platform = properties.platform ? normalizePlatform(properties.platform) : 'unknown';
  const { error_message: _errorMessage, ...safeProperties } = properties;
  void capturePosthogEvent('oauth_callback_failure', {
    ...safeProperties,
    platform,
  });
  // Keep legacy event name for existing PostHog insights during transition.
  void capturePosthogEvent('oauth_callback_error', {
    agency_id: properties.agency_id,
    platform,
    error_code: properties.error_code,
    auth_source: properties.auth_source,
  });
}

export function trackClientOAuthExchangeSuccess(properties: {
  platform: string;
  connection_id: string;
  auth_source: 'client_redirect' | 'client_meta_popup';
}): void {
  trackOAuthCallbackSuccess({
    platform: properties.platform,
    auth_source: properties.auth_source,
    connection_id: properties.connection_id,
  });

  void capturePosthogEvent('client_oauth_exchange_success', {
    platform: normalizePlatform(properties.platform),
    connection_id: properties.connection_id,
    auth_source: properties.auth_source,
  });
}

export function trackClientOAuthExchangeFailure(properties: {
  platform?: string | null;
  error_code: string;
  error_message?: string | null;
  auth_source: 'client_redirect' | 'client_meta_popup';
}): void {
  trackOAuthCallbackFailure({
    platform: properties.platform ?? null,
    error_code: properties.error_code,
    auth_source: properties.auth_source,
  });

  void capturePosthogEvent('client_oauth_exchange_failure', {
    platform: properties.platform ? normalizePlatform(properties.platform) : 'unknown',
    error_code: properties.error_code,
    auth_source: properties.auth_source,
  });
}
