import { describe, expect, it, vi } from 'vitest';
import { logger } from '../logger.js';
import {
  logMetaClientGrantResult,
  parseMetaGraphErrorCodesFromMessage,
} from '../meta-client-grant-log.js';

describe('meta-client-grant-log', () => {
  it('parses Meta Graph error codes from assignment failure messages', () => {
    expect(
      parseMetaGraphErrorCodesFromMessage(
        'Assigned user mutation failed (190:463): User must be part of the business'
      )
    ).toEqual({ metaCode: 190, metaErrorSubcode: 463 });
  });

  it('logs meta_client_grant_result without token or email fields', () => {
    const infoSpy = vi.spyOn(logger, 'info').mockImplementation(() => undefined);

    logMetaClientGrantResult({
      assetKind: 'page',
      recipientKind: 'human',
      success: false,
      metaCode: 190,
      metaErrorSubcode: 463,
    });

    expect(infoSpy).toHaveBeenCalledWith('meta_client_grant_result', {
      assetKind: 'page',
      recipientKind: 'human',
      success: false,
      metaCode: 190,
      metaErrorSubcode: 463,
    });

    infoSpy.mockRestore();
  });
});
