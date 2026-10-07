export {
  parseMetaGraphApiErrorText,
  readMetaGraphApiErrorFromResponse,
  type MetaGraphApiErrorDetails,
} from '@agency-platform/shared';

import {
  parseMetaGraphApiErrorText,
  readMetaGraphApiErrorFromResponse,
  type MetaGraphApiErrorDetails,
} from '@agency-platform/shared';

/** @deprecated Prefer parseMetaGraphApiErrorText from shared */
export function formatMetaGraphApiError(raw: string): MetaGraphApiErrorDetails {
  return parseMetaGraphApiErrorText(raw);
}

/** @deprecated Prefer readMetaGraphApiErrorFromResponse from shared */
export async function readMetaGraphApiError(response: Response): Promise<MetaGraphApiErrorDetails> {
  return readMetaGraphApiErrorFromResponse(response);
}
