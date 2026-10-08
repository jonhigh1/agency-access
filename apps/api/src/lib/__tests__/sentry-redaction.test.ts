import { describe, expect, it } from 'vitest';
import {
  redactSensitiveString,
  redactSentryEvent,
  scrubSentryBreadcrumb,
} from '../sentry-redaction.js';

describe('redactSentryEvent', () => {
  it('redacts public request tokens before request URLs enter logs', () => {
    expect(redactSensitiveString('/api/access-requests/invite-secret/instructions?code=oauth-code'))
      .toBe('/api/access-requests/[redacted]/instructions?code=[redacted]');
  });

  it('drops Meta token exchange and proof params from Graph URLs', () => {
    expect(redactSensitiveString(
      'https://graph.facebook.com/oauth/access_token?fb_exchange_token=short-lived&appsecret_proof=proof&client_id=public-id'
    )).toBe(
      'https://graph.facebook.com/oauth/access_token?client_id=public-id'
    );
  });

  it('redacts Meta ad account ids and long numeric Graph path segments', () => {
    expect(
      redactSensitiveString(
        'https://graph.facebook.com/v25.0/act_1234567890/insights?fields=spend&access_token=EAAtok&limit=5'
      )
    ).toBe('https://graph.facebook.com/v25.0/act_[redacted]/insights?fields=spend&limit=5');

    expect(
      redactSensitiveString('GET https://graph.facebook.com/v25.0/112233445566778/agencies')
    ).toBe('GET https://graph.facebook.com/v25.0/[redacted]/agencies');
  });

  it('scrubs Graph URLs on Sentry HTTP breadcrumbs while keeping the breadcrumb', () => {
    const breadcrumb = {
      type: 'http',
      category: 'fetch',
      data: {
        method: 'GET',
        url: 'https://graph.facebook.com/v25.0/act_999000111/campaigns?access_token=secret-token',
        status_code: 200,
        'http.query': '?fields=id&access_token=secret-token&appsecret_proof=proof',
        'url.path': '/v25.0/123456789012/assigned_users',
      },
    };

    const scrubbed = scrubSentryBreadcrumb(breadcrumb);
    const serialized = JSON.stringify(scrubbed);

    expect(scrubbed.type).toBe('http');
    expect(scrubbed.category).toBe('fetch');
    expect(scrubbed.data.method).toBe('GET');
    expect(scrubbed.data.status_code).toBe(200);
    expect(serialized).not.toContain('act_999000111');
    expect(serialized).not.toContain('secret-token');
    expect(serialized).not.toContain('appsecret_proof=proof');
    expect(serialized).not.toContain('123456789012');
    expect(serialized).toContain('act_[redacted]');
    expect(serialized).toContain('/[redacted]/assigned_users');
  });

  it('redacts debug-token secrets in structured telemetry fields', () => {
    const serialized = JSON.stringify(redactSentryEvent({
      extra: {
        input_token: 'user-token',
        accessRequestToken: 'invite-secret',
        pageAccessToken: 'page-token-secret',
        appsecret_proof: 'proof-value',
        signed_request: 'signed-secret',
      },
    }));

    for (const secret of ['user-token', 'invite-secret', 'page-token-secret', 'proof-value', 'signed-secret']) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('removes invite and OAuth credentials from request data and breadcrumbs', () => {
    const event = {
      request: {
        url: 'https://api.example.test/api/client/invite-secret/assets?code=oauth-code&limit=5',
        query_string: 'state=oauth-state&include=assets',
        headers: {
          authorization: 'Bearer oauth-bearer',
          cookie: 'session=session-secret',
          'x-request-id': 'request-1',
        },
        data: { access_token: 'meta-access-token', platform: 'meta' },
      },
      extra: { refresh_token: 'meta-refresh-token', diagnostic: 'Bearer another-token' },
      breadcrumbs: [
        {
          data: {
            url: 'https://api.example.test/api/client/another-invite/oauth?state=another-state',
          },
        },
      ],
    };

    const redacted = redactSentryEvent(event as never);
    const serialized = JSON.stringify(redacted);

    for (const secret of [
      'invite-secret',
      'oauth-code',
      'meta-access-token',
      'oauth-state',
      'oauth-bearer',
      'session-secret',
      'meta-access-token',
      'meta-refresh-token',
      'another-invite',
      'another-state',
      'another-token',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).toContain('request-1');
    expect(serialized).toContain('include=assets');
  });

  it('redacts `auth_code` and invite tokens in query strings', () => {
    expect(redactSensitiveString('/invite/open?auth_code=oauth-code&access_request_token=invite-secret'))
      .toBe('/invite/[redacted]?auth_code=[redacted]&access_request_token=[redacted]');
  });
});
