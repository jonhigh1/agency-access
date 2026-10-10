import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkFile } from '../memory/check-frontmatter.mjs';

const GOOD = `---
title: Stale design tokens parse as live values
date: 2026-10-09
category: documentation
module: design system
problem_type: documentation_gap
tags: [design-system, stale-frontmatter, tokens]
---

# Body
`;

describe('solutions frontmatter schema (U4)', () => {
  it('accepts the complete exemplar', () => {
    assert.deepEqual(checkFile('exemplar.md', GOOD), []);
  });

  it('rejects a note missing required fields', () => {
    const errors = checkFile('thin.md', '# Title\n\nNo frontmatter here.\n');
    assert.equal(errors.length, 1);
    assert.match(errors[0], /missing frontmatter/);
  });

  it('names each missing field', () => {
    const errors = checkFile(
      'partial.md',
      '---\ntitle: Something\ndate: 2026-10-09\n---\n\n# Body\n',
    );
    assert.ok(errors.some((e) => e.includes("'category'")));
    assert.ok(errors.some((e) => e.includes("'problem_type'")));
  });

  it('rejects unknown problem types', () => {
    const errors = checkFile(
      'odd.md',
      '---\ntitle: T\ndate: 2026-10-09\ncategory: c\nmodule: m\nproblem_type: vibes\ntags: [x]\n---\n',
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /unknown problem_type/);
  });

  it('folds block-style lists and strips quotes', () => {
    const errors = checkFile(
      'block.md',
      '---\ntitle: "Quoted Title"\ndate: 2026-10-09\ncategory: c\nmodule: m\nproblem_type: "documentation_gap"\ntags:\n  - a\n  - b\n---\n',
    );
    assert.deepEqual(errors, []);
  });
});
