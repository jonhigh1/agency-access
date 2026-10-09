import { describe, expect, it } from 'vitest';
import { manualConfirmationPlatforms } from '@agency-platform/shared';
import { MANUAL_INVITE_PLATFORMS } from '../client-invite-platforms';

// GOLDEN — regenerate only via:
//   npx tsx scripts/generate-platform-registry-golden.ts --acknowledge=DEC-015
// Provenance: acknowledged under DEC-015 (docs/DECISIONS.md), 2026-10-08.
// Frozen literals; NEVER snapshots.
//
// Pins the web manual-invite list to today's seven members in declaration
// order and to the shared registry derivation (sorted — the two orderings
// intentionally differ). Phase 2c collapses this hand-typed list to the
// derived import; this golden is the equality contract until then.

describe('MANUAL_INVITE_PLATFORMS golden', () => {
  it('is exactly the seven manual-invite platforms, in web declaration order', () => {
    expect([...MANUAL_INVITE_PLATFORMS]).toEqual([
      'kit',
      'mailchimp',
      'beehiiv',
      'klaviyo',
      'pinterest',
      'shopify',
      'zapier',
    ]);
  });

  it('equals the shared registry derivation', () => {
    expect([...MANUAL_INVITE_PLATFORMS].sort()).toEqual([...manualConfirmationPlatforms].sort());
  });
});
