import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const INTERNAL_BASE_URL = 'http://127.0.0.1:4174';
const OUT_DIR = path.resolve(process.cwd(), '../../visual-qa/10-connection-error-ux');

const scenarios = [
  {
    slug: 'error-incomplete-permissions',
    supportCode: 'META_CONNECTION_INCOMPLETE_PERMISSIONS',
  },
  {
    slug: 'error-not-admin',
    supportCode: 'META_CONNECTION_NOT_ADMIN',
  },
  {
    slug: 'error-2fa-required',
    supportCode: 'META_CONNECTION_2FA_REQUIRED',
  },
  {
    slug: 'error-page-ownership',
    supportCode: 'META_CONNECTION_PAGE_OWNERSHIP',
  },
  {
    slug: 'error-bm-mismatch',
    supportCode: 'META_CONNECTION_BM_MISMATCH',
  },
];

async function waitForPreviewServer(baseUrl) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/dev/meta-invite/`);
      if (response.ok) {
        return;
      }
    } catch {
      // Keep polling until the preview server is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Preview server did not become ready at ${baseUrl}`);
}

async function startPreviewServer() {
  const preview = spawn(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['exec', 'vite', '--', '--config', 'evidence.vite.config.ts', '--host', '127.0.0.1', '--port', '4174'],
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'pipe',
    },
  );

  try {
    await waitForPreviewServer(INTERNAL_BASE_URL);
  } catch (error) {
    preview.kill('SIGTERM');
    throw error;
  }

  return {
    stop: async () => {
      preview.kill('SIGTERM');
      await new Promise((resolve) => preview.once('exit', resolve));
    },
  };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const previewServer = await startPreviewServer();
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1200 },
      colorScheme: 'light',
    });
    const page = await context.newPage();

    for (const scenario of scenarios) {
      await page.goto(`${INTERNAL_BASE_URL}/dev/meta-invite/?scenario=${scenario.slug}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.getByText('Support code:', { exact: false }).waitFor({ timeout: 15000 });
      await page.getByText(scenario.supportCode, { exact: true }).waitFor({ timeout: 15000 });
      await page.screenshot({
        path: path.join(OUT_DIR, `${scenario.slug}-desktop.png`),
        fullPage: true,
      });
    }

    await context.close();
  } finally {
    await browser.close();
    await previewServer.stop();
  }
}

main().catch((error) => {
  console.error('Failed to capture Meta connection error evidence:', error);
  process.exit(1);
});
