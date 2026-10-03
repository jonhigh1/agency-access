import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/access-request.service', () => ({
  accessRequestService: {
    markRequestAuthorized: vi.fn(),
  },
}));

import { accessRequestService } from '@/services/access-request.service';
import { applyPostVerifyReevaluation } from '../authorization-reeval';

describe('applyPostVerifyReevaluation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the request status from a successful re-evaluation', async () => {
    vi.mocked(accessRequestService.markRequestAuthorized).mockResolvedValue({
      data: { id: 'request-1', status: 'partial' },
      error: null,
    } as any);

    const result = await applyPostVerifyReevaluation('request-1');

    expect(result).toBe('partial');
    expect(accessRequestService.markRequestAuthorized).toHaveBeenCalledWith('request-1');
  });

  it('returns undefined when the re-evaluation reports an error result', async () => {
    vi.mocked(accessRequestService.markRequestAuthorized).mockResolvedValue({
      data: null,
      error: { code: 'REQUEST_NOT_FOUND', message: 'Access request not found' },
    } as any);

    const result = await applyPostVerifyReevaluation('request-1');

    expect(result).toBeUndefined();
  });

  it('returns undefined instead of throwing when the re-evaluation rejects', async () => {
    vi.mocked(accessRequestService.markRequestAuthorized).mockRejectedValue(
      new Error('re-evaluation exploded')
    );

    await expect(applyPostVerifyReevaluation('request-1')).resolves.toBeUndefined();
  });
});
