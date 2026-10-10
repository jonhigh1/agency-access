// Claim-marker checker for the memory loop (U3).
// Parses inline terminal markers of the form:  <claim text> → `state [arg]`
// States: pending | verified <sha> | tentative <recheck> | dropped <reason>
//        | promoted <path> | invalidated <superseding-ref>

export const STATES = new Set([
  'pending',
  'verified',
  'tentative',
  'dropped',
  'promoted',
  'invalidated',
]);

const MARKER_RE = /(?:→|->)\s*`([^`]+)`\s*$/;

export function parseMarker(line) {
  const m = line.match(MARKER_RE);
  if (!m) return null;
  const parts = m[1].trim().split(/\s+/);
  return { state: parts[0], arg: parts.slice(1).join(' ') };
}

// A claim line is a markdown list item (bulleted or numbered), optionally
// blockquoted. Task-list items (`- [ ]`) are not claims.
const CLAIM_RE = /^(?:>\s*)*\s*(?:[-*]|\d+[.)])\s+(?!\[ \])\S/;
const CONTINUATION_RE = /^(?:>\s*)?\s+(?![-*]|\d+[.)])\S/;

export function isClaimLine(line) {
  return CLAIM_RE.test(line);
}

const SHA_RE = /^[0-9a-f]{7,40}$/i;

function argError(state, arg) {
  if (state === 'pending') {
    return arg ? 'pending takes no argument' : null;
  }
  if (!arg) return `state '${state}' needs an argument`;
  if (state === 'verified' && !SHA_RE.test(arg) && !arg.startsWith('decision-record')) {
    return 'verified needs a commit SHA or decision-record anchor';
  }
  if (state === 'promoted' && /\s/.test(arg)) {
    return 'promoted needs a path without spaces';
  }
  return null;
}

export function checkText(text) {
  const errors = [];
  const states = new Set();
  // Fold indented continuation lines into the preceding claim line so wrapped
  // prose carries its marker instead of evading the check.
  const logical = [];
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    if (isClaimLine(line) || !CONTINUATION_RE.test(line) || logical.length === 0) {
      logical.push(line);
    } else {
      logical[logical.length - 1] += ` ${line.trim()}`;
    }
  }
  for (const line of logical) {
    if (!isClaimLine(line)) continue;
    const marker = parseMarker(line);
    if (!marker) {
      errors.push(`unmarked claim: ${line.slice(0, 80)}`);
      continue;
    }
    if (!STATES.has(marker.state)) {
      errors.push(`unknown state '${marker.state}': ${line.slice(0, 80)}`);
      continue;
    }
    const problem = argError(marker.state, marker.arg);
    if (problem) {
      errors.push(`${problem}: ${line.slice(0, 80)}`);
      continue;
    }
    states.add(marker.state);
  }
  return { errors, states: [...states].sort() };
}
