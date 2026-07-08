import { test } from 'node:test';
import assert from 'node:assert/strict';
import { slugify, uniqueSlug, dateStamp } from './slug.mjs';

test('slugify lowercases, trims, and dashes spaces', () => {
  assert.equal(slugify('Fix Login Timeout'), 'fix-login-timeout');
});

test('slugify strips punctuation and collapses separators', () => {
  assert.equal(slugify('  Add   CSV_export! '), 'add-csv-export');
  assert.equal(slugify('Refactor auth module'), 'refactor-auth-module');
});

test('slugify caps length at 50 chars with no trailing dash', () => {
  const s = slugify('a'.repeat(60) + ' tail');
  assert.ok(s.length <= 50);
  assert.ok(!s.endsWith('-'));
});

test('uniqueSlug returns base when free, else -2, -3', () => {
  assert.equal(uniqueSlug('x', []), 'x');
  assert.equal(uniqueSlug('x', ['x']), 'x-2');
  assert.equal(uniqueSlug('x', ['x', 'x-2']), 'x-3');
});

test('dateStamp formats a Date as YYYYMMDD (local components)', () => {
  assert.equal(dateStamp(new Date(2026, 6, 6)), '20260706'); // month is 0-based: 6 = July
});
