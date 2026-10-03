import { accessRequestService } from '../services/access-request.service.js';
import { logger } from './logger.js';

/**
 * Re-evaluate an access request after a verification write and return the new
 * lifecycle status for the response payload.
 *
 * Never throws: verification responses must not fail because the re-evaluation
 * or the status recompute failed.
 */
export async function applyPostVerifyReevaluation(
  accessRequestId: string
): Promise<string | undefined> {
  try {
    const result = await accessRequestService.markRequestAuthorized(accessRequestId);
    return result.data?.status;
  } catch (error) {
    logger.warn('Post-verify access request re-evaluation failed', {
      accessRequestId,
      error: error instanceof Error ? error.message : String(error),
    });
    return undefined;
  }
}
