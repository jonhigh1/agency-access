import assert from 'node:assert/strict';
import { test } from 'node:test';
import { META_CORE_PERMISSIONS, META_GRAPH_VERSION } from '@agency-platform/shared';
import { evaluateMetaReviewFixture } from './meta-review-fixture.ts';

const fixture = {
  schemaVersion: 1,
  metaAppId: '1215220247221414',
  graphApiVersion: META_GRAPH_VERSION,
  deployedReleaseSha: 'a644f02',
  client: {
    graphUserId: '100000000000001',
    appRole: 'Tester',
    acceptedAppRole: true,
    businessRole: 'Business admin',
    twoFactorEnabled: true,
    assets: [
      { type: 'business', id: '200000000000001', name: 'Client portfolio', role: 'Admin', agencyHadAccessBefore: false },
      { type: 'page', id: '300000000000001', name: 'Client Page', role: 'Full control', agencyHadAccessBefore: false },
      { type: 'ad_account', id: '400000000000001', name: 'Client ads', role: 'Admin', agencyHadAccessBefore: false },
      { type: 'instagram', id: '500000000000001', name: 'Client Instagram', role: 'Connected to Client Page', agencyHadAccessBefore: false },
    ],
  },
  agency: {
    graphUserId: '100000000000002',
    appRole: 'Administrator',
    acceptedAppRole: true,
    businessRole: 'Business admin',
  },
  login: {
    businessLoginConfigId: 'config-1',
    freshRequest: true,
    oauthSucceeded: true,
    grantedPermissions: [...META_CORE_PERMISSIONS],
  },
};

test('accepts a complete clean-session role fixture without returning identity values', () => {
  const result = evaluateMetaReviewFixture(fixture);

  assert.deepEqual(result, { valid: true, ready: true, errors: [], blockers: [] });
});

test('reports missing pre-review gates without echoing fixture data', () => {
  const result = evaluateMetaReviewFixture({
    ...fixture,
    client: {
      ...fixture.client,
      acceptedAppRole: false,
      twoFactorEnabled: false,
      assets: fixture.client.assets.map((asset) => ({ ...asset, agencyHadAccessBefore: true })),
    },
    agency: { ...fixture.agency, acceptedAppRole: false },
    login: {
      ...fixture.login,
      freshRequest: false,
      oauthSucceeded: false,
      grantedPermissions: fixture.login.grantedPermissions.filter((permission) => permission !== 'pages_read_engagement'),
    },
  });

  assert.equal(result.valid, true);
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, [
    'agency.acceptedAppRole',
    'client.acceptedAppRole',
    'client.assets.agencyHadAccessBefore',
    'client.twoFactorEnabled',
    'login.freshRequest',
    'login.grantedPermissions',
    'login.oauthSucceeded',
  ]);
  assert.equal(JSON.stringify(result).includes(fixture.client.graphUserId), false);
});

test('rejects credential fields and unknown fixture properties', () => {
  const result = evaluateMetaReviewFixture({
    ...fixture,
    login: { ...fixture.login, accessToken: 'must-not-be-recorded' },
  });

  assert.equal(result.valid, false);
  assert.equal(result.ready, false);
  assert.deepEqual(result.errors, ['login.accessToken']);
  assert.equal(JSON.stringify(result).includes('must-not-be-recorded'), false);
});

test('rejects using the same Facebook identity for client and agency', () => {
  const result = evaluateMetaReviewFixture({
    ...fixture,
    agency: { ...fixture.agency, graphUserId: fixture.client.graphUserId },
  });

  assert.equal(result.valid, true);
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, ['agency.graphUserId']);
});
