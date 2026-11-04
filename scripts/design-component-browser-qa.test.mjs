import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const script=readFileSync(new URL('./browser-component-qa.mjs',import.meta.url),'utf8');
test('component browser QA covers current page, text, card and button tokens',()=>{
  for(const token of ['--color-bg','--color-text','--color-surface','--color-text-muted','--primitive-ink-950']) assert.ok(script.includes(token),token);
  for(const selector of ['body','.service-card:first-child','.form-hint','.btn-dark']) assert.ok(script.includes(selector),selector);
});
test('component browser QA reports absent selectors as skipped, not passed',()=>{
  assert.match(script,/status:'skipped'/);
  assert.match(script,/status: passed \? 'passed' : 'review'/);
});
test('component token checks target current selector routes',()=>{
  assert.ok(script.includes("role.name === 'service card background' && route !== '/'"));
  assert.ok(script.includes("role.name === 'form hint text' && route !== '/contact'"));
  assert.ok(script.includes("document.addEventListener('DOMContentLoaded', applyTheme"));
});
