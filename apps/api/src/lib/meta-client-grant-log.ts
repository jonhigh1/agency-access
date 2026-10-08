import { logger } from './logger.js';

export type MetaClientGrantLogInput = {
  assetKind: string;
  recipientKind: string;
  success: boolean;
  metaCode?: number;
  metaErrorSubcode?: number;
};

export function logMetaClientGrantResult(input: MetaClientGrantLogInput): void {
  logger.info('meta_client_grant_result', {
    assetKind: input.assetKind,
    recipientKind: input.recipientKind,
    success: input.success,
    ...(input.metaCode !== undefined ? { metaCode: input.metaCode } : {}),
    ...(input.metaErrorSubcode !== undefined ? { metaErrorSubcode: input.metaErrorSubcode } : {}),
  });
}

export function logMetaClientVerifyResult(input: MetaClientGrantLogInput): void {
  logger.info('meta_client_verify_result', {
    assetKind: input.assetKind,
    recipientKind: input.recipientKind,
    success: input.success,
    ...(input.metaCode !== undefined ? { metaCode: input.metaCode } : {}),
    ...(input.metaErrorSubcode !== undefined ? { metaErrorSubcode: input.metaErrorSubcode } : {}),
  });
}

/** Parse `(123)` or `(123:456)` from Meta assigned-user error messages without logging PII. */
export function parseMetaGraphErrorCodesFromMessage(message: string): {
  metaCode?: number;
  metaErrorSubcode?: number;
} {
  const match = message.match(/\((\d+)(?::(\d+))?\)/);
  if (!match) return {};
  const metaCode = Number.parseInt(match[1], 10);
  const metaErrorSubcode = match[2] ? Number.parseInt(match[2], 10) : undefined;
  return {
    ...(Number.isFinite(metaCode) ? { metaCode } : {}),
    ...(metaErrorSubcode !== undefined && Number.isFinite(metaErrorSubcode)
      ? { metaErrorSubcode }
      : {}),
  };
}
