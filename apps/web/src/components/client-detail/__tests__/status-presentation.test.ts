/**
 * Status presentation tests
 *
 * The badge config is the contract between the API's product statuses and the
 * rendered client-detail board. A lost grant must never fall through to the
 * "pending" badge — that reads as "waiting on the client" when the client
 * already authorized.
 */

import { describe, it, expect } from 'vitest';
import {
  getPlatformGroupBadgeConfig,
  getProductBadgeConfig,
} from '../status-presentation';

describe('getProductBadgeConfig', () => {
  it('maps needs_reconnect to its own danger badge, not the pending fallthrough', () => {
    expect(getProductBadgeConfig('needs_reconnect')).toEqual({
      badgeVariant: 'danger',
      label: 'Reconnect Required',
    });
  });

  it('keeps the existing member mappings unchanged', () => {
    expect(getProductBadgeConfig('connected')).toEqual({ status: 'active' });
    expect(getProductBadgeConfig('pending')).toEqual({ status: 'pending' });
    expect(getProductBadgeConfig('selection_required')).toEqual({
      badgeVariant: 'warning',
      label: 'Selection Required',
    });
    expect(getProductBadgeConfig('no_assets')).toEqual({
      badgeVariant: 'default',
      label: 'No Assets Found',
    });
    expect(getProductBadgeConfig('expired')).toEqual({ status: 'expired' });
    expect(getProductBadgeConfig('revoked')).toEqual({ status: 'revoked' });
  });
});

describe('getPlatformGroupBadgeConfig', () => {
  it('keeps the existing member mappings unchanged', () => {
    expect(getPlatformGroupBadgeConfig('connected')).toEqual({ status: 'active' });
    expect(getPlatformGroupBadgeConfig('pending')).toEqual({ status: 'pending' });
    expect(getPlatformGroupBadgeConfig('partial')).toEqual({
      badgeVariant: 'warning',
      label: 'Partial',
    });
    expect(getPlatformGroupBadgeConfig('needs_follow_up')).toEqual({
      badgeVariant: 'warning',
      label: 'Needs Follow-Up',
    });
    expect(getPlatformGroupBadgeConfig('expired')).toEqual({ status: 'expired' });
    expect(getPlatformGroupBadgeConfig('revoked')).toEqual({ status: 'revoked' });
  });
});
