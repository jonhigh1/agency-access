import type {
  ClientDetailPlatformGroupStatus,
  ClientDetailProductStatus,
} from '@agency-platform/shared';

type BadgeConfig =
  | { status: 'active' | 'pending' | 'expired' | 'revoked'; label?: never; badgeVariant?: never }
  | { badgeVariant: 'warning' | 'default' | 'danger'; label: string; status?: never };

export function getPlatformGroupBadgeConfig(
  status: ClientDetailPlatformGroupStatus
): BadgeConfig {
  switch (status) {
    case 'connected':
      return { status: 'active' };
    case 'partial':
      return { badgeVariant: 'warning', label: 'Partial' };
    case 'needs_follow_up':
      return { badgeVariant: 'warning', label: 'Needs Follow-Up' };
    case 'expired':
      return { status: 'expired' };
    case 'revoked':
      return { status: 'revoked' };
    case 'pending':
    default:
      return { status: 'pending' };
  }
}

export function getProductBadgeConfig(status: ClientDetailProductStatus): BadgeConfig {
  switch (status) {
    case 'connected':
      return { status: 'active' };
    case 'selection_required':
      return { badgeVariant: 'warning', label: 'Selection Required' };
    case 'no_assets':
      return { badgeVariant: 'default', label: 'No Assets Found' };
    case 'expired':
      return { status: 'expired' };
    case 'revoked':
      return { status: 'revoked' };
    // Lost grant: the client authorized but access died. Its own badge —
    // never the pending fallthrough, which reads as "waiting on the client".
    case 'needs_reconnect':
      return { badgeVariant: 'danger', label: 'Reconnect Required' };
    case 'pending':
    default:
      return { status: 'pending' };
  }
}

export function formatConnectedProgress(fulfilledCount: number, requestedCount: number): string {
  return `${fulfilledCount}/${requestedCount} connected`;
}
