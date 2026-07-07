// Minimal reader/validator/editor for the harness's own .sdlc/config.yml.
// Pure text in, text/data out — no file IO (the CLI does that). Zero deps.

// --- Schema: every leaf key the harness config may contain. ---
export const SCHEMA = {
  'project.build': { type: 'string', placeholder: /^echo 'set project\.build/ },
  'project.test':  { type: 'string', placeholder: /^echo 'set project\.test/ },
  'project.lint':  { type: 'string', placeholder: /^echo 'set project\.lint/ },
  'gates.spec_plan': { type: 'enum', allowed: ['hard', 'soft', 'off'] },
  'gates.review':    { type: 'enum', allowed: ['hard', 'soft', 'off'] },
  'trust_level':     { type: 'enum', allowed: ['strict', 'normal', 'trusted'] },
  'tracks.default_by_type.feature':  { type: 'enum', allowed: ['full', 'fast', 'hotfix'] },
  'tracks.default_by_type.refactor': { type: 'enum', allowed: ['full', 'fast', 'hotfix'] },
  'tracks.default_by_type.bug':      { type: 'enum', allowed: ['full', 'fast', 'hotfix'] },
  'tracks.default_by_type.chore':    { type: 'enum', allowed: ['full', 'fast', 'hotfix'] },
  'loops.max_test':   { type: 'int' },
  'loops.max_review': { type: 'int' },
  'memory.graph':   { type: 'enum', allowed: ['auto', 'on', 'off'] },
  'memory.refresh': { type: 'enum', allowed: ['on_ship', 'manual'] },
  'review.dimensions': { type: 'list' },
  'review.verify':     { type: 'enum', allowed: ['adversarial', 'off'] },
  'ship.mode':      { type: 'enum', allowed: ['commit', 'pr'] },
  'git.track_sdlc':    { type: 'bool' },
  'git.branch':        { type: 'bool' },
  'git.base':          { type: 'string' },
  'git.push':          { type: 'bool' },
  'git.cleanup':       { type: 'enum', allowed: ['on_merge', 'off'] },
  'git.delete_remote': { type: 'bool' },
};

// --- Parser: indentation-stack over the YAML subset the harness emits. ---
export function parseConfig(text) {
  const lines = text.split('\n');
  const leaves = new Map();
  const stack = []; // [{ indent, key }]
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const indent = raw.length - raw.trimStart().length;
    const m = raw.match(/^(\s*)([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) {
      const e = new Error(`cannot parse .sdlc/config.yml line ${i + 1}: ${raw}`);
      e.line = i + 1;
      throw e;
    }
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const key = m[2];
    const valuePart = stripTrailingComment(m[3]);
    if (valuePart === '') {
      stack.push({ indent, key });               // map header
    } else {
      const dotted = [...stack.map((s) => s.key), key].join('.');
      leaves.set(dotted, { value: parseScalar(valuePart), lineIndex: i });
    }
  }
  return { lines, leaves };
}

function stripTrailingComment(rest) {
  const s = rest.trimStart();
  if (s === '' || s[0] === '#') return '';
  if (s[0] === '"' || s[0] === "'") {
    const end = s.indexOf(s[0], 1);
    return end === -1 ? s : s.slice(0, end + 1);
  }
  const h = s.search(/\s#/);
  return (h === -1 ? s : s.slice(0, h)).trim();
}

function parseScalar(v) {
  if ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'"))) return v.slice(1, -1);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  if (v[0] === '[' && v.endsWith(']')) {
    const inner = v.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map((x) => unquote(x.trim()));
  }
  return v;
}

function unquote(x) {
  if ((x[0] === '"' && x.endsWith('"')) || (x[0] === "'" && x.endsWith("'"))) return x.slice(1, -1);
  return x;
}

export function getValue(model, keyPath) {
  return model.leaves.has(keyPath) ? model.leaves.get(keyPath).value : undefined;
}
