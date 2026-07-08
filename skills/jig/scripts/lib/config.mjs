// Minimal reader/validator/editor for Jig's own .jig/config.yml.
// Pure text in, text/data out — no file IO (the CLI does that). Zero deps.

// --- Schema: every leaf key the Jig config may contain. ---
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
  'git.track_state':   { type: 'bool' },
  'git.branch':        { type: 'bool' },
  'git.base':          { type: 'string' },
  'git.push':          { type: 'bool' },
  'git.cleanup':       { type: 'enum', allowed: ['on_merge', 'off'] },
  'git.delete_remote': { type: 'bool' },
};

// Legacy key names accepted for back-compat, normalized to their current key.
export const ALIASES = { 'git.track_sdlc': 'git.track_state' };

// --- Parser: indentation-stack over the YAML subset Jig emits. ---
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
      const e = new Error(`cannot parse .jig/config.yml line ${i + 1}: ${raw}`);
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
      leaves.set(ALIASES[dotted] || dotted, { value: parseScalar(valuePart), lineIndex: i });
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

// --- Validator (doctor). Static only — no file IO, no environment probing. ---
export function validate(model) {
  const results = [];
  for (const key of Object.keys(SCHEMA)) {
    if (!model.leaves.has(key)) {
      results.push({ level: 'err', key, value: undefined, note: 'required key missing' });
      continue;
    }
    results.push(checkValue(key, model.leaves.get(key).value, SCHEMA[key]));
  }
  for (const key of model.leaves.keys()) {
    if (!SCHEMA[key]) {
      results.push({ level: 'err', key, value: model.leaves.get(key).value, note: 'unknown key (not in schema)' });
    }
  }
  return results;
}

function checkValue(key, value, spec) {
  switch (spec.type) {
    case 'enum':
      return spec.allowed.includes(value)
        ? r('ok', key, value)
        : r('err', key, value, `not in {${spec.allowed.join(', ')}}`);
    case 'bool':
      return typeof value === 'boolean'
        ? r('ok', key, value)
        : r('err', key, value, 'must be true or false');
    case 'int':
      return Number.isInteger(value) && value > 0
        ? r('ok', key, value)
        : r('err', key, value, 'must be a positive integer');
    case 'list':
      return Array.isArray(value) && value.length > 0
        ? r('ok', key, value)
        : r('warn', key, value, 'list is empty');
    case 'string':
      return spec.placeholder && spec.placeholder.test(String(value))
        ? r('warn', key, value, 'still the scaffold placeholder')
        : r('ok', key, value);
    default:
      return r('ok', key, value);
  }
}

function r(level, key, value, note) {
  return { level, key, value, note: note || '' };
}

// --- Editor: rewrite one key's line, preserving indentation and comments. ---
export function applySet(text, keyPath, rawValue) {
  const spec = SCHEMA[keyPath];
  if (!spec) throw new Error(`unknown config key: ${keyPath}`);
  const value = coerce(spec, rawValue);
  const model = parseConfig(text);
  const leaf = model.leaves.get(keyPath);
  if (!leaf) {
    throw new Error(`key ${keyPath} not present in .jig/config.yml — re-run /jig init or add it by hand`);
  }
  const lines = text.split('\n');
  const m = lines[leaf.lineIndex].match(/^(\s*[A-Za-z0-9_]+:)(\s*)(.*)$/);
  const comment = trailingComment(m[3]);
  lines[leaf.lineIndex] = m[1] + m[2] + formatValue(spec, value) + comment;
  return lines.join('\n');
}

function coerce(spec, raw) {
  switch (spec.type) {
    case 'bool':
      if (raw === 'true') return true;
      if (raw === 'false') return false;
      throw new Error(`invalid value: ${raw} (expected true or false)`);
    case 'int': {
      if (!/^-?\d+$/.test(raw)) throw new Error(`invalid integer: ${raw}`);
      const n = Number(raw);
      if (n <= 0) throw new Error(`must be a positive integer: ${raw}`);
      return n;
    }
    case 'enum':
      if (!spec.allowed.includes(raw)) {
        throw new Error(`invalid value: ${raw} (expected ${spec.allowed.join(', ')})`);
      }
      return raw;
    case 'list': {
      const items = raw.split(',').map((x) => x.trim()).filter(Boolean);
      if (!items.length) throw new Error('list needs at least one item');
      return items;
    }
    default:
      return raw; // string
  }
}

function formatValue(spec, value) {
  if (spec.type === 'list') return `[${value.join(', ')}]`;
  if (spec.type === 'bool') return value ? 'true' : 'false';
  if (spec.type === 'int') return String(value);
  const s = String(value);
  return needsQuote(s) ? `"${s}"` : s;
}

function needsQuote(s) {
  return s === '' || /[\s:#'"]/.test(s) || /^[[\]{}&*!|>%@`,]/.test(s);
}

function trailingComment(afterColon) {
  const s = afterColon;
  if (s[0] === '"' || s[0] === "'") {
    const end = s.indexOf(s[0], 1);
    if (end !== -1) return s.slice(end + 1);
  }
  const gap = s.match(/\s+#/);
  if (gap) return s.slice(gap.index);
  const trail = s.match(/\s+$/);
  return trail ? trail[0] : '';
}
