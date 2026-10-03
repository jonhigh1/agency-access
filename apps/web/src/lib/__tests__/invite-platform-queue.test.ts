import { describe, expect, it } from 'vitest';
import type { ClientAccessRequestPlatformGroup, Platform } from '@agency-platform/shared';
import { buildInvitePlatformQueue } from '../invite-platform-queue';
import { buildInvitePlatformChecklist } from '../invite/platform-status';

const REQUESTED_PLATFORMS: ClientAccessRequestPlatformGroup[] = [
  {
    platformGroup: 'google',
    products: [{ product: 'google_ads', accessLevel: 'admin' }],
  },
  {
    platformGroup: 'meta',
    products: [{ product: 'meta_ads', accessLevel: 'admin' }],
  },
  {
    platformGroup: 'mailchimp',
    products: [{ product: 'mailchimp', accessLevel: 'admin' }],
  },
];

describe('buildInvitePlatformQueue', () => {
  it('uses the first incomplete platform as the active platform by default', () => {
    const queue = buildInvitePlatformQueue({
      platforms: REQUESTED_PLATFORMS,
      completedPlatforms: new Set<Platform>(['google']),
    });

    expect(queue.activePlatform?.platformGroup).toBe('meta');
    expect(queue.completedPlatforms.map((group) => group.platformGroup)).toEqual(['google']);
    expect(queue.remainingPlatforms.map((group) => group.platformGroup)).toEqual(['mailchimp']);
    expect(queue.nextPlatform?.platformGroup).toBe('mailchimp');
  });

  it('restores the returning oauth platform as active when it is still incomplete', () => {
    const queue = buildInvitePlatformQueue({
      platforms: REQUESTED_PLATFORMS,
      completedPlatforms: new Set<Platform>(),
      returningPlatform: 'meta',
    });

    expect(queue.activePlatform?.platformGroup).toBe('meta');
    expect(queue.remainingPlatforms.map((group) => group.platformGroup)).toEqual([
      'google',
      'mailchimp',
    ]);
    expect(queue.nextPlatform?.platformGroup).toBe('google');
  });

  it('returns no active platform when every requested platform is already completed', () => {
    const queue = buildInvitePlatformQueue({
      platforms: REQUESTED_PLATFORMS,
      completedPlatforms: new Set<Platform>(['google', 'meta', 'mailchimp']),
      returningPlatform: 'meta',
    });

    expect(queue.activePlatform).toBeNull();
    expect(queue.remainingPlatforms).toEqual([]);
    expect(queue.nextPlatform).toBeNull();
  });

  it('keeps the active platform aligned with the first non-done checklist entry', () => {
    // One progress surface (R3): the stage shows the platform the checklist
    // lists as not done first — the queue and the checklist can never disagree.
    const completedPlatforms = new Set<Platform>(['google']);
    const queue = buildInvitePlatformQueue({
      platforms: REQUESTED_PLATFORMS,
      completedPlatforms,
    });
    const checklist = buildInvitePlatformChecklist({
      platforms: REQUESTED_PLATFORMS,
      completedPlatforms,
    });

    const firstOpenEntry = checklist.find((entry) => entry.status !== 'done');
    expect(queue.activePlatform?.platformGroup).toBe(firstOpenEntry?.platform);
  });

  it('skips a waiting manual report and advances to the next actionable platform', () => {
    const queue = buildInvitePlatformQueue({
      platforms: [
        { platformGroup: 'beehiiv', products: [{ product: 'beehiiv', accessLevel: 'admin' }] },
        { platformGroup: 'zapier', products: [{ product: 'zapier', accessLevel: 'admin' }] },
      ],
      completedPlatforms: new Set<Platform>(),
      unresolvedProducts: [{ product: 'beehiiv', platformGroup: 'beehiiv', reason: 'pending' }],
    });

    expect(queue.activePlatform?.platformGroup).toBe('zapier');
    expect(queue.nextPlatform).toBeNull();
  });

  it('returns no active platform when every remaining platform is waiting on verification', () => {
    const queue = buildInvitePlatformQueue({
      platforms: [{ platformGroup: 'beehiiv', products: [{ product: 'beehiiv', accessLevel: 'admin' }] }],
      completedPlatforms: new Set<Platform>(),
      unresolvedProducts: [{ product: 'beehiiv', platformGroup: 'beehiiv', reason: 'pending' }],
    });

    expect(queue.activePlatform).toBeNull();
    expect(queue.nextPlatform).toBeNull();
  });
});
