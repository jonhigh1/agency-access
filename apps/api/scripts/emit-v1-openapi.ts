/**
 * Regenerate the checked-in v1 OpenAPI spec from the shared zod module.
 * Run from `apps/api/`: `npm run openapi:build`.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildV1OpenApi } from '@/openapi/build-v1-openapi.js';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'openapi', 'v1.openapi.json');
writeFileSync(out, `${JSON.stringify(buildV1OpenApi(), null, 2)}\n`);
console.log(`wrote ${out}`);
