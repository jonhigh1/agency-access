import { describe, expect, it } from 'vitest';
import { manualConfirmationPlatforms } from '@agency-platform/shared';
import { MANUAL_INVITE_PLATFORMS } from '../client-invite-platforms';

// GOLDEN — regenerate only via:
//   npx tsx scripts/generate-platform-registry-golden.ts --acknowledge=DEC-015
// Provenance: acknowledged under DEC-015 (docs/DECISIONS.md), 2026-10-08.
// Frozen literals; NEVER snapshots.
//
// Pins the web manual-invite list to today's seven members (frozen set,
// order-free: order is owned by the registry's derivation) and, since the
// Phase 2c flip (DEC-015), to construction from the shared derivation.

// The manual seven, sorted alphabetically; frozen per the DEC-015 protocol.
const FROZEN_MANUAL_SEVEN = [
  'beehiiv',
  'kit',
  'klaviyo',
  'mailchimp',
  'pinterest',
  'shopify',
  'zapier',
];

describe('MANUAL_INVITE_PLATFORMS golden', () => {
  it('is exactly the seven manual-invite platforms (frozen set)', () => {
    expect([...MANUAL_INVITE_PLATFORMS].sort()).toEqual(FROZEN_MANUAL_SEVEN);
  });

  it('equals the shared registry derivation', () => {
    expect([...MANUAL_INVITE_PLATFORMS].sort()).toEqual([...manualConfirmationPlatforms].sort());
  });

  // Phase 2c flip contract (DEC-015): the list is constructed from the
  // registry derivation itself — elementwise, order included.
  it('is the shared registry derivation', () => {
    expect(MANUAL_INVITE_PLATFORMS).toEqual(manualConfirmationPlatforms);
  });
});
