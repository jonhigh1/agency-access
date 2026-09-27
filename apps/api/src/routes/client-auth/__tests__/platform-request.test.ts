import { describe, expect, it } from 'vitest';
import { isPlatformRequested } from '../platform-request';

describe('isPlatformRequested', () => {
  it('accepts hierarchical and flat access request platform records', () => {
    expect(isPlatformRequested([{ platformGroup: 'meta', products: ['meta_ads'] }], 'meta')).toBe(true);
    expect(isPlatformRequested([{ platform: 'meta_ads', accessLevel: 'read' }], 'meta')).toBe(true);
    expect(isPlatformRequested([{ platform: 'meta' }], 'meta')).toBe(true);
  });

  it('rejects missing or unrelated platform records', () => {
    expect(isPlatformRequested(null, 'meta')).toBe(false);
    expect(isPlatformRequested([{ platform: 'google_ads' }], 'meta')).toBe(false);
    expect(isPlatformRequested([{ platformGroup: 'meta', products: ['meta_pages'] }], 'meta_ads')).toBe(false);
  });
});
