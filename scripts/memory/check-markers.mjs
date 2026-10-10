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

const MARKER_RE = /→\s*`([^`]+)`\s*$/;

export function parseMarker(line) {
  const m = line.match(MARKER_RE);
  if (!m) return null;
  const parts = m[1].trim().split(/\s+/);
  return { state: parts[0], arg: parts.slice(1).join(' ') };
}

// A claim line is a markdown list item (bulleted or numbered).
const CLAIM_RE = /^\s*(?:[-*]|\d+[.)])\s+\S/;

export function isClaimLine(line) {
  return CLAIM_RE.test(line);
}

export function checkText(text) {
  const errors = [];
  const states = new Set();
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
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
    if (marker.state !== 'pending' && !marker.arg) {
      errors.push(`state '${marker.state}' needs an argument: ${line.slice(0, 80)}`);
      continue;
    }
    states.add(marker.state);
  }
  return { errors, states: [...states].sort() };
}
