/**
 * Deploy-repair prompt composition (U4, R8, R9, R12; risk-table redaction).
 *
 * Pure prompt-building only — no filesystem access, no CLI invocation. The
 * caller (`repair-session.ts`) reads the failure-report artifact (written
 * by U3) and passes its log excerpt in here; this module never reads the
 * artifact off disk itself, so it stays trivially testable with string
 * fixtures.
 *
 * Redaction (risk-table item, explicitly assigned to this unit): build
 * logs can echo environment values. `redactSecretShapedStrings` scrubs
 * secret-shaped substrings — `KEY=`, `TOKEN=`, `SECRET=`, `Authorization:
 * Bearer ...`, and similar `NAME=value`/`NAME: value` assignments where
 * NAME suggests a credential — before any log-excerpt-derived content is
 * embedded in the composed prompt. This is defense-in-depth, not a claim
 * of complete coverage: it is a regex scrub of common shapes, not a secret
 * scanner, and it will miss secrets that don't look like `NAME=value` or
 * a Bearer header (e.g. a bare high-entropy string with no label).
 */

export type RepairMode = 'repair' | 'dry-run' | 'drill';

export type BuildFailureClassHint = {
  name: string;
  description: string;
};

/**
 * The five known build-failure classes this plan was written against
 * (approach step 1). These are diagnostic hints for the repair agent, not
 * an exhaustive taxonomy — the agent should still diagnose from the actual
 * log rather than assuming one of these five is always the cause.
 */
export const KNOWN_BUILD_FAILURE_CLASSES: readonly BuildFailureClassHint[] = [
  {
    name: 'untracked-files-breaking-vercel-build',
    description:
      'A file an import depends on exists locally but was never `git add`ed, so it is ' +
      'missing entirely from the Vercel build checkout even though `npm run build` ' +
      'passes on the machine that wrote the code.',
  },
  {
    name: 'shared-type-property-mismatch',
    description:
      'A property renamed or removed on a type in packages/shared/src/types.ts still has ' +
      'stale call sites in apps/web or apps/api, only caught by an aggregate typecheck ' +
      'across workspaces.',
  },
  {
    name: 'missing-suspense-around-usesearchparams',
    description:
      'A Next.js page or component calls useSearchParams() without a wrapping <Suspense> ' +
      'boundary, which fails static prerendering at build time even though the dev server ' +
      'runs fine.',
  },
  {
    name: 'vitest-globals-leaking-into-build-typecheck',
    description:
      'Vitest global types (describe/it/expect) leak into the production `next build` ' +
      'typecheck because a test file or vitest type reference is not excluded from ' +
      'tsconfig, causing spurious compile errors outside __tests__.',
  },
  {
    name: 'incomplete-commit-pushed-without-local-changes',
    description:
      'A commit was pushed with a partial diff (e.g. a file edited but never staged), so ' +
      'the deployed build lacks a file or change that was verified locally.',
  },
] as const;

/** R9 denied paths — mirrored in repair-session.ts's post-run diff check. */
export const DEFAULT_DENIED_PATHS: readonly string[] = [
  '.github/**',
  '.claude/**',
  'prisma/**',
  '**/schema.prisma',
  'render.yaml',
  'vercel.json',
  '**/package.json',
  '**/package-lock.json',
];

/** The gate commands the agent is told to run before considering itself done. */
export const DEFAULT_GATE_COMMANDS: readonly string[] = ['npm run typecheck', 'npm run build'];

const CREDENTIAL_NAME_TOKEN = '(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|AUTH)';

/** `NAME=value` / `NAME: value` where NAME suggests a credential (case-insensitive). */
const CREDENTIAL_ASSIGNMENT_RE = new RegExp(
  `\\b([\\w.-]*${CREDENTIAL_NAME_TOKEN}[\\w.-]*)\\s*[:=]\\s*("[^"\\n]*"|'[^'\\n]*'|\\S+)`,
  'gi'
);

/** `Authorization: Bearer <token>` headers — handled separately so the whole token is caught. */
const AUTHORIZATION_BEARER_RE = /\bAuthorization\s*:\s*Bearer\s+\S+/gi;

/**
 * Defense-in-depth secret redaction (see module doc comment for scope and
 * limits). Order matters: the Authorization/Bearer pass runs first so it
 * captures the full token; the generic assignment pass then skips any
 * match already named "Authorization" so it doesn't re-mangle what the
 * first pass already redacted.
 */
export function redactSecretShapedStrings(text: string): string {
  if (!text) return text;
  let redacted = text.replace(AUTHORIZATION_BEARER_RE, 'Authorization: Bearer [REDACTED]');
  redacted = redacted.replace(CREDENTIAL_ASSIGNMENT_RE, (match, name: string, value: string) => {
    if (name.toLowerCase() === 'authorization' || value === '[REDACTED]') return match;
    return `${name}=[REDACTED]`;
  });
  return redacted;
}

export type FailureReportRef = {
  /** Path to the KTD7 failure-report artifact (U3), relative to repo root. */
  path: string;
  /** Raw log excerpt sourced from the artifact/build log — redacted before embedding. */
  logExcerpt: string;
};

export type BuildRepairPromptInput = {
  mode: RepairMode;
  failureReport: FailureReportRef;
  deniedPaths?: readonly string[];
  gateCommands?: readonly string[];
  knownFailureClasses?: readonly BuildFailureClassHint[];
};

/**
 * Compose the prompt-file content for the repair session (approach step 1).
 * Pure: no disk or network access. `mode` is embedded only as a label the
 * session can read back to itself and that the caller can log — it does
 * NOT change the instructions given (see the "Mode" section emitted below,
 * and repair-session.ts's doc comment on why mode has no branching here).
 */
export function buildRepairPrompt(input: BuildRepairPromptInput): string {
  const deniedPaths = input.deniedPaths ?? DEFAULT_DENIED_PATHS;
  const gateCommands = input.gateCommands ?? DEFAULT_GATE_COMMANDS;
  const hints = input.knownFailureClasses ?? KNOWN_BUILD_FAILURE_CLASSES;
  const redactedExcerpt = redactSecretShapedStrings(input.failureReport.logExcerpt);

  const deniedPathsList = deniedPaths.map((p) => `- \`${p}\``).join('\n');
  const gateCommandsList = gateCommands.map((c) => `- \`${c}\``).join('\n');
  const hintsList = hints.map((h) => `- **${h.name}** — ${h.description}`).join('\n');

  return [
    '# Deploy build-failure repair session',
    '',
    `Mode: \`${input.mode}\`.`,
    '',
    '## Your authority',
    '',
    'You are a bounded, edit-only repair agent. Your job is to diagnose and fix a',
    'build-time deploy failure by editing source files. You must NOT run `git',
    'commit`, `git push`, `git add`, or any other git write command — those are',
    'owned entirely by an external process that runs after this session ends and',
    'evaluates your diff. Do not attempt to stage or commit your changes yourself.',
    '',
    '## Read this first',
    '',
    'The full failure report, including the build log, is at:',
    '',
    `\`${input.failureReport.path}\``,
    '',
    'Read it before making any change.',
    '',
    '## Log excerpt (redacted)',
    '',
    'The excerpt below has had secret-shaped strings (API keys, tokens,',
    'passwords, Authorization headers) replaced with `[REDACTED]` as a',
    'defense-in-depth measure — it is a best-effort scrub, not a guarantee.',
    'Treat it as you would any build log.',
    '',
    '```',
    redactedExcerpt,
    '```',
    '',
    '## Files you may not touch',
    '',
    'These paths are off-limits regardless of what the fix seems to require.',
    'If the real fix would require touching one of these, stop and explain why',
    'in your final summary instead of editing it — do not work around this',
    'restriction:',
    '',
    deniedPathsList,
    '',
    '## Verify your fix',
    '',
    'Before finishing, run these gate commands and make sure they pass:',
    '',
    gateCommandsList,
    '',
    '## Known build-failure classes (diagnostic hints, not an exhaustive list)',
    '',
    hintsList,
    '',
    '## Mode',
    '',
    `This session was invoked in \`${input.mode}\` mode. Per the accepted`,
    'security-review correction to this plan, this session never commits or',
    'pushes in ANY mode — committing/pushing was moved entirely to a later',
    'attempt-loop unit that owns the bot commit identity. So "repair",',
    '"dry-run", and "drill" all produce identical behavior from this session:',
    'edit files, run the gate commands, stop. The mode value exists only so',
    'the caller (the attempt-loop) can decide what to do with the resulting',
    'diff — this session does not branch on it.',
  ].join('\n');
}
