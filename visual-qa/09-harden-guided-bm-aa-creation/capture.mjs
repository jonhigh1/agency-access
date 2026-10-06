import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = __dirname;
const baseUrl = process.env.VISUAL_QA_BASE_URL || 'http://127.0.0.1:3000';

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(`${baseUrl}/test/asset-creation`, { waitUntil: 'networkidle', timeout: 120_000 });

  await page.getByRole('heading', { name: /Zero-portfolio Page discovery/i }).scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(outDir, 'zero-portfolio-bm-create-unlocked.png'),
    fullPage: false,
  });

  await page.getByRole('heading', { name: /Ad Account Empty State/i }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: /Create Ad Account/i }).first().click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: path.join(outDir, 'ad-account-create-entry.png'),
    fullPage: false,
  });

  await browser.close();
  console.log('Visual QA Pass: zero-portfolio-bm-create-unlocked.png, ad-account-create-entry.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
