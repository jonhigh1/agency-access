import { describe, it, expect } from 'vitest';
import {
  HOUR_MS,
  PENDING_CLIFF_24H_MS,
  PENDING_CLIFF_72H_MS,
  getPendingCliff,
  isAwaitingClientStatus,
  selectPendingNudgeTargets,
  type PendingNudgeRequest,
} from '../pending-cliff';

describe('pending-cliff', () => {
  const baseNow = new Date('2026-03-05T12:00:00.000Z');

  describe('isAwaitingClientStatus', () => {
    it('returns true for pending and partial', () => {
      expect(isAwaitingClientStatus('pending')).toBe(true);
      expect(isAwaitingClientStatus('partial')).toBe(true);
    });

    it('returns false for completed, expired, and revoked', () => {
      expect(isAwaitingClientStatus('completed')).toBe(false);
      expect(isAwaitingClientStatus('expired')).toBe(false);
      expect(isAwaitingClientStatus('revoked')).toBe(false);
    });
  });

  describe('getPendingCliff', () => {
    it('returns null when the request is younger than 24 hours', () => {
      const createdAt = new Date(baseNow.getTime() - 23 * HOUR_MS).toISOString();
      expect(getPendingCliff(createdAt, baseNow)).toBeNull();
    });

    it('returns 24h when the request is at least 24 hours old but under 72 hours', () => {
      const createdAt = new Date(baseNow.getTime() - 30 * HOUR_MS).toISOString();
      expect(getPendingCliff(createdAt, baseNow)).toBe('24h');
    });

    it('returns 24h at exactly the 24 hour boundary', () => {
      const createdAt = new Date(baseNow.getTime() - PENDING_CLIFF_24H_MS).toISOString();
      expect(getPendingCliff(createdAt, baseNow)).toBe('24h');
    });

    it('returns 72h when the request is at least 72 hours old', () => {
      const createdAt = new Date(baseNow.getTime() - 80 * HOUR_MS).toISOString();
      expect(getPendingCliff(createdAt, baseNow)).toBe('72h');
    });

    it('returns 72h at exactly the 72 hour boundary', () => {
      const createdAt = new Date(baseNow.getTime() - PENDING_CLIFF_72H_MS).toISOString();
      expect(getPendingCliff(createdAt, baseNow)).toBe('72h');
    });
  });

  describe('selectPendingNudgeTargets', () => {
    const requests: PendingNudgeRequest[] = [
      {
        id: 'fresh',
        clientName: 'Fresh Client',
        status: 'pending',
        createdAt: new Date(baseNow.getTime() - 12 * HOUR_MS).toISOString(),
        uniqueToken: 'token-fresh',
      },
      {
        id: 'cliff-24',
        clientName: 'Day One Client',
        status: 'pending',
        createdAt: new Date(baseNow.getTime() - 26 * HOUR_MS).toISOString(),
        uniqueToken: 'token-24',
      },
      {
        id: 'cliff-72',
        clientName: 'Day Three Client',
        status: 'partial',
        createdAt: new Date(baseNow.getTime() - 75 * HOUR_MS).toISOString(),
        uniqueToken: 'token-72',
      },
      {
        id: 'completed',
        clientName: 'Done Client',
        status: 'completed',
        createdAt: new Date(baseNow.getTime() - 96 * HOUR_MS).toISOString(),
        uniqueToken: 'token-done',
      },
    ];

    it('returns only awaiting requests that crossed a cliff', () => {
      const targets = selectPendingNudgeTargets(requests, baseNow);
      expect(targets.map((target) => target.id)).toEqual(['cliff-24', 'cliff-72']);
      expect(targets.find((target) => target.id === 'cliff-24')?.cliff).toBe('24h');
      expect(targets.find((target) => target.id === 'cliff-72')?.cliff).toBe('72h');
    });

    it('excludes dismissed cliff/request pairs', () => {
      const targets = selectPendingNudgeTargets(requests, baseNow, {
        isDismissed: (requestId, cliff) => requestId === 'cliff-24' && cliff === '24h',
      });
      expect(targets.map((target) => target.id)).toEqual(['cliff-72']);
    });
  });
});
