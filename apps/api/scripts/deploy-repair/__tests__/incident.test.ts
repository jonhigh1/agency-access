/**
 * Tests for deploy-repair incident orchestration (U3, R4-R7, R10-R12).
 *
 * Everything here is exercised against injected fakes (a `searchIssues`
 * function standing in for `gh issue list --search`, and commit lookups
 * standing in for a real Vercel/Render API call) — no `gh` CLI, network,
 * or filesystem access happens in these tests.
 */

import { describe, expect, it } from 'vitest';
import {
  buildDedupeSearchQuery,
  buildFailureArtifactPath,
  buildIssueTitle,
  composeFailureReport,
  composeNewIssueBody,
  findExistingIncidentIssue,
  resolveFailingSha,
  resolveIncident,
  routeByClassification,
  shortSha,
  type IssueRef,
  type ResolveIncidentInput,
} from '../incident';

const NOW = new Date('2026-09-11T12:00:00.000Z');

const SHA_A = 'abc1234def5678900000000000000000000000';
const SHA_B = '9998887776665554443332221110009998887a';

function baseInput(overrides: Partial<ResolveIncidentInput> = {}): ResolveIncidentInput {
  return {
    sha: SHA_A,
    platform: 'vercel',
    deploymentUrl: 'my-app-abc123.vercel.app',
    logExcerpt: 'Error: Cannot find module "./missing-file"\n    at Function.Module._resolveFilename',
    classification: 'build-time',
    triggerSource: 'repository_dispatch:vercel.deployment.error',
    now: NOW,
    ...overrides,
  };
}

function noExistingIssues() {
  return async () => [] as IssueRef[];
}

describe('shortSha', () => {
  it('takes the first 7 characters', () => {
    expect(shortSha(SHA_A)).toBe('abc1234');
    expect(shortSha(SHA_A)).toHaveLength(7);
  });
});

describe('buildDedupeSearchQuery / findExistingIncidentIssue', () => {
  it('builds a search query scoped to open issues with the short sha in the title', () => {
    expect(buildDedupeSearchQuery(SHA_A)).toBe('abc1234 in:title is:issue is:open');
  });

  it('finds an issue whose title contains the short sha', async () => {
    const searchIssues = async () => [
      { number: 42, title: `Deploy failure (vercel): ${shortSha(SHA_A)}`, url: 'https://github.com/x/y/issues/42' },
    ];
    const found = await findExistingIncidentIssue(SHA_A, searchIssues);
    expect(found?.number).toBe(42);
  });

  it('returns null when nothing matches the short sha', async () => {
    const searchIssues = async () => [{ number: 1, title: 'Unrelated issue' }];
    const found = await findExistingIncidentIssue(SHA_A, searchIssues);
    expect(found).toBeNull();
  });
});

describe('resolveFailingSha', () => {
  it('reads the sha directly off a repository_dispatch trigger (Vercel)', async () => {
    const sha = await resolveFailingSha({
      platform: 'vercel',
      source: 'repository_dispatch',
      sha: SHA_A,
      deploymentUrl: 'my-app.vercel.app',
    });
    expect(sha).toBe(SHA_A);
  });

  it('resolves via the injected Render lookup for a workflow_dispatch replay', async () => {
    const sha = await resolveFailingSha(
      { platform: 'render', source: 'workflow_dispatch', deploymentUrl: 'my-service' },
      { render: async () => ({ sha: SHA_B }) }
    );
    expect(sha).toBe(SHA_B);
  });

  it('returns null for a Vercel workflow_dispatch replay with no injected lookup (documented interface boundary)', async () => {
    const sha = await resolveFailingSha({
      platform: 'vercel',
      source: 'workflow_dispatch',
      deploymentUrl: 'my-app.vercel.app',
    });
    expect(sha).toBeNull();
  });

  it('returns null when the injected lookup finds no matching deploy', async () => {
    const sha = await resolveFailingSha(
      { platform: 'render', source: 'workflow_dispatch', deploymentUrl: 'my-service' },
      { render: async () => null }
    );
    expect(sha).toBeNull();
  });
});

describe('routeByClassification', () => {
  it('routes build-time to repair', () => {
    const routing = routeByClassification('build-time', { sha: SHA_A });
    expect(routing).toEqual({ shouldRepair: true, classification: 'build-time' });
  });

  it.each(['runtime', 'platform', 'transient'] as const)(
    'routes %s to a human with a classification-naming comment, zero attempts',
    (classification) => {
      const routing = routeByClassification(classification, { sha: SHA_A });
      expect(routing.shouldRepair).toBe(false);
      expect(routing.classification).toBe(classification);
      expect('commentBody' in routing && routing.commentBody).toContain(classification);
      expect('commentBody' in routing && routing.commentBody).toMatch(/zero repair attempts/i);
    }
  );

  it('routes non-actionable to zero attempts without a human-facing comment', () => {
    const routing = routeByClassification('non-actionable', { sha: SHA_A });
    expect(routing.shouldRepair).toBe(false);
    expect(routing.classification).toBe('non-actionable');
    expect('commentBody' in routing).toBe(false);
  });

  it('throws for success — nothing to route', () => {
    expect(() => routeByClassification('success', { sha: SHA_A })).toThrow();
  });
});

describe('composeFailureReport / composeNewIssueBody (R10 audit requirement)', () => {
  it('the artifact contains the log excerpt, sha, platform, and deployment url', () => {
    const input = baseInput();
    const report = composeFailureReport(input);
    expect(report).toContain(input.logExcerpt);
    expect(report).toContain(input.sha);
    expect(report).toContain(input.platform);
    expect(report).toContain(input.deploymentUrl);
    expect(report).toContain('## Issue Details');
    expect(report).toContain('## Log Excerpt');
    expect(report).toContain('## Alert Trigger');
    expect(report).toContain('## Suspected Files');
  });

  it('lists suspected files when provided, and a placeholder note otherwise', () => {
    const withFiles = composeFailureReport(
      baseInput({ suspectedFiles: ['apps/web/next.config.ts', 'apps/web/package.json'] })
    );
    expect(withFiles).toContain('apps/web/next.config.ts');
    expect(withFiles).toContain('apps/web/package.json');

    const withoutFiles = composeFailureReport(baseInput({ suspectedFiles: undefined }));
    expect(withoutFiles).toContain('Not yet determined');
  });

  it('the issue body contains the log excerpt, sha, platform, and deployment url', () => {
    const input = baseInput();
    const artifactPath = buildFailureArtifactPath(input.sha, NOW);
    const body = composeNewIssueBody(input, artifactPath);
    expect(body).toContain(input.logExcerpt);
    expect(body).toContain(input.sha);
    expect(body).toContain(input.platform);
    expect(body).toContain(input.deploymentUrl);
    expect(body).toContain(artifactPath);
  });

  it('the artifact path is timestamped and keyed by the short sha (KTD7)', () => {
    const path = buildFailureArtifactPath(SHA_A, NOW);
    expect(path).toBe('.claude/tasks/deploy-failures/2026-09-11T12-00-00-000Z-abc1234.md');
  });

  it('the issue title is keyed by the short sha (R7 dedupe marker)', () => {
    expect(buildIssueTitle(SHA_A, 'vercel')).toBe(`Deploy failure (vercel): ${shortSha(SHA_A)}`);
  });
});

describe('resolveIncident', () => {
  describe('dedupe (R7)', () => {
    it('the same SHA resolves to one issue reference across two failure signals', async () => {
      const first = await resolveIncident(baseInput(), { searchIssues: noExistingIssues() });
      expect(first.kind).toBe('new-incident');
      if (first.kind !== 'new-incident') throw new Error('unreachable');

      // Simulate the tracking issue that would now exist after `gh issue
      // create` used `first.title` — the second failure signal for the
      // same SHA must find it and dedupe instead of composing a new one.
      const existingIssue: IssueRef = { number: 7, title: first.title, url: 'https://github.com/x/y/issues/7' };
      const second = await resolveIncident(baseInput(), {
        searchIssues: async () => [existingIssue],
      });

      expect(second.kind).toBe('existing-incident');
      if (second.kind !== 'existing-incident') throw new Error('unreachable');
      expect(second.issue).toEqual(existingIssue);
      expect(second.shortSha).toBe(first.shortSha);
    });

    it('different SHAs resolve to separate new-incident compositions', async () => {
      const a = await resolveIncident(baseInput({ sha: SHA_A }), { searchIssues: noExistingIssues() });
      const b = await resolveIncident(baseInput({ sha: SHA_B }), { searchIssues: noExistingIssues() });

      expect(a.kind).toBe('new-incident');
      expect(b.kind).toBe('new-incident');
      if (a.kind !== 'new-incident' || b.kind !== 'new-incident') throw new Error('unreachable');

      expect(a.shortSha).not.toBe(b.shortSha);
      expect(a.title).not.toBe(b.title);
      expect(a.artifactPath).not.toBe(b.artifactPath);
    });
  });

  describe('R10 audit requirement on the composed content', () => {
    it('a new incident carries the log excerpt, sha, platform, and deployment url', async () => {
      const input = baseInput();
      const result = await resolveIncident(input, { searchIssues: noExistingIssues() });
      expect(result.kind).toBe('new-incident');
      if (result.kind !== 'new-incident') throw new Error('unreachable');

      for (const text of [result.body, result.artifactContent]) {
        expect(text).toContain(input.logExcerpt);
        expect(text).toContain(input.sha);
        expect(text).toContain(input.platform);
        expect(text).toContain(input.deploymentUrl);
      }
    });
  });

  describe('classification routing (R6, R11)', () => {
    it('build-time routes to should-repair', async () => {
      const result = await resolveIncident(baseInput({ classification: 'build-time' }), {
        searchIssues: noExistingIssues(),
      });
      expect(result.kind).toBe('new-incident');
      if (result.kind !== 'new-incident') throw new Error('unreachable');
      expect(result.shouldRepair).toBe(true);
    });

    it.each(['runtime', 'platform', 'transient'] as const)(
      '%s routes to human notification with zero attempts and a classification-naming body',
      async (classification) => {
        const result = await resolveIncident(baseInput({ classification }), {
          searchIssues: noExistingIssues(),
        });
        expect(result.kind).toBe('new-incident');
        if (result.kind !== 'new-incident') throw new Error('unreachable');
        expect(result.shouldRepair).toBe(false);
        expect(result.body).toContain(classification);
        expect(result.body).toMatch(/zero repair attempts/i);
      }
    );

    it(
      // Deviation from treating every non-repair classification identically:
      // 'non-actionable' is not a failure at all (R5) per classify.ts's own
      // contract, so it must not produce a human-facing issue or comment —
      // see resolveIncident's doc comment for the full justification. Zero
      // attempts are still spent, matching the other non-repair-target cases.
      'non-actionable spends zero attempts but produces no issue or comment (R5 — not a failure)',
      async () => {
        const result = await resolveIncident(baseInput({ classification: 'non-actionable' }), {
          searchIssues: noExistingIssues(),
        });
        expect(result.kind).toBe('skipped-non-actionable');
        if (result.kind !== 'skipped-non-actionable') throw new Error('unreachable');
        expect(result.classification).toBe('non-actionable');
      }
    );

    it('throws for a success classification — nothing to resolve', async () => {
      await expect(
        resolveIncident(baseInput({ classification: 'success' }), { searchIssues: noExistingIssues() })
      ).rejects.toThrow();
    });
  });

  describe('dedupe + non-repairable classification together', () => {
    it('an existing issue for a human-routed classification gets a classification-naming comment, not a new issue', async () => {
      const existingIssue: IssueRef = {
        number: 3,
        title: buildIssueTitle(SHA_A, 'vercel'),
      };
      const result = await resolveIncident(baseInput({ classification: 'platform' }), {
        searchIssues: async () => [existingIssue],
      });

      expect(result.kind).toBe('existing-incident');
      if (result.kind !== 'existing-incident') throw new Error('unreachable');
      expect(result.shouldRepair).toBe(false);
      expect(result.issue).toEqual(existingIssue);
      expect(result.comment.body).toContain('platform');
      expect(result.comment.body).toMatch(/zero repair attempts/i);
    });
  });
});
