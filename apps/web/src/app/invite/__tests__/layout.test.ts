import { describe, expect, it } from 'vitest';

import { metadata } from '../layout';

/**
 * KTD13: the whole /invite tree — including the oauth-callback sibling, whose
 * URL carries OAuth code and state query parameters — must suppress the
 * Referer header. The policy lives on the shared invite layout so no nested
 * route can opt out by being forgotten.
 */
describe('invite root layout metadata (KTD13)', () => {
  it('suppresses the referrer for every route under /invite', () => {
    expect(metadata.referrer).toBe('no-referrer');
  });
});
