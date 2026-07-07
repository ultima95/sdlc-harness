import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { templatesDir } from './paths.mjs';
import { parseConfig, getValue } from './config.mjs';

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
