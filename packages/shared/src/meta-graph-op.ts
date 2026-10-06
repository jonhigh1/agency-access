import { z } from 'zod';

export const MetaGraphTokenClassSchema = z.enum([
  'client_user',
  'selected_page',
  'system_user',
  'app',
]);

export type MetaGraphTokenClass = z.infer<typeof MetaGraphTokenClassSchema>;

export const MetaGraphOpOutcomeSchema = z.enum(['ok', 'error']);

export type MetaGraphOpOutcome = z.infer<typeof MetaGraphOpOutcomeSchema>;

export const MetaGraphOpRecordSchema = z.object({
  method: z.enum(['GET', 'POST', 'DELETE']),
  edge: z.string().min(1),
  tokenClass: MetaGraphTokenClassSchema,
  outcome: MetaGraphOpOutcomeSchema,
  metaCode: z.number().int().optional(),
});

export type MetaGraphOpRecord = z.infer<typeof MetaGraphOpRecordSchema>;

const META_GRAPH_VERSION_PATH = /^\/v\d+\.\d+/;

function placeholderForPathSegment(segment: string): string {
  if (segment === 'me') return 'me';
  if (/^\d+$/.test(segment) || /^act_\d+$/.test(segment)) return '{asset_id}';
  return segment;
}

/** Stable Graph edge path for captions and receipts (no host, version, or query). */
export function normalizeMetaGraphEdge(urlOrPath: string): string {
  let pathname: string;
  try {
    pathname = new URL(urlOrPath).pathname;
  } catch {
    pathname = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  }

  const withoutVersion = pathname.replace(META_GRAPH_VERSION_PATH, '') || '/';
  const segments = withoutVersion.split('/').filter(Boolean);
  const normalized = segments.map(placeholderForPathSegment).join('/');
  const edgePath = normalized ? `/${normalized}` : '/';

  if (edgePath.includes('/feed')) {
    return edgePath.replace('/{asset_id}/feed', '/{page_id}/feed');
  }

  return edgePath;
}

export function formatMetaGraphOpCaption(record: MetaGraphOpRecord): string {
  const base = `${record.method} ${record.edge} · ${record.tokenClass} · ${record.outcome}`;
  if (record.outcome === 'error' && record.metaCode !== undefined) {
    return `${base} (${record.metaCode})`;
  }
  return base;
}

export function serializeMetaGraphOp(record: MetaGraphOpRecord): string {
  const parsed = MetaGraphOpRecordSchema.parse(record);
  return JSON.stringify(parsed);
}

const TOKEN_LIKE_PATTERNS = [
  /\bEAA[A-Za-z0-9]{20,}\b/,
  /\bBearer\s+\S+/i,
  /access_token[=:]\S+/i,
  /Authorization:\s*\S+/i,
];

/** Fail when serialized ops contain obvious token material (used in tests and log guards). */
export function assertNoTokenMaterialInSerializedGraphOps(
  serialized: string,
  forbiddenSamples: string[] = []
): void {
  for (const sample of forbiddenSamples) {
    if (serialized.includes(sample)) {
      throw new Error(`Serialized Graph op must not contain forbidden sample: ${sample.slice(0, 8)}…`);
    }
  }
  for (const pattern of TOKEN_LIKE_PATTERNS) {
    if (pattern.test(serialized)) {
      throw new Error('Serialized Graph op matched a token-like pattern');
    }
  }
}
