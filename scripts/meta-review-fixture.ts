import { z } from 'zod';
import { META_CORE_PERMISSIONS, META_GRAPH_VERSION } from '@agency-platform/shared';

const metaAppId = '1215220247221414';

const assetSchema = z.object({
  type: z.enum(['business', 'page', 'ad_account', 'instagram']),
  id: z.string().regex(/^\d+$/),
  name: z.string().trim().min(1),
  role: z.string().trim().min(1),
  agencyHadAccessBefore: z.boolean(),
}).strict();

const fixtureSchema = z.object({
  schemaVersion: z.literal(1),
  metaAppId: z.literal(metaAppId),
  graphApiVersion: z.literal(META_GRAPH_VERSION),
  deployedReleaseSha: z.string().regex(/^[a-f\d]{7,40}$/i),
  client: z.object({
    graphUserId: z.string().regex(/^\d+$/),
    appRole: z.string().trim().min(1),
    acceptedAppRole: z.boolean(),
    businessRole: z.string().trim().min(1),
    twoFactorEnabled: z.boolean(),
    assets: z.array(assetSchema).min(1),
  }).strict(),
  agency: z.object({
    graphUserId: z.string().regex(/^\d+$/),
    appRole: z.string().trim().min(1),
    acceptedAppRole: z.boolean(),
    businessRole: z.string().trim().min(1),
  }).strict(),
  login: z.object({
    businessLoginConfigId: z.string().trim().min(1),
    freshRequest: z.boolean(),
    oauthSucceeded: z.boolean(),
    grantedPermissions: z.array(z.enum(META_CORE_PERMISSIONS)),
  }).strict(),
}).strict();

export type MetaReviewFixture = z.infer<typeof fixtureSchema>;

export interface MetaReviewFixtureResult {
  valid: boolean;
  ready: boolean;
  errors: string[];
  blockers: string[];
}

export function evaluateMetaReviewFixture(input: unknown): MetaReviewFixtureResult {
  const parsed = fixtureSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      ready: false,
      errors: parsed.error.issues.flatMap((issue) => issue.code === 'unrecognized_keys'
        ? issue.keys.map((key) => [...issue.path, key].join('.'))
        : [issue.path.join('.')]),
      blockers: [],
    };
  }

  const fixture = parsed.data;
  const blockers: string[] = [];
  if (fixture.client.graphUserId === fixture.agency.graphUserId) blockers.push('agency.graphUserId');
  if (!fixture.client.acceptedAppRole) blockers.push('client.acceptedAppRole');
  if (!fixture.agency.acceptedAppRole) blockers.push('agency.acceptedAppRole');
  if (!fixture.client.twoFactorEnabled) blockers.push('client.twoFactorEnabled');
  if (!fixture.login.freshRequest) blockers.push('login.freshRequest');
  if (!fixture.login.oauthSucceeded) blockers.push('login.oauthSucceeded');

  const types = new Set<string>();
  let agencyHadAccessBefore = false;
  for (const asset of fixture.client.assets) {
    types.add(asset.type);
    agencyHadAccessBefore ||= asset.agencyHadAccessBefore;
  }
  for (const type of ['business', 'page', 'ad_account'] as const) {
    if (!types.has(type)) blockers.push(`client.assets.${type}`);
  }
  if (agencyHadAccessBefore) blockers.push('client.assets.agencyHadAccessBefore');

  const grantedPermissions = new Set(fixture.login.grantedPermissions);
  if (
    grantedPermissions.size !== META_CORE_PERMISSIONS.length ||
    META_CORE_PERMISSIONS.some((permission) => !grantedPermissions.has(permission))
  ) {
    blockers.push('login.grantedPermissions');
  }

  blockers.sort();
  return { valid: true, ready: blockers.length === 0, errors: [], blockers };
}
