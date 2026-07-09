import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { templatesDir } from './paths.mjs';
import { parseConfig, getValue, validate, applySet, SCHEMA } from './config.mjs';

const templateText = fs.readFileSync(path.join(templatesDir(), 'config.yml'), 'utf8');

test('parseConfig reads scalars, ints, bools, nested keys and lists', () => {
  const m = parseConfig(templateText);
  assert.equal(getValue(m, 'gates.review'), 'hard');
  assert.equal(getValue(m, 'trust_level'), 'normal');
  assert.equal(getValue(m, 'tracks.default_by_type.bug'), 'fast');
  assert.equal(getValue(m, 'loops.max_test'), 3);
  assert.equal(getValue(m, 'git.push'), true);
  assert.deepEqual(getValue(m, 'review.dimensions'),
    ['correctness', 'security', 'tests', 'conventions']);
});

test('getValue returns undefined for an unknown key', () => {
  assert.equal(getValue(parseConfig(templateText), 'nope.here'), undefined);
});

test('parseConfig throws with a line number on an unparseable line', () => {
  assert.throws(() => parseConfig('gates:\n  this line has no colon\n'), /line 2/);
});

test('validate passes the scaffold (warnings only, no errors)', () => {
  const results = validate(parseConfig(templateText));
  assert.equal(results.filter((x) => x.level === 'err').length, 0);
  assert.ok(results.some((x) => x.key === 'project.test' && x.level === 'warn'));
});

test('validate flags bad enum, non-bool, non-positive int, and unknown key', () => {
  const broken = [
    'gates:',
    '  spec_plan: hard',
    '  review: maybe',
    'trust_level: normal',
    'loops:',
    '  max_test: 0',
    '  max_review: 2',
    'git:',
    '  push: yes',
    'bogus_key: 1',
  ].join('\n');
  const results = validate(parseConfig(broken));
  const find = (k) => results.find((x) => x.key === k);
  assert.equal(find('gates.review').level, 'err');
  assert.equal(find('loops.max_test').level, 'err');
  assert.equal(find('git.push').level, 'err');
  assert.equal(find('bogus_key').level, 'err');
});

test('validate warns on an empty dimensions list', () => {
  const text = ['review:', '  dimensions: []', '  verify: adversarial'].join('\n');
  const results = validate(parseConfig(text));
  assert.equal(results.find((x) => x.key === 'review.dimensions').level, 'warn');
});

test('applySet rewrites only the target line and preserves its comment', () => {
  const next = applySet(templateText, 'gates.review', 'soft');
  assert.equal(getValue(parseConfig(next), 'gates.review'), 'soft');
  const before = templateText.split('\n');
  const after = next.split('\n');
  const diff = before.map((l, i) => (l === after[i] ? -1 : i)).filter((x) => x >= 0);
  assert.equal(diff.length, 1, 'exactly one line changes');
  assert.match(after[diff[0]], /# hard \| soft \| off/); // comment preserved
  assert.match(after[diff[0]], /^  review:\s+soft/);      // indentation preserved
  // comment column preserved: soft and hard are the same width, so the whole
  // line is byte-identical except the value token.
  assert.equal(after[diff[0]], before[diff[0]].replace('hard', 'soft'));
});

test('applySet coerces and writes a boolean', () => {
  const next = applySet(templateText, 'git.push', 'false');
  assert.equal(getValue(parseConfig(next), 'git.push'), false);
});

test('applySet writes a list as inline flow', () => {
  const next = applySet(templateText, 'review.dimensions', 'correctness, tests');
  assert.deepEqual(getValue(parseConfig(next), 'review.dimensions'), ['correctness', 'tests']);
  assert.match(next, /dimensions: \[correctness, tests\]/);
});

test('applySet quotes a string value containing spaces', () => {
  const next = applySet(templateText, 'project.test', 'npm test');
  assert.equal(getValue(parseConfig(next), 'project.test'), 'npm test');
  assert.match(next, /test:\s+"npm test"/);
});

test('applySet rejects an invalid enum value without writing', () => {
  assert.throws(() => applySet(templateText, 'gates.review', 'maybe'), /expected hard, soft, off/);
});

test('applySet rejects an unknown key', () => {
  assert.throws(() => applySet(templateText, 'gates.nope', 'hard'), /unknown config key/);
});

test('applySet throws when a schema key is absent from the config', () => {
  const partial = 'gates:\n  spec_plan: hard\n';
  assert.throws(() => applySet(partial, 'gates.review', 'soft'), /re-run \/jig init/);
});

test('schema and template leaf keys stay in sync (drift guard)', () => {
  const templateKeys = [...parseConfig(templateText).leaves.keys()].sort();
  const schemaKeys = Object.keys(SCHEMA).sort();
  assert.deepEqual(templateKeys, schemaKeys);
});

test('legacy git.track_sdlc key validates as git.track_state', () => {
  const model = parseConfig('git:\n  track_sdlc: false\n');
  assert.equal(getValue(model, 'git.track_state'), false);
  const unknown = validate(model).filter(
    (res) => res.level === 'err' && res.note.startsWith('unknown key'),
  );
  assert.deepEqual(unknown.map((res) => res.key), []);
});

test('applySet targets a legacy git.track_sdlc line via either key name', () => {
  const before = 'git:\n  track_sdlc: false\n';
  // the legacy key name still works as a setter argument...
  assert.equal(applySet(before, 'git.track_sdlc', 'true'), 'git:\n  track_sdlc: true\n');
  // ...and the current key name resolves to the same physical line.
  assert.equal(applySet(before, 'git.track_state', 'true'), 'git:\n  track_sdlc: true\n');
});

test('validate flags git.branch_from that is not remote or local', () => {
  const results = validate(parseConfig('git:\n  branch_from: sideways\n'));
  const hit = results.find((x) => x.key === 'git.branch_from');
  assert.equal(hit.level, 'err');
  assert.match(hit.note, /remote, local/); // enum note, not "unknown key"
});

test('applySet writes git.branch_from and rejects an invalid value', () => {
  const next = applySet(templateText, 'git.branch_from', 'local');
  assert.equal(getValue(parseConfig(next), 'git.branch_from'), 'local');
  assert.throws(
    () => applySet(templateText, 'git.branch_from', 'sideways'),
    /expected remote, local/,
  );
});
