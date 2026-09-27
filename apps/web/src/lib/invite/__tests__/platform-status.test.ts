import { describe, expect, it } from 'vitest';
import type {
  ClientAccessRequestPlatformGroup,
  ClientUnresolvedProduct,
} from '@agency-platform/shared';
import {
  DONE_COPY,
  GENERIC_ATTENTION_COPY,
  INVITE_CHIP_STATUS_BY_PLATFORM_STATUS,
  UNRESOLVED_REASON_RULES,
  buildInvitePlatformChecklist,
  resolveUnresolvedReasonRule,
} from '../platform-status';

const group = (platformGroup: string): ClientAccessRequestPlatformGroup => ({
  platformGroup: platformGroup as ClientAccessRequestPlatformGroup['platformGroup'],
  products: [{ product: `${platformGroup}_ads`, accessLevel: 'admin' }],
});

const unresolved = (
  platformGroup: string,
  reason: string
): ClientUnresolvedProduct => ({
  product: `${platformGroup}_ads`,
  platformGroup,
  reason,
});

const metaGroup: ClientAccessRequestPlatformGroup = {
  platformGroup: 'meta' as ClientAccessRequestPlatformGroup['platformGroup'],
  products: [{ product: 'meta_ads', accessLevel: 'admin' }],
};

const googleGroup: ClientAccessRequestPlatformGroup = {
  platformGroup: 'google' as ClientAccessRequestPlatformGroup['platformGroup'],
  products: [{ product: 'google_ads', accessLevel: 'admin' }],
};

describe('buildInvitePlatformChecklist', () => {
  it('shows one done entry and one action-needed entry with mapped copy', () => {
    const entries = buildInvitePlatformChecklist({
      platforms: [googleGroup, metaGroup],
      completedPlatforms: new Set(['google']),
      unresolvedProducts: [unresolved('meta', 'sharing_required')],
    });

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      platform: 'google',
      platformName: 'Google',
      status: 'done',
      copy: DONE_COPY,
    });
    expect(entries[1]).toMatchObject({
      platform: 'meta',
      platformName: 'Meta',
      status: 'action-needed',
    });
    expect(entries[1].copy).toBe(
      UNRESOLVED_REASON_RULES.sharing_required.copy('Meta')
    );
    expect(entries[1].copy).not.toContain('sharing_required');
  });

  it('maps every documented unresolved reason to its rule status and copy', () => {
    const reasons = Object.keys(UNRESOLVED_REASON_RULES);
    expect(reasons.length).toBeGreaterThanOrEqual(22);

    for (const reason of reasons) {
      const entries = buildInvitePlatformChecklist({
        platforms: [metaGroup],
        completedPlatforms: new Set(),
        unresolvedProducts: [unresolved('meta', reason)],
      });

      expect(entries, reason).toHaveLength(1);
      expect(entries[0].status, reason).toBe(UNRESOLVED_REASON_RULES[reason as keyof typeof UNRESOLVED_REASON_RULES].status);
      expect(entries[0].copy, reason).toBe(UNRESOLVED_REASON_RULES[reason as keyof typeof UNRESOLVED_REASON_RULES].copy('Meta'));
      // Copy names the platform and never leaks the raw enum identifier.
      expect(entries[0].copy, reason).toContain('Meta');
      expect(entries[0].copy, reason).not.toMatch(/_/);
      if (reason.includes('_')) {
        expect(entries[0].copy, reason).not.toContain(reason);
      }
    }
  });

  it('falls back to generic attention copy for an unknown reason', () => {
    const entries = buildInvitePlatformChecklist({
      platforms: [metaGroup],
      completedPlatforms: new Set(),
      unresolvedProducts: [unresolved('meta', 'brand_new_unknown_reason')],
    });

    expect(entries[0].status).toBe('attention');
    expect(entries[0].copy).toBe(GENERIC_ATTENTION_COPY('Meta'));
    expect(entries[0].copy).not.toContain('brand_new_unknown_reason');
  });

  it('reads sharing_required as client action-needed, distinct from selection_required', () => {
    const sharing = resolveUnresolvedReasonRule('sharing_required');
    const selection = resolveUnresolvedReasonRule('selection_required');

    expect(sharing.status).toBe('action-needed');
    expect(selection.status).toBe('action-needed');
    expect(sharing.copy('Meta')).not.toBe(selection.copy('Meta'));
  });

  it('reads assignee_selection_required as waiting-on-agency', () => {
    const rule = resolveUnresolvedReasonRule('assignee_selection_required');

    expect(rule.status).toBe('waiting-on-agency');
    expect(rule.copy('Meta')).toMatch(/agency/i);
    expect(rule.copy('Meta')).not.toMatch(/you (must|need|should)/i);
  });

  it('renders connect-first for a requested platform with no OAuth yet', () => {
    const entries = buildInvitePlatformChecklist({
      platforms: [metaGroup],
      completedPlatforms: new Set(),
      unresolvedProducts: [],
    });

    expect(entries[0].status).toBe('connect-first');
    expect(entries[0].copy).toContain('Connect Meta');
  });

  it('keeps authorization_required at connect-first, not attention', () => {
    const entries = buildInvitePlatformChecklist({
      platforms: [metaGroup],
      completedPlatforms: new Set(),
      unresolvedProducts: [unresolved('meta', 'authorization_required')],
    });

    expect(entries[0].status).toBe('connect-first');
  });

  it('ranks client action above waiting when a platform has several unresolved products', () => {
    const entries = buildInvitePlatformChecklist({
      platforms: [metaGroup],
      completedPlatforms: new Set(),
      unresolvedProducts: [
        unresolved('meta', 'assignee_selection_required'),
        { product: 'meta_pages', platformGroup: 'meta', reason: 'stale' },
      ],
    });

    expect(entries[0].status).toBe('action-needed');
    expect(entries[0].copy).toBe(UNRESOLVED_REASON_RULES.stale.copy('Meta'));
  });

  it('keeps requested order and resolves an unknown platform name defensively', () => {
    const entries = buildInvitePlatformChecklist({
      platforms: [metaGroup, googleGroup],
      completedPlatforms: new Set(),
    });

    expect(entries.map((entry) => entry.platform)).toEqual(['meta', 'google']);
    expect(entries.map((entry) => entry.platformName)).toEqual(['Meta', 'Google']);
  });
});

describe('INVITE_CHIP_STATUS_BY_PLATFORM_STATUS', () => {
  it('maps every checklist status onto a status chip', () => {
    expect(INVITE_CHIP_STATUS_BY_PLATFORM_STATUS.done).toBe('complete');
    expect(INVITE_CHIP_STATUS_BY_PLATFORM_STATUS['action-needed']).toBe('attention');
    expect(INVITE_CHIP_STATUS_BY_PLATFORM_STATUS['waiting-on-agency']).toBe('waiting');
    expect(INVITE_CHIP_STATUS_BY_PLATFORM_STATUS['connect-first']).toBe('active');
    expect(INVITE_CHIP_STATUS_BY_PLATFORM_STATUS.attention).toBe('attention');
  });
});
