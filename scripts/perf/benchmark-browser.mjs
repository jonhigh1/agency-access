// @ts-nocheck
import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createPerfSessionToken } from './lib/auth.mjs';
import { assertPerfResponse, redactPerfToken, safeReportUrl } from './lib/validation.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let tokenToRedact = '';

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
 * @param {{apiBase: string, auth: {token: string, userId: string}}} opts
 * @returns {Promise<void>}
 */
async function waitForPerfSessionReady({ apiBase, auth }) {
  const deadline = Date.now() + 10000;
  const readinessUrl = new URL('/api/agencies', apiBase);
  readinessUrl.searchParams.set('clerkUserId', auth.userId);
  readinessUrl.searchParams.set('fields', 'id,name,email,clerkUserId');

  while (Date.now() < deadline) {
    try {
      const response = await fetch(readinessUrl, {
        signal: AbortSignal.timeout(2000),
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      });

      if (response.ok) {
        await assertPerfResponse(response, 'agencies');
        return;
      }
    } catch {
      // Retry until the short readiness window expires.
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error('Perf session token did not become ready before the browser benchmark started.');
}

async function main() {
  const appBase = arg('--app-base', process.env.PERF_APP_BASE || 'http://localhost:3000');
  const apiBase = arg('--api-base', process.env.PERF_API_BASE || 'http://localhost:3001');
  const label = arg('--label', 'baseline');
  const captureTrace = arg('--capture-trace', 'false') === 'true';

  const auth = await createPerfSessionToken();
  tokenToRedact = auth.token;
  await waitForPerfSessionReady({ apiBase, auth });
  const bootstrapUrl = new URL('/perf/dashboard-bootstrap', appBase);
  bootstrapUrl.searchParams.set('token', auth.token);
  bootstrapUrl.searchParams.set('userId', auth.userId);
  const url = bootstrapUrl.toString();

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  await context.setExtraHTTPHeaders({
    'x-perf-harness': '1',
  });
  const page = await context.newPage();

  const consoleTimings = [];
  const trackedRequests = new WeakMap();
  const apiRequests = [];

  /**
   * @param {import('playwright').ConsoleMessage} message
   */
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('dashboard:') || text.includes('layout:')) {
      consoleTimings.push({
        type: message.type(),
        text,
      });
    }
  });

  /**
   * @param {import('playwright').Request} request
   */
  page.on('request', (request) => {
    const url = request.url();
    if (!url.includes('/api/agencies') && !url.includes('/api/dashboard')) {
      return;
    }

    trackedRequests.set(request, performance.now());
  });

  /**
   * @param {import('playwright').Response} response
   */
  page.on('response', async (response) => {
    const request = response.request();
    const startedAt = trackedRequests.get(request);
    if (!startedAt) {
      return;
    }

    const finishedAt = performance.now();
    apiRequests.push({
      url: response.url(),
      status: response.status(),
      method: request.method(),
      durationMs: Number((finishedAt - startedAt).toFixed(2)),
    });
  });

  let cdp = null;
  const traceEvents = [];
  let tracingDone = null;

  if (captureTrace) {
    cdp = await context.newCDPSession(page);
    /**
     * @param {{value: unknown[]}} payload
     */
    cdp.on('Tracing.dataCollected', (payload) => {
      traceEvents.push(...payload.value);
    });
    tracingDone = new Promise((resolve) => {
      cdp.once('Tracing.tracingComplete', resolve);
    });

    await cdp.send('Tracing.start', {
      categories: [
        'devtools.timeline',
        'disabled-by-default-devtools.timeline',
        'blink.user_timing',
        'loading',
        'network',
        'v8.execute',
      ].join(','),
      transferMode: 'ReportEvents',
    });
  }

  const dashboardResponse = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/dashboard',
    { timeout: 120000 }
  );
  const navStartedAt = performance.now();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await assertPerfResponse(await dashboardResponse, 'dashboard');
  await page.waitForURL((currentUrl) => currentUrl.pathname === '/dashboard', { timeout: 120000 });
  await page.waitForSelector('h1', { timeout: 120000 });
  const dashboardHeading = page.getByRole('heading', { name: 'Dashboard', level: 1 });
  await dashboardHeading.waitFor({ state: 'visible', timeout: 120000 });
  const errorHeading = page.getByRole('heading', { name: /failed to load dashboard|authenticating session/i });
  if (await errorHeading.count()) {
    throw new Error('Dashboard benchmark reached an error state instead of a ready dashboard.');
  }
  const navDurationMs = performance.now() - navStartedAt;

  // Background analytics/auth traffic can keep the page from becoming truly idle in dev.
  // Capture a short best-effort idle state without making the benchmark hang indefinitely.
  try {
    await page.waitForLoadState('networkidle', { timeout: 3000 });
  } catch {
    // Ignore idle timeout and continue with the collected timing data.
  }

  const performanceEntries = await page.evaluate(() => {
    const [nav] = performance.getEntriesByType('navigation');
    const [redirectMark] = performance.getEntriesByName('perf-harness:dashboard-redirect-start');
    const paints = performance.getEntriesByType('paint').map((entry) => ({
      name: entry.name,
      startTime: entry.startTime,
    }));
    const measures = performance.getEntriesByType('measure').map((entry) => ({
      name: entry.name,
      duration: entry.duration,
      startTime: entry.startTime,
    }));

    return {
      navigation: nav ? {
        domContentLoadedMs: nav.domContentLoadedEventEnd,
        loadEventMs: nav.loadEventEnd,
        transferSize: nav.transferSize,
      } : null,
      redirectToDashboardReadyMs: redirectMark ? performance.now() - redirectMark.startTime : null,
      paints,
      measures,
    };
  });

  let traceFile = null;
  const screenshotFile = path.join(__dirname, 'traces', `dashboard-${label}-${Date.now()}.png`);
  const reportFile = path.join(__dirname, 'results', `browser-${label}-${Date.now()}.json`);
  await fs.mkdir(path.dirname(screenshotFile), { recursive: true });
  await fs.mkdir(path.dirname(reportFile), { recursive: true });

  if (cdp && tracingDone) {
    await cdp.send('Tracing.end');
    await tracingDone;
    traceFile = path.join(__dirname, 'traces', `dashboard-${label}-${Date.now()}.json`);
    const traceJson = redactPerfToken(JSON.stringify({ traceEvents }), auth.token);
    await fs.writeFile(traceFile, traceJson);
  }
  await page.screenshot({ path: screenshotFile, fullPage: true });

  const report = {
    label,
    timestamp: new Date().toISOString(),
    url: safeReportUrl(url),
    finalUrl: safeReportUrl(page.url()),
    userId: auth.userId,
    dashboardReadyDurationMs: Number(navDurationMs.toFixed(2)),
    performanceEntries,
    consoleTimings,
    apiRequests,
    traceFile,
    screenshotFile,
  };

  await fs.writeFile(reportFile, redactPerfToken(JSON.stringify(report, null, 2), auth.token));

  await browser.close();

  process.stdout.write(`Saved browser benchmark report: ${reportFile}\n`);
  if (traceFile) {
    process.stdout.write(`Saved trace: ${traceFile}\n`);
  }
  process.stdout.write(`Dashboard ready duration: ${report.dashboardReadyDurationMs}ms\n`);
  if (report.performanceEntries.redirectToDashboardReadyMs !== null) {
    process.stdout.write(
      `Redirect-to-dashboard-ready duration: ${Number(report.performanceEntries.redirectToDashboardReadyMs.toFixed(2))}ms\n`
    );
  }
}

main().catch((error) => {
  console.error('benchmark-browser failed:', redactPerfToken(String(error), tokenToRedact).replace(/([?&]token=)[^&\s]+/g, '$1[REDACTED]'));
  process.exit(1);
});
