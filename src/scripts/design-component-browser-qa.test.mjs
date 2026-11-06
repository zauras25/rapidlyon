import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const script=readFileSync(new URL('./browser-component-qa.mjs',import.meta.url),'utf8');
test('component browser QA covers page, cards, inputs and navigation',()=>{
  for(const token of ['--semantic-bg-page','--component-card-bg','--component-input-bg','--component-nav-bg']) assert.ok(script.includes(token),token);
});
test('component browser QA reports absent selectors as skipped, not passed',()=>{
  assert.match(script,/status:'skipped'/);
  assert.match(script,/status: passed \? 'passed' : 'review'/);
});
