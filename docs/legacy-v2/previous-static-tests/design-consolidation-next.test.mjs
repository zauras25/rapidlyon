import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = f => readFileSync(new URL(`../src/app/${f}`, import.meta.url), 'utf8');
test('V3 legacy palette aliases consume semantic colors', () => {
 const css = read('rapidlyon-unified-v3.css');
 for (const [key,val] of Object.entries({
  '--v3-forest':'--semantic-brand-primary',
  '--v3-canvas':'--semantic-bg-page',
  '--v3-white':'--semantic-bg-surface',
  '--ds-color-sidebar-active':'--semantic-nav-active'
 })) assert.match(css,new RegExp(`${key}\\s*:\\s*var\\(${val}\\)`));
});
test('Shared admin shell colors use semantic/button variables',()=>{
 const css=read('studio-os.css');
 assert.match(css,/\.r-os-primary\{[^}]*background:var\(--component-button-primary-bg\)/);
 assert.match(css,/\.r-os-primary:hover\{[^}]*background:var\(--component-button-primary-hover-bg\)/);
});
test('Marketing primary surfaces use central brand aliases',()=>{
 const css=read('rapidlyon-phase4.css');
 assert.match(css,/\.rp-next-step\{[^}]*background:var\(--semantic-brand-primary\)/);
});
test('Navigation role values exist for both modes',()=>{
 const css=read('unified-design-system.css');
 for(const role of ['--semantic-nav-hover','--semantic-nav-active','--semantic-nav-active-text']) assert.match(css,new RegExp(role+': var\\('));
});
