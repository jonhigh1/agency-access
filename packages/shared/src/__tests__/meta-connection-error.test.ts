import { describe, expect, it } from '@jest/globals';
import {
  mapMetaConnectionErrorFromApi,
  mapMetaGraphError,
  mapMetaOAuthIncompletePermissions,
} from '../meta-connection-error';

describe('mapMetaGraphError', () => {
  it('maps incomplete OAuth permissions from missing scope metadata', () => {
    const result = mapMetaOAuthIncompletePermissions(['ads_management', 'business_management']);

    expect(result.code).toBe('META_CONNECTION_INCOMPLETE_PERMISSIONS');
    expect(result.message).toContain('Ads management');
    expect(result.message).toContain('Business management');
    expect(result.nextSteps.some((step) => step.toLowerCase().includes('connect again'))).toBe(true);
  });

  it('maps not-admin Graph payloads', () => {
    const result = mapMetaGraphError({
      message: '(#200) Permissions error: User must be an admin of the ad account',
      code: 200,
    });

    expect(result?.code).toBe('META_CONNECTION_NOT_ADMIN');
    expect(result?.title).toMatch(/admin/i);
  });

  it('maps two-factor authentication requirements', () => {
    const result = mapMetaGraphError({
      message: 'Two-factor authentication is required to access this ad account',
      code: 190,
      error_subcode: 1340092,
    });

    expect(result?.code).toBe('META_CONNECTION_2FA_REQUIRED');
    expect(result?.nextSteps.join(' ')).toMatch(/two-factor/i);
  });

  it('maps Page owned by another Business', () => {
    const result = mapMetaGraphError({
      message: 'This Page is owned by another business and cannot be accessed',
      code: 100,
    });

    expect(result?.code).toBe('META_CONNECTION_PAGE_OWNERSHIP');
  });

  it('maps Business Portfolio mismatch copy', () => {
    const result = mapMetaGraphError({
      message: 'The Instagram account must belong to the same Business Manager as the ad account',
      code: 100,
    });

    expect(result?.code).toBe('META_CONNECTION_BM_MISMATCH');
  });

  it('does not surface raw Graph payloads in mapped messages', () => {
    const raw = '(#200) Permissions error: User must be an admin';
    const result = mapMetaGraphError({ message: raw, code: 200 });

    expect(result?.message).not.toContain('(#200)');
    expect(result?.message).not.toContain('OAuthException');
  });
});

describe('mapMetaConnectionErrorFromApi', () => {
  it('maps stable API codes for support', () => {
    expect(mapMetaConnectionErrorFromApi('META_CONNECTION_2FA_REQUIRED').code).toBe(
      'META_CONNECTION_2FA_REQUIRED',
    );
    expect(mapMetaConnectionErrorFromApi('INVALID_META_BUSINESS_PORTFOLIO').code).toBe(
      'META_CONNECTION_BM_MISMATCH',
    );
  });

  it('rehydrates incomplete permissions from error details', () => {
    const result = mapMetaConnectionErrorFromApi('META_CONNECTION_INCOMPLETE_PERMISSIONS', undefined, {
      missingOAuthScopes: ['pages_show_list'],
    });

    expect(result.code).toBe('META_CONNECTION_INCOMPLETE_PERMISSIONS');
    expect(result.message).toContain('Page list');
  });
});
