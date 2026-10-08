import { beforeEach, describe, expect, it, vi } from 'vitest';

const { workMock } = vi.hoisted(() => ({
  workMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('pg-boss', () => ({
  PgBoss: vi.fn(function PgBossMock() {
    return {
      on: vi.fn(),
      start: vi.fn().mockResolvedValue(undefined),
      work: workMock,
      createQueue: vi.fn(),
    };
  }),
}));

vi.mock('@/lib/env', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import { registerHandler } from '../pg-boss.js';

describe('registerHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('forwards localConcurrency to pg-boss work()', async () => {
    await registerHandler('meta-marketing-api-tier-daily', async () => {}, {
      localConcurrency: 1,
    });

    expect(workMock).toHaveBeenCalledWith(
      'meta-marketing-api-tier-daily',
      expect.objectContaining({ includeMetadata: true, localConcurrency: 1 }),
      expect.any(Function),
    );
  });
});
