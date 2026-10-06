import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PERMISSION_MATRIX_PATH = join(
  __dirname,
  '../../../../../../docs/app-review/meta/permission-matrix.md'
);

function loadPermissionMatrix(): string {
  return readFileSync(PERMISSION_MATRIX_PATH, 'utf8');
}

describe('permission-matrix Allowed usage drafts (ticket 11)', () => {
  it('drafts match Partner-first honesty: Pages automatic, ad accounts Manual, no catalog_management', () => {
    const doc = loadPermissionMatrix();

    expect(doc).toMatch(/`business_management`.*automatically/i);
    expect(doc).toMatch(/`ads_management`.*Manual/i);
    expect(doc).toMatch(/pages_read_engagement.*post dates/i);
    expect(doc).not.toMatch(/catalog_management.*Allowed usage/i);
    const draftsBlock =
      doc.split('## Allowed usage text drafts')[1]?.split('Review these statements')[0] ?? '';
    expect(draftsBlock).not.toMatch(/engager profile/i);
    expect(draftsBlock).not.toMatch(/catalog_management/);
    expect(doc).toMatch(/OAuth.*orchestr/i);
    expect(doc).toMatch(/remove the Partner|removes the Partner/i);
  });
});
