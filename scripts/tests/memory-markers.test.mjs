import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkText } from '../memory/check-markers.mjs';

const SIX_STATE_FIXTURE = [
  '1. Capture fires without a commit gate. → `pending`',
  '2. Walker catches data-entry bugs pre-merge. → `verified abc1234`',
  '3. Hook file observed clean this week. → `tentative (recheck: hook file observed clean)`',
  '4. Old host claim from February. → `dropped (superseded by render.yaml)`',
  '5. Provider-boundary test rule. → `promoted (apps/web/AGENTS.md)`',
  '6. Claim tied to reverted commit. → `invalidated (superseded by PR #181)`',
].join('\n');

describe('memory claim markers (U3)', () => {
  it('parses six distinct states with zero unclassified', () => {
    const { errors, states } = checkText(SIX_STATE_FIXTURE);
    assert.deepEqual(errors, []);
    assert.deepEqual(states, ['dropped', 'invalidated', 'pending', 'promoted', 'tentative', 'verified']);
  });

  it('rejects a rename gate input with one unmarked claim', () => {
    const { errors } = checkText('1. Marked claim. → `pending`\n2. Bare claim with no marker.');
    assert.equal(errors.length, 1);
    assert.match(errors[0], /unmarked claim/);
  });

  it('rejects unknown states', () => {
    const { errors } = checkText('1. Something. → `archived (old)`');
    assert.equal(errors.length, 1);
    assert.match(errors[0], /unknown state/);
  });

  it('rejects argument-less non-pending states', () => {
    const { errors } = checkText('1. Something. → `promoted`');
    assert.equal(errors.length, 1);
    assert.match(errors[0], /needs an argument/);
  });

  it('accepts pending bare', () => {
    const { errors } = checkText('1. Fresh capture. → `pending`');
    assert.deepEqual(errors, []);
  });
});
