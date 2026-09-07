export const HOUR_MS = 60 * 60 * 1000;
export const PENDING_CLIFF_24H_MS = 24 * HOUR_MS;
export const PENDING_CLIFF_72H_MS = 72 * HOUR_MS;

export type PendingCliff = '24h' | '72h';

export type PendingNudgeRequest = {
  id: string;
  clientName: string;
  status: string;
  createdAt: string;
  uniqueToken: string;
};

export type PendingNudgeTarget = PendingNudgeRequest & {
  cliff: PendingCliff;
};

const AWAITING_CLIENT_STATUSES = new Set(['pending', 'partial']);

export function isAwaitingClientStatus(status: string): boolean {
  return AWAITING_CLIENT_STATUSES.has(status);
}

export function getPendingCliff(createdAt: string | Date, now: Date = new Date()): PendingCliff | null {
  const createdMs = typeof createdAt === 'string' ? Date.parse(createdAt) : createdAt.getTime();
  if (Number.isNaN(createdMs)) {
    return null;
  }

  const ageMs = now.getTime() - createdMs;
  if (ageMs >= PENDING_CLIFF_72H_MS) {
    return '72h';
  }

  if (ageMs >= PENDING_CLIFF_24H_MS) {
    return '24h';
  }

  return null;
}

export function selectPendingNudgeTargets(
  requests: PendingNudgeRequest[],
  now: Date = new Date(),
  options: {
    isDismissed?: (requestId: string, cliff: PendingCliff) => boolean;
  } = {}
): PendingNudgeTarget[] {
  const isDismissed = options.isDismissed ?? (() => false);

  return requests.flatMap((request) => {
    if (!isAwaitingClientStatus(request.status)) {
      return [];
    }

    const cliff = getPendingCliff(request.createdAt, now);
    if (!cliff || isDismissed(request.id, cliff)) {
      return [];
    }

    return [{ ...request, cliff }];
  });
}
