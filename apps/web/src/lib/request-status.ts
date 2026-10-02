import type { StatusType } from '@/components/ui/status-badge';

const REQUEST_STATUS_VALUES: Record<string, StatusType> = {
  pending: 'pending',
  partial: 'partial',
  completed: 'completed',
  expired: 'expired',
  revoked: 'revoked',
};

export function toRequestStatusBadgeStatus(status: string): StatusType {
  return REQUEST_STATUS_VALUES[status] || 'unknown';
}
