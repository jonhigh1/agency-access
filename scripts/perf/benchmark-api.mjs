// @ts-nocheck
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { createPerfSessionToken } from './lib/auth.mjs';
import { summarize, round } from './lib/stats.mjs';
import { assertPerfResponse, positiveNumber } from './lib/validation.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @param {string} name
 * @param {string} fallback
 * @returns {string}
 */
function arg(name, fallback) {
  const direct = process.argv.find((entry) => entry.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);

  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];

  return fallback;
}

/**
 * @param {string} url
 * @param {RequestInit} init
 * @returns {Promise<{durationMs: number, status: number, bodyBytes: number, etag: string | null, cache: string | null, responseTime: string | null}>}
 */
async function timedFetch(url, init, kind) {
  const startedAt = performance.now();
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  const bodyBytes = await assertPerfResponse(response, kind);
  const durationMs = performance.now() - startedAt;

  return {
    durationMs,
    status: response.status,
    bodyBytes,
    etag: response.headers.get('etag'),
    cache: response.headers.get('x-cache'),
    responseTime: response.headers.get('x-response-time'),
  };
}

async function main() {
  const apiBase = arg('--api-base', process.env.PERF_API_BASE || 'http://localhost:3001');
  const runs = positiveNumber(arg('--runs', process.env.PERF_RUNS || '10'), '--runs', { integer: true, min: 2 });
  const label = arg('--label', 'baseline');
  const freshTokenPerRun = arg('--fresh-token-per-run', 'false') === 'true';
  const enforceBudget = arg('--enforce-budget', process.env.PERF_ENFORCE_BUDGET || 'false') === 'true';
  const warmP95BudgetMs = positiveNumber(arg('--warm-p95-budget-ms', process.env.PERF_WARM_P95_BUDGET_MS || '400'), '--warm-p95-budget-ms');
  const coldMaxBudgetMs = positiveNumber(arg('--cold-max-ms', process.env.PERF_COLD_MAX_BUDGET_MS || '2500'), '--cold-max-ms');

  const dashboardUrl = `${apiBase}/api/dashboard`;

  const samples = [];

  let latestEtag = null;
  const initialAuth = freshTokenPerRun ? null : await createPerfSessionToken();

  for (let iteration = 1; iteration <= runs; iteration += 1) {
    const auth = freshTokenPerRun ? await createPerfSessionToken() : initialAuth;
    const authHeaders = {
      Authorization: `Bearer ${auth.token}`,
    };
    const agenciesUrl = `${apiBase}/api/agencies?clerkUserId=${encodeURIComponent(auth.userId)}&fields=id,name,email,clerkUserId`;

    const agencies = await timedFetch(agenciesUrl, { headers: authHeaders }, 'agencies');
    const dashboard = await timedFetch(dashboardUrl, { headers: authHeaders }, 'dashboard');

    if (dashboard.etag) {
      latestEtag = dashboard.etag;
    }

    const conditionalHeaders = {
      ...authHeaders,
    };
    if (latestEtag) {
      conditionalHeaders['If-None-Match'] = latestEtag;
    }

    const dashboardConditional = await timedFetch(dashboardUrl, { headers: conditionalHeaders }, 'dashboard');

    samples.push({
      iteration,
      agencies,
      dashboard,
      dashboardConditional,
      criticalPathMs: round(agencies.durationMs + dashboard.durationMs),
    });

    process.stdout.write(
      `run ${String(iteration).padStart(2, '0')}: ` +
      `agencies=${round(agencies.durationMs)}ms ` +
      `dashboard=${round(dashboard.durationMs)}ms ` +
      `critical=${round(agencies.durationMs + dashboard.durationMs)}ms ` +
      `cond=${round(dashboardConditional.durationMs)}ms\n`
    );
  }

  const agenciesDurations = samples.map((entry) => entry.agencies.durationMs);
  const dashboardDurations = samples.map((entry) => entry.dashboard.durationMs);
  const conditionalDurations = samples.map((entry) => entry.dashboardConditional.durationMs);
  const criticalDurations = samples.map((entry) => entry.criticalPathMs);
  const warmCriticalDurations = criticalDurations.slice(1);
  const warmCriticalSummary = summarize(warmCriticalDurations);

  const report = {
    label,
    timestamp: new Date().toISOString(),
    apiBase,
    userId: initialAuth?.userId || null,
    freshTokenPerRun,
    runs,
    summary: {
      agencies: summarize(agenciesDurations),
      dashboard: summarize(dashboardDurations),
      dashboardConditional: summarize(conditionalDurations),
      criticalPath: summarize(criticalDurations),
      warmCriticalPath: warmCriticalSummary,
      firstRun: {
        agenciesMs: round(samples[0].agencies.durationMs),
        dashboardMs: round(samples[0].dashboard.durationMs),
        criticalPathMs: samples[0].criticalPathMs,
      },
    },
    budgets: {
      enforce: enforceBudget,
      warmP95BudgetMs,
      coldMaxBudgetMs,
    },
    samples,
  };

  if (enforceBudget) {
    const failures = [];
    if (report.summary.warmCriticalPath.p95Ms > warmP95BudgetMs) {
      failures.push({
        metric: 'warmCriticalPath.p95Ms',
        observed: report.summary.warmCriticalPath.p95Ms,
        budget: warmP95BudgetMs,
      });
    }

    if (report.summary.firstRun.criticalPathMs > coldMaxBudgetMs) {
      failures.push({
        metric: 'firstRun.criticalPathMs',
        observed: report.summary.firstRun.criticalPathMs,
        budget: coldMaxBudgetMs,
      });
    }

    report.budgetCheck = {
      pass: failures.length === 0,
      failures,
    };
  }

  const resultsDir = path.join(__dirname, 'results');
  await fs.mkdir(resultsDir, { recursive: true });
  const outputFile = path.join(resultsDir, `api-${label}-${Date.now()}.json`);
  await fs.writeFile(outputFile, JSON.stringify(report, null, 2));

  process.stdout.write(`\nSaved API benchmark report: ${outputFile}\n`);
  process.stdout.write(`Critical path mean: ${report.summary.criticalPath.meanMs}ms\n`);
  process.stdout.write(`Critical path p95: ${report.summary.criticalPath.p95Ms}ms\n`);
  process.stdout.write(`Warm critical path p95: ${report.summary.warmCriticalPath.p95Ms}ms\n`);

  if (report.budgetCheck) {
    if (!report.budgetCheck.pass) {
      process.stdout.write('❌ Dashboard perf budget check failed.\n');
      process.stdout.write(`${JSON.stringify(report.budgetCheck.failures, null, 2)}\n`);
      process.exit(1);
    }
    process.stdout.write('✅ Dashboard perf budget check passed.\n');
  }
}

main().catch((error) => {
  console.error('benchmark-api failed:', error);
  process.exit(1);
});
