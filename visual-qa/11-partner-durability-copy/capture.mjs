import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = process.env.VISUAL_QA_BASE_URL ?? 'http://127.0.0.1:3000';
const route = '/visual-qa/11-partner-durability-copy';

async function main() {
  await mkdir(__dirname, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 120_000 });

  const bodyText = await page.locator('body').innerText();
  for (const needle of [
    'orchestr',
    'remove the Partner',
    'Automatic',
    'Manual',
    'Partner access for your agency',
  ]) {
    if (!bodyText.includes(needle) && !new RegExp(needle, 'i').test(bodyText)) {
      throw new Error(`Visual QA failed: missing copy "${needle}"`);
    }
  }
  if (/catalog_management/i.test(bodyText)) {
    throw new Error('Visual QA failed: catalog_management must not appear in grant/settings copy');
  }

  const agencyPanel = page.locator('text=Partner access model').locator('..').locator('..');
  await agencyPanel.screenshot({
    path: path.join(__dirname, 'agency-meta-settings-partner-copy-desktop.png'),
  });

  await page.locator('[aria-label="Partner access narrative"]').screenshot({
    path: path.join(__dirname, 'grant-partner-durability-desktop.png'),
  });

  await browser.close();
  console.log('Visual QA Pass: ticket 11 screenshots saved');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
