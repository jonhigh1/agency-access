import { describe, expect, it } from 'vitest';
import { ApiResponseError, parseJsonResponse } from '../parse-json-response';

describe('parseJsonResponse', () => {
  it('preserves structured API error codes with the user-facing message', async () => {
    const response = {
      ok: false,
      statusText: 'Conflict',
      text: async () => JSON.stringify({
        data: null,
        error: { code: 'CREATION_OUTCOME_UNKNOWN', message: 'Refresh asset discovery.' },
      }),
    } as Response;

    await expect(parseJsonResponse(response)).rejects.toMatchObject({
      name: 'ApiResponseError',
      code: 'CREATION_OUTCOME_UNKNOWN',
      message: 'Refresh asset discovery.',
    });
    await expect(parseJsonResponse(response)).rejects.toBeInstanceOf(ApiResponseError);
  });
});
