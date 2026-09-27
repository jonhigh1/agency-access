import { describe, expect, it } from 'vitest';
import { redactSensitiveString, redactSentryEvent } from '../sentry-redaction.js';

describe('redactSentryEvent', () => {
  it('redacts public request tokens before request URLs enter logs', () => {
    expect(redactSensitiveString('/api/access-requests/invite-secret/instructions?code=oauth-code'))
      .toBe('/api/access-requests/[redacted]/instructions?code=[redacted]');
  });

  it('redacts Meta token exchange and proof values from URLs', () => {
    expect(redactSensitiveString(
      'https://graph.facebook.com/oauth/access_token?fb_exchange_token=short-lived&appsecret_proof=proof&client_id=public-id'
    )).toBe(
      'https://graph.facebook.com/oauth/access_token?fb_exchange_token=[redacted]&appsecret_proof=[redacted]&client_id=public-id'
    );
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
