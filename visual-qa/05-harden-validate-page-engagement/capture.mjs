import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = __dirname;
const fixtureUrl = `file://${path.join(outDir, 'success-state.html')}`;

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(fixtureUrl, { waitUntil: 'load' });

  const bodyText = await page.locator('body').innerText();
  if (/caption must not appear|hidden caption/i.test(bodyText)) {
    throw new Error('Visual QA failed: post text present in success card fixture');
  }
  if (!/Recent public post date/i.test(bodyText)) {
    throw new Error('Visual QA failed: expected date-only post labels');
  }
  if (!/does not grant your agency Page management rights/i.test(bodyText)) {
    throw new Error('Visual QA failed: missing non-claim disclaimer');
  }

  await page.screenshot({
    path: path.join(outDir, 'validate-page-success-dates-only.png'),
    fullPage: true,
  });

  await browser.close();
  console.log('Visual QA Pass (success-state fixture): validate-page-success-dates-only.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
