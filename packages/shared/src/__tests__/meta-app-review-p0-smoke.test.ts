import { describe, expect, it } from '@jest/globals';
import {
  META_CORE_PERMISSIONS,
  META_GRAPH_VERSION,
  META_PERMISSION_CONTRACT,
  sanitizeMetaOAuthScopes,
} from '../types';

/**
 * Ticket 12 — Meta App Review P0 smoke (no live Meta).
 * Fails CI if the OAuth contract or scope sanitizer regresses.
 */
describe('Meta App Review P0 smoke — OAuth contract', () => {
  it('pins Graph v25.0 and exactly the four core scopes', () => {
    expect(META_GRAPH_VERSION).toBe('v25.0');
    expect([...META_CORE_PERMISSIONS]).toEqual([
      'ads_management',
      'business_management',
      'pages_read_engagement',
      'pages_show_list',
    ]);
    expect(META_PERMISSION_CONTRACT.core.permissions).toEqual(META_CORE_PERMISSIONS);
  });

  it('sanitizer strips ads_read, catalog_management, and unknown scopes', () => {
    expect(
      sanitizeMetaOAuthScopes([
        'ads_read',
        ...META_CORE_PERMISSIONS,
        'catalog_management',
        'unknown_permission',
      ]),
    ).toEqual([...META_CORE_PERMISSIONS]);
    expect(sanitizeMetaOAuthScopes(['ads_read', 'catalog_management'])).toEqual([]);
  });
});
