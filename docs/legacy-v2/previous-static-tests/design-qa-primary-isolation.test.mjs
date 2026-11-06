import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('footer accent CTA is its own variant rather than a primary override',()=>{
  assert.match(read('src/components/ui/button.tsx'),/accent: "button-accent"/);
  assert.match(read('src/components/ui/site-footer.tsx'),/variant="accent"/);
  assert.doesNotMatch(read('src/components/ui/site-footer.tsx'),/!bg-accent/);
});
test('accent component consumes semantic tokens',()=>{
  assert.match(read('src/app/unified-design-system.css'),/--component-button-accent-bg: var\(--semantic-brand-accent\)/);
  assert.match(read('src/app/globals.css'),/\.button-accent\s*\{[\s\S]*?var\(--component-button-accent-bg\)/);
});
test('browser QA isolates each token route and asserts exact computed color',()=>{
  const s=read('scripts/browser-design-qa.mjs');
  assert.match(s,/for \(const route of \['\/', '\/client\/forgot-password', '\/admin\/discovery\/login'\]\) \{\s*const context = await browser.newContext/);
  assert.match(s,/color===expected/);
});

test('browser token QA disables transitions and reports failed computed token chains',()=>{
  const s=read('scripts/browser-design-qa.mjs');
  assert.match(s,/transition-duration:0s!important/);
  assert.match(s,/requestAnimationFrame\(\(\) => requestAnimationFrame\(resolve\)\)/);
  assert.match(s,/entry\.afterDetails = afterDetails/);
  assert.match(s,/entry\.failures = afterDetails/);
});
