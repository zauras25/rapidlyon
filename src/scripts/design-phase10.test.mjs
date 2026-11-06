import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/app/globals.css', import.meta.url),'utf8');
const tokens = readFileSync(new URL('../src/app/unified-design-system.css', import.meta.url),'utf8');
test('homepage focus outline consumes design tokens',()=>{
 assert.match(css,/\.rp-home a:focus-visible \{ outline: 3px solid var\(--component-focus-outline\)/);
 assert.doesNotMatch(css,/\.rp-home a:focus-visible \{ outline: 3px solid #[0-9a-f]+/i);
});
test('admin and client interactive states consume centralized aliases',()=>{
 const block=css.split('/* PHASE 10 —')[1]; assert.ok(block);
 for(const name of ['--component-focus-outline','--component-input-focus','--component-input-focus-ring','--component-button-secondary-hover-bg','--component-card-hover-border','--component-input-placeholder']){
   assert.ok(block.includes(`var(${name})`),name);
   assert.ok(tokens.includes(`${name}:`),name);
 }
 assert.doesNotMatch(block, /#[0-9a-f]{3,8}\b/i);
});
