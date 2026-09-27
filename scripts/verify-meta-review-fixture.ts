/**
 * Validate a private, sanitized pre-review role-test receipt.
 *
 * Usage: npx tsx scripts/verify-meta-review-fixture.ts /private/path/receipt.json
 * Keep the receipt outside the repository. This checks fields and consistency;
 * it does not verify claims against Meta.
 */

import { readFile } from 'node:fs/promises';
import { evaluateMetaReviewFixture } from './meta-review-fixture.js';

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: npx tsx scripts/verify-meta-review-fixture.ts <private-receipt.json>');
    process.exitCode = 1;
    return;
  }

  let receipt: unknown;
  try {
    receipt = JSON.parse(await readFile(inputPath, 'utf8'));
  } catch {
    console.error('Could not read or parse the private receipt.');
    process.exitCode = 1;
  }

  if (receipt !== undefined) {
    const result = evaluateMetaReviewFixture(receipt);
    if (!result.valid) {
      console.error(`Invalid receipt fields: ${result.errors.join(', ')}`);
      process.exitCode = 1;
    } else if (!result.ready) {
      console.error(`Receipt is valid but blocked: ${result.blockers.join(', ')}`);
      process.exitCode = 2;
    } else {
      console.log('Receipt is complete and internally consistent. Confirm each claim against Meta; identity and asset IDs were not printed.');
    }
  }
}

void main().catch(() => {
  console.error('Receipt validation failed.');
  process.exitCode = 1;
});
