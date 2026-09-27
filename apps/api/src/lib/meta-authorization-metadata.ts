import {
  MetaClientAuthorizationMetadataSchema,
  type MetaClientAuthorizationMetadata,
} from '@agency-platform/shared';

export function readMetaAuthorizationMetadata(metadata: unknown): {
  rootMetadata: Record<string, unknown>;
  metaMetadata: MetaClientAuthorizationMetadata;
} {
  const rootMetadata =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? { ...(metadata as Record<string, unknown>) }
      : {};
  const parsed = MetaClientAuthorizationMetadataSchema.safeParse(rootMetadata.meta);

  return { rootMetadata, metaMetadata: parsed.success ? parsed.data : {} };
}

export function readPendingSecretDeletionIds(metadata: unknown): string[] {
  const rootMetadata =
    metadata && typeof metadata === 'object' && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return Array.isArray(rootMetadata.pendingSecretDeletion)
    ? [...new Set(rootMetadata.pendingSecretDeletion.filter((id): id is string => typeof id === 'string' && id.length > 0))]
    : [];
}
