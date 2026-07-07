import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { templatesDir } from './lib/paths.mjs';
import { renderShow, renderCheck } from './config.mjs';

const templateText = fs.readFileSync(path.join(templatesDir(), 'config.yml'), 'utf8');

test('renderShow lists keys with allowed values and a check hint', () => {
  const out = renderShow(templateText);
  assert.match(out, /gates\.review\s+hard\s+\[hard \| soft \| off\]/);
  assert.match(out, /Run `\/sdlc config check` to validate\./);
});

test('renderCheck reports zero errors for the scaffold', () => {
  assert.equal(renderCheck(templateText).errors, 0);
});

test('renderCheck reports errors for a broken config', () => {
  const broken = 'gates:\n  spec_plan: hard\n  review: maybe\n';
  assert.ok(renderCheck(broken).errors > 0);
});
