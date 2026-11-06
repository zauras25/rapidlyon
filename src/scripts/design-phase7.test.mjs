import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
const tokens = read('../src/app/unified-design-system.css');
const css = read('../src/app/globals.css');
const toggle = read('../src/components/ui/theme-switch.tsx');
test('dialog and navigation tokens are semantic aliases', () => {
  for (const name of ['--component-dialog-bg', '--component-dialog-border', '--component-navigation-active-bg', '--component-control-disabled-opacity'])
    assert.match(tokens, new RegExp(name + ':'));
});
test('shared shell overlays consume component tokens', () => {
  assert.match(css, /background-color: var\(--component-dialog-bg\)/);
  assert.match(css, /opacity: var\(--component-control-disabled-opacity\)/);
});
test('theme follows OS changes only without an explicit choice', () => {
  assert.match(toggle, /media.addEventListener\("change", syncSystemPreference\)/);
  assert.match(toggle, /saved === "dark" \|\| saved === "light"/);
  assert.match(toggle, /media.removeEventListener\("change", syncSystemPreference\)/);
});
