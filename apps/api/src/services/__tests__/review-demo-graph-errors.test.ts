import { describe, expect, it } from 'vitest';
import { formatMetaGraphApiError } from '../review-demo-graph-errors.js';

describe('formatMetaGraphApiError', () => {
  it('extracts Meta error code and message from Graph JSON', () => {
    const details = formatMetaGraphApiError(
      JSON.stringify({
        error: {
          code: 3,
          message: 'Application does not have the capability to make this API call',
        },
      })
    );

    expect(details.code).toBe(3);
    expect(details.displayMessage).toBe(
      'Meta Graph error #3: Application does not have the capability to make this API call'
    );
  });

  it('parses JSON embedded in a longer error string', () => {
    const details = formatMetaGraphApiError(
      `Failed to verify Meta agency permissions: ${JSON.stringify({
        error: { code: 100, message: 'Invalid parameter' },
      })}`
    );

    expect(details.code).toBe(100);
    expect(details.message).toBe('Invalid parameter');
  });
});
