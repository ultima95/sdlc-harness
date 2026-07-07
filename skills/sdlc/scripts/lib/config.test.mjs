import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { templatesDir } from './paths.mjs';
import { parseConfig, getValue, validate } from './config.mjs';

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
