import { describe, expect, it } from 'vitest';
import { readMetaOAuthScopeGap } from '../meta-connection-error-response.js';

describe('readMetaOAuthScopeGap', () => {
  it('detects incomplete Meta OAuth consent from authorization metadata', () => {
    const gap = readMetaOAuthScopeGap({
      grantedScopes: ['pages_show_list'],
      oauthScopesComplete: false,
      missingOAuthScopes: ['ads_management'],
    });

    expect(gap?.missingOAuthScopes).toEqual(['ads_management']);
  });

  it('returns null when OAuth scopes are complete', () => {
    expect(
      readMetaOAuthScopeGap({
        oauthScopesComplete: true,
        missingOAuthScopes: [],
      }),
    ).toBeNull();
  });
});
