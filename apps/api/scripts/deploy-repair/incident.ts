#!/usr/bin/env node
/**
 * Deploy-repair incident orchestration (U3, R4-R7, R10-R12, KTD7, KTD9).
 *
 * Turns a raw failure signal (Vercel `repository_dispatch` payload, or a
 * `workflow_dispatch` replay input) into an incident-tracking decision:
 *   1. Resolve the failing commit SHA (R7's dedupe key).
 *   2. Search for an already-open tracking issue titled with that SHA's
 *      short form — dedupe concurrent signals for the same commit to one
 *      incident (R7, KTD9).
 *   3. Classify the failure (via `../deploy-status/classify`, U2/R6). Only
 *      'build-time' spends a repair attempt; everything else routes to a
 *      human and spends zero attempts (R6, R11) — except 'non-actionable',
 *      which per classify.ts's own contract is not a failure at all (R5)
 *      and must not generate any human-facing artifact (see
 *      `resolveIncident`'s doc comment for why this unit deliberately
 *      diverges from treating it like the other non-repair classifications).
 *   4. Compose the KTD7 failure-report artifact and the tracking-issue
 *      title/body (new incident), or a dedupe/human-routing comment for an
 *      existing one.
 *
 * Every exported function here is pure or takes its side effects (issue
 * search, commit-sha lookup) as injected dependencies, so none of it needs
 * a real `gh` CLI, network access, or GitHub Actions context to test. The
 * actual `gh issue create` / `gh issue comment` / `gh issue list --search`
 * calls, and writing the artifact file to disk, belong to the workflow step
 * (or `main` below) that calls these functions — never to the pure
 * functions themselves, so a bug in the CLI wiring can never corrupt what
 * gets asserted in tests.
 */

import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  classifyDeployStatus,
  isRepairTarget,
  type DeployClassification,
  type DeployStatusInput,
} from '../deploy-status/classify';
import { listRenderDeploys, type RenderFetch } from '../deploy-status/render';

export type Platform = 'vercel' | 'render';

/** The failure-report artifact directory, per KTD7. */
export const FAILURE_REPORT_DIR = '.claude/tasks/deploy-failures';

// ---------------------------------------------------------------------------
// SHA + dedupe
// ---------------------------------------------------------------------------

/** Short SHA used as the incident dedupe key (R7) and issue-title marker. */
export function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

/** Minimal shape read off a `gh issue list --search ... --json number,title,url` result. */
export type IssueRef = {
  number: number;
  title: string;
  url?: string;
};

/** Injected in place of a real `gh issue list --search` call. */
export type SearchIssuesFn = (query: string) => Promise<IssueRef[]>;

/**
 * The search string a caller passes to `gh issue list --search <query>`.
 * Scoped to open issues with the short SHA in the title, matching how the
 * title is composed in `buildIssueTitle`.
 */
export function buildDedupeSearchQuery(sha: string): string {
  return `${shortSha(sha)} in:title is:issue is:open`;
}

/**
 * Dedupe check (R7): does an open tracking issue already exist for this
 * commit? `searchIssues` is expected to already be scoped to open issues
 * (e.g. by `buildDedupeSearchQuery`) — this only re-filters defensively on
 * the short SHA actually appearing in the title, in case the search API
 * returns a looser match.
 */
export async function findExistingIncidentIssue(
  sha: string,
  searchIssues: SearchIssuesFn
): Promise<IssueRef | null> {
  const results = await searchIssues(buildDedupeSearchQuery(sha));
  const short = shortSha(sha);
  return results.find((issue) => issue.title.includes(short)) ?? null;
}

// ---------------------------------------------------------------------------
// Failing-SHA resolution
// ---------------------------------------------------------------------------

/**
 * A Vercel `repository_dispatch` (`vercel.deployment.error` /
 * `vercel.deployment.failed`, R4) already knows the failing commit — the
 * component that dispatches the event does so immediately after seeing the
 * deployment fail, so it can and must put `sha` on `client_payload`
 * alongside the deployment `url` (KTD2). That is the only sha source this
 * module trusts for a repository_dispatch trigger; it does not re-derive it
 * from Vercel's API, because the deployment-status client's normalized
 * `VercelDeployment` type (deploy-status/vercel.ts) deliberately does not
 * carry a commit sha field ("only the fields this library actually reads").
 *
 * A `workflow_dispatch` replay (R12) carries no sha input at all (see the
 * workflow's `deployment_url` / `platform` inputs) — replay has to resolve
 * it from the platform. For Render that means the most recent deploy's
 * `commit.id` (see `createRenderCommitLookup`); for Vercel it would need a
 * lookup this unit does not implement for the same reason noted above, so a
 * caller that wants a Vercel workflow_dispatch to actually resolve a sha
 * must inject `lookups.vercel` itself — passing none is a documented,
 * deliberate interface boundary, not an oversight.
 */
export type ShaTrigger =
  | { platform: 'vercel'; source: 'repository_dispatch'; sha: string; deploymentUrl: string }
  | { platform: 'vercel'; source: 'workflow_dispatch'; deploymentUrl: string }
  | { platform: 'render'; source: 'workflow_dispatch' | 'poll'; deploymentUrl: string };

export type CommitLookup = (deploymentUrl: string) => Promise<{ sha: string } | null>;

export type ShaLookups = {
  vercel?: CommitLookup;
  render?: CommitLookup;
};

/**
 * Resolve the failing commit SHA from a trigger. Returns null when no sha
 * is available and no lookup was injected to find one — callers must treat
 * null as "cannot proceed," not as an empty-string sha.
 */
export async function resolveFailingSha(
  trigger: ShaTrigger,
  lookups: ShaLookups = {}
): Promise<string | null> {
  if (trigger.platform === 'vercel' && trigger.source === 'repository_dispatch') {
    return trigger.sha;
  }
  const lookup = trigger.platform === 'vercel' ? lookups.vercel : lookups.render;
  if (!lookup) return null;
  const result = await lookup(trigger.deploymentUrl);
  return result?.sha ?? null;
}

/**
 * Real Render commit lookup: the most recent deploy for the service is the
 * natural target for a manual replay (R12) or a scheduled safety poll —
 * `listRenderDeploys` (U2) already returns newest-first. `deploymentUrl` is
 * accepted for interface symmetry with the Vercel lookup shape but is not
 * used to select among deploys; Render deploy list entries carry no URL
 * field to match against (see deploy-status/render.ts).
 */
export function createRenderCommitLookup(options: {
  apiKey: string;
  serviceId: string;
  fetch?: RenderFetch;
}): CommitLookup {
  return async () => {
    const deploys = await listRenderDeploys(options);
    const [latest] = deploys;
    if (!latest?.commit?.id) return null;
    return { sha: latest.commit.id };
  };
}

// ---------------------------------------------------------------------------
// KTD7 failure-report artifact
// ---------------------------------------------------------------------------

export type FailureReportInput = {
  sha: string;
  platform: Platform;
  deploymentUrl: string;
  logExcerpt: string;
  triggerSource: string;
  classification: DeployClassification;
  suspectedFiles?: string[];
  now?: Date;
};

/** `.claude/tasks/deploy-failures/<timestamp>-<short-sha>.md` (KTD7). */
export function buildFailureArtifactPath(sha: string, now: Date = new Date()): string {
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  return `${FAILURE_REPORT_DIR}/${timestamp}-${shortSha(sha)}.md`;
}

/**
 * Compose the KTD7 failure-report markdown: Issue Details, Log Excerpt,
 * Alert Trigger, Suspected Files — mirroring the section shape of
 * `apps/api/src/routes/sentry-webhooks.ts`'s task-file writer. The repair
 * agent (a later unit) reads this file from disk rather than stdin, since
 * logs can exceed stdin's 10 MB pipe cap (KTD7).
 */
export function composeFailureReport(input: FailureReportInput): string {
  const now = input.now ?? new Date();
  const short = shortSha(input.sha);
  const suspectedFilesSection =
    input.suspectedFiles && input.suspectedFiles.length > 0
      ? input.suspectedFiles.map((file) => `- \`${file}\``).join('\n')
      : '_Not yet determined — pending diagnosis by the repair agent._';

  return `# Deploy Failure: ${input.platform} — ${short}

**Generated:** ${now.toISOString()}
**Platform:** ${input.platform}
**Classification:** ${input.classification}

## Issue Details

- **Commit SHA:** \`${input.sha}\`
- **Short SHA:** \`${short}\`
- **Platform:** ${input.platform}
- **Deployment URL:** ${input.deploymentUrl}
- **Trigger:** ${input.triggerSource}

## Log Excerpt

\`\`\`
${input.logExcerpt}
\`\`\`

## Alert Trigger

- **Source:** ${input.triggerSource}
- **Platform:** ${input.platform}
- **Deployment URL:** ${input.deploymentUrl}

## Suspected Files

${suspectedFilesSection}
`;
}

// ---------------------------------------------------------------------------
// Tracking-issue composition (KTD9)
// ---------------------------------------------------------------------------

/** Short SHA is embedded in the title — this is the dedupe marker (R7). */
export function buildIssueTitle(sha: string, platform: Platform): string {
  return `Deploy failure (${platform}): ${shortSha(sha)}`;
}

/**
 * The new-issue body. Points at the artifact file for the full log excerpt
 * and diagnosis input (R10) while also repeating the log excerpt inline so
 * the issue itself is a self-contained audit record, not just a pointer.
 */
export function composeNewIssueBody(input: FailureReportInput, artifactPath: string): string {
  return `Automated deploy-failure incident for commit \`${input.sha}\` (${input.platform}).

- **Commit SHA:** \`${input.sha}\`
- **Deployment URL:** ${input.deploymentUrl}
- **Classification:** ${input.classification}
- **Failure report:** \`${artifactPath}\`

## Log Excerpt

\`\`\`
${input.logExcerpt}
\`\`\`
`;
}

// ---------------------------------------------------------------------------
// Classification routing (R6, R11)
// ---------------------------------------------------------------------------

export type ClassificationRouting =
  | { shouldRepair: true; classification: 'build-time' }
  | {
      /** True for runtime/platform/transient: a real failure, just not repairable. */
      shouldRepair: false;
      classification: Exclude<DeployClassification, 'build-time' | 'success' | 'non-actionable'>;
      commentBody: string;
    }
  | {
      /**
       * 'non-actionable' is not a failure (R5) — see resolveIncident's doc
       * comment. Routing callers must not post anything human-facing for
       * this case.
       */
      shouldRepair: false;
      classification: 'non-actionable';
    };

/**
 * Route a classification to a repair/human decision (R6). Throws on
 * 'success' — a successful deploy has nothing to route; callers must not
 * reach this function for a non-failure detection result.
 */
export function routeByClassification(
  classification: DeployClassification,
  context: { sha: string }
): ClassificationRouting {
  if (classification === 'success') {
    throw new Error('routeByClassification called with a successful deploy; nothing to route');
  }
  if (isRepairTarget(classification)) {
    return { shouldRepair: true, classification: 'build-time' };
  }
  if (classification === 'non-actionable') {
    return { shouldRepair: false, classification };
  }
  const short = shortSha(context.sha);
  return {
    shouldRepair: false,
    classification,
    commentBody: `Classification: ${classification}. This deploy failure for ${short} is not a repair target (R6) — routing to a human. Zero repair attempts spent.`,
  };
}

// ---------------------------------------------------------------------------
// Top-level incident resolution
// ---------------------------------------------------------------------------

export type ResolveIncidentInput = {
  sha: string;
  platform: Platform;
  deploymentUrl: string;
  logExcerpt: string;
  classification: DeployClassification;
  triggerSource: string;
  suspectedFiles?: string[];
  now?: Date;
};

export type ResolveIncidentResult =
  | {
      /**
       * Not a failure (R5) — see the doc comment below. No issue, comment,
       * or artifact is produced.
       */
      kind: 'skipped-non-actionable';
      shortSha: string;
      classification: 'non-actionable';
    }
  | {
      /** R7 dedupe: a signal for a SHA that already has an open incident. */
      kind: 'existing-incident';
      shortSha: string;
      issue: IssueRef;
      shouldRepair: boolean;
      classification: DeployClassification;
      comment: { body: string };
    }
  | {
      /** No open incident for this SHA yet — compose one (KTD7, KTD9). */
      kind: 'new-incident';
      shortSha: string;
      title: string;
      body: string;
      artifactPath: string;
      artifactContent: string;
      shouldRepair: boolean;
      classification: DeployClassification;
    };

/**
 * Resolve a detected failure into an incident-tracking decision (R6, R7,
 * R10, R11, KTD7, KTD9). Pure aside from the injected `searchIssues` — no
 * `gh` shell-out, no filesystem write, no network call happens here.
 *
 * `non-actionable` is handled before the dedupe search runs at all, and
 * deliberately produces neither an issue nor a comment. This is a
 * documented divergence from treating every non-repair-target
 * classification identically: `../deploy-status/classify.ts`'s own
 * doc comment is explicit that a cancelled or in-progress deploy "must
 * never... be routed to a human as if something broke" (R5's free-plan
 * states are the concrete example — Render `canceled`/`deactivated`).
 * Filing or commenting on an incident for a deploy nobody needs to look at
 * would violate that contract, so this function skips straight to a no-op
 * result instead of running the dedupe search or composing any
 * human-facing text for it.
 */
export async function resolveIncident(
  input: ResolveIncidentInput,
  deps: { searchIssues: SearchIssuesFn }
): Promise<ResolveIncidentResult> {
  if (input.classification === 'success') {
    throw new Error('resolveIncident called with a successful deploy status; nothing to resolve');
  }

  const short = shortSha(input.sha);

  if (input.classification === 'non-actionable') {
    return { kind: 'skipped-non-actionable', shortSha: short, classification: 'non-actionable' };
  }

  const routing = routeByClassification(input.classification, input);
  const existing = await findExistingIncidentIssue(input.sha, deps.searchIssues);

  if (existing) {
    const commentBody = routing.shouldRepair
      ? `Duplicate failure signal received for ${short}. Existing incident tracked here; no new issue created (R7).`
      : routing.commentBody;
    return {
      kind: 'existing-incident',
      shortSha: short,
      issue: existing,
      shouldRepair: routing.shouldRepair,
      classification: input.classification,
      comment: { body: commentBody },
    };
  }

  const artifactPath = buildFailureArtifactPath(input.sha, input.now);
  const artifactContent = composeFailureReport(input);
  const title = buildIssueTitle(input.sha, input.platform);
  const body = routing.shouldRepair
    ? composeNewIssueBody(input, artifactPath)
    : `${composeNewIssueBody(input, artifactPath)}\n\n${routing.commentBody}`;

  return {
    kind: 'new-incident',
    shortSha: short,
    title,
    body,
    artifactPath,
    artifactContent,
    shouldRepair: routing.shouldRepair,
    classification: input.classification,
  };
}

// ---------------------------------------------------------------------------
// CLI wiring (thin — not exercised by unit tests)
// ---------------------------------------------------------------------------
//
// The workflow step drives this: it runs `gh issue list --search` itself,
// passes the JSON result in via EXISTING_ISSUES_JSON, and after this prints
// its decision as JSON, the workflow step performs the actual `gh issue
// create` / `gh issue comment` call and writes the artifact file. That
// keeps every side effect (network, filesystem, `gh` shell-out) out of the
// functions above and in one place that is easy to eyeball against the
// workflow logs.

type CliEnv = {
  DEPLOY_SHA?: string;
  PLATFORM?: string;
  DEPLOYMENT_URL?: string;
  LOG_EXCERPT?: string;
  TRIGGER_SOURCE?: string;
  DEPLOY_READY_STATE?: string;
  DEPLOY_STATUS?: string;
  EXISTING_ISSUES_JSON?: string;
  GITHUB_OUTPUT?: string;
};

function classificationFromEnv(env: CliEnv, platform: Platform): DeployClassification {
  const input: DeployStatusInput =
    platform === 'vercel'
      ? { platform: 'vercel', readyState: env.DEPLOY_READY_STATE ?? '' }
      : { platform: 'render', status: env.DEPLOY_STATUS ?? '' };
  return classifyDeployStatus(input);
}

async function writeGithubOutput(env: CliEnv, entries: Record<string, string>): Promise<void> {
  if (!env.GITHUB_OUTPUT) return;
  const lines = Object.entries(entries)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  await fs.appendFile(env.GITHUB_OUTPUT, `${lines}\n`, 'utf-8');
}

/** CLI entry point. Returns the process exit code so tests could call it directly. */
export async function main(env: CliEnv = process.env as CliEnv): Promise<number> {
  const platform = env.PLATFORM === 'render' ? 'render' : 'vercel';
  const sha = env.DEPLOY_SHA;
  const deploymentUrl = env.DEPLOYMENT_URL ?? '';

  if (!sha) {
    console.error('[deploy-repair] Missing DEPLOY_SHA — cannot resolve an incident without it.');
    return 1;
  }

  const classification = classificationFromEnv(env, platform);
  const existingIssues: IssueRef[] = env.EXISTING_ISSUES_JSON
    ? (JSON.parse(env.EXISTING_ISSUES_JSON) as IssueRef[])
    : [];

  const result = await resolveIncident(
    {
      sha,
      platform,
      deploymentUrl,
      logExcerpt: env.LOG_EXCERPT ?? '',
      classification,
      triggerSource: env.TRIGGER_SOURCE ?? 'unknown',
    },
    { searchIssues: async () => existingIssues }
  );

  if (result.kind === 'new-incident') {
    await fs.mkdir(dirname(result.artifactPath), { recursive: true });
    await fs.writeFile(result.artifactPath, result.artifactContent, 'utf-8');
  }

  console.log(JSON.stringify(result, null, 2));
  await writeGithubOutput(env, {
    kind: result.kind,
    should_repair: String('shouldRepair' in result ? result.shouldRepair : false),
    classification: result.classification,
  });

  return 0;
}

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error('[deploy-repair] Fatal error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
