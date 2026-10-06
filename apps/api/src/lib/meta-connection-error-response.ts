import {
  mapMetaOAuthIncompletePermissions,
  type MetaConnectionErrorPresentation,
} from '@agency-platform/shared';
import { sendError } from './response.js';

export function readMetaOAuthScopeGap(metadata: unknown): { missingOAuthScopes: string[] } | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const record = metadata as Record<string, unknown>;
  if (record.oauthScopesComplete !== false) {
    return null;
  }

  const missingOAuthScopes = Array.isArray(record.missingOAuthScopes)
    ? record.missingOAuthScopes.filter((scope): scope is string => typeof scope === 'string')
    : [];

  return { missingOAuthScopes };
}

export function sendMetaConnectionError(
  reply: unknown,
  presentation: MetaConnectionErrorPresentation,
): unknown {
  return sendError(
    reply,
    presentation.code,
    presentation.message,
    presentation.httpStatus,
    {
      title: presentation.title,
      nextSteps: [...presentation.nextSteps],
      supportCode: presentation.code,
    },
  );
}

export function metaOAuthIncompletePresentation(
  missingOAuthScopes: string[],
): MetaConnectionErrorPresentation {
  return mapMetaOAuthIncompletePermissions(missingOAuthScopes);
}
