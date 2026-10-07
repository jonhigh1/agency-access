import { describe, expect, it } from '@jest/globals';
import { parseMetaGraphApiErrorText } from '../meta-graph-api-error';

describe('parseMetaGraphApiErrorText', () => {
  it('includes type, subcode, and fbtrace_id in the display message', () => {
    const details = parseMetaGraphApiErrorText(
      JSON.stringify({
        error: {
          code: 100,
          error_subcode: 33,
          type: 'OAuthException',
          message: 'Unsupported get request.',
          fbtrace_id: 'AaZ-trace',
        },
      })
    );

    expect(details.code).toBe(100);
    expect(details.errorSubcode).toBe(33);
    expect(details.type).toBe('OAuthException');
    expect(details.fbtraceId).toBe('AaZ-trace');
    expect(details.displayMessage).toContain('Meta Graph error #100 (OAuthException)');
    expect(details.displayMessage).toContain('Unsupported get request.');
    expect(details.displayMessage).toContain('subcode 33');
    expect(details.displayMessage).toContain('fbtrace_id AaZ-trace');
  });
});
