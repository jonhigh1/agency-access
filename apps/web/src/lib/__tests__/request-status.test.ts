import { describe, expect, it } from 'vitest';
import { toRequestStatusBadgeStatus } from '../request-status';

describe('toRequestStatusBadgeStatus', () => {
  it.each(['pending', 'partial', 'completed', 'expired', 'revoked'])(
    'preserves the valid request status %s', (status) => {
      expect(toRequestStatusBadgeStatus(status)).toBe(status);
    }
  );

  it('maps an unknown API value to the safe fallback', () => {
    expect(toRequestStatusBadgeStatus('future_status')).toBe('unknown');
  });
});
