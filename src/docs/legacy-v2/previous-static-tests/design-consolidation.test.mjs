import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const v3=readFileSync(new URL('../src/app/rapidlyon-unified-v3.css', import.meta.url),'utf8');
const globals=readFileSync(new URL('../src/app/globals.css', import.meta.url),'utf8');
test('V3 primary and hero CTA use the same global component tokens',()=>{
  assert.match(v3,/\.button-primary\{background:var\(--component-button-primary-bg\)!important;color:var\(--component-button-primary-text\)!important;border-color:var\(--component-button-primary-border\)!important\}/);
  assert.match(v3,/\.rp-home \.hero-v9-actions \.button-primary\{background:var\(--component-button-primary-bg\)!important;color:var\(--component-button-primary-text\)!important;border-color:var\(--component-button-primary-border\)!important\}/);
});
test('V3 hover and focus have no legacy literal visual colors',()=>{
 assert.match(v3,/border-color:var\(--component-card-hover-border\)/);
 assert.match(v3,/box-shadow:var\(--component-input-focus-ring\)/);
 assert.doesNotMatch(v3,/border-color:#c4d9bf/);
});
test('selection and glow follow brand accent',()=>{
 assert.match(globals,/--color-accent-glow: color-mix\(in srgb, var\(--semantic-brand-accent\) 18%, transparent\)/);
 assert.match(globals,/::selection \{\s*background: color-mix\(in srgb, var\(--semantic-brand-accent\) 34%, transparent\)/);
});
