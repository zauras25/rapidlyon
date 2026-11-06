import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../src/app/unified-design-system.css', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
const toggle = readFileSync(new URL('../src/components/ui/theme-switch.tsx', import.meta.url), 'utf8');
test('both theme scopes and key semantic aliases exist', () => {
  for (const s of [':root[data-theme="dark"]', '--semantic-bg-page:', '--component-button-primary-bg:', '--component-input-bg:']) assert.ok(tokens.includes(s), s);
});
test('primary buttons use global component tokens without hero-local override', () => {
  assert.match(css, /background: var\(--component-button-primary-bg\) !important/);
  assert.doesNotMatch(css, /--component-button-primary-bg:\s*var\(--semantic-brand-accent\)/);
});
test('theme is initialized before hydration, toggle persists and syncs across tabs', () => {
  assert.match(layout, /<head>/);
  assert.match(layout, /localStorage\.getItem\('rapidlyon-theme'\)/);
  assert.match(layout, /suppressHydrationWarning/);
  assert.match(toggle, /addEventListener\("storage"/);
  assert.match(toggle, /localStorage\.setItem/);
});
