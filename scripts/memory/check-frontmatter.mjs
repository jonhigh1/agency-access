// Frontmatter checker for the solutions corpus (U4).
// Required: title, date, category, module, problem_type, tags.
// problem_type tracks the corpus enum (knowledge-track + bug-track).

const REQUIRED = ['title', 'date', 'category', 'module', 'problem_type', 'tags'];

const PROBLEM_TYPES = new Set([
  'architecture_pattern',
  'design_pattern',
  'tooling_decision',
  'convention',
  'workflow_issue',
  'developer_experience',
  'documentation_gap',
  'best_practice',
  'build_error',
  'test_failure',
  'runtime_error',
  'performance_issue',
  'database_issue',
  'security_issue',
  'ui_bug',
  'integration_issue',
  'logic_error',
]);

export function parseFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return null;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---');
  if (end < 0) return null;
  const fields = {};
  let current = null;
  const unquote = (v) => v.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
  for (const line of lines.slice(1, end)) {
    const m = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (m) {
      current = m[1];
      fields[current] = unquote(m[2].trim());
      continue;
    }
    // Block-style list continuation: fold `- item` lines into the current key.
    const item = line.match(/^\s*-\s+(.*)$/);
    if (item && current) {
      const v = unquote(item[1].trim());
      fields[current] = fields[current] ? `${fields[current]} ${v}` : v;
    }
  }
  return fields;
}

export function checkFile(path, text) {
  const errors = [];
  const fm = parseFrontmatter(text);
  if (!fm) {
    return [`${path}: missing frontmatter block`];
  }
  for (const key of REQUIRED) {
    if (!(key in fm) || fm[key] === '') errors.push(`${path}: missing required field '${key}'`);
  }
  if (fm.problem_type && !PROBLEM_TYPES.has(fm.problem_type)) {
    errors.push(`${path}: unknown problem_type '${fm.problem_type}'`);
  }
  return errors;
}
