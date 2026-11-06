import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const tokens = readFileSync(new URL('../src/app/unified-design-system.css', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const phase9 = styles.split('/* Phase 9: shared component controls and state mapping.')[1];
test('Phase 9 central state tokens exist', () => {
  for(const t of ['--component-button-secondary-hover-bg','--component-navigation-active-bg','--component-navigation-active-text','--component-table-row-hover-bg','--component-input-focus-ring','--component-control-disabled-opacity']) assert.ok(tokens.includes(`${t}:`),t);
});
test('Phase 9 uses tokens in shared admin/client surfaces', () => {
  assert.ok(phase9);
  for(const t of ['--component-button-secondary-bg','--component-button-secondary-hover-bg','--component-navigation-active-bg','--component-table-row-hover-bg','--component-input-focus-ring']) assert.ok(phase9.includes(`var(${t})`),t);
  assert.doesNotMatch(phase9, /#[0-9a-f]{3,8}\b/i);
});
test('the theme tokens retain explicit light and dark modes', () => {
  assert.match(tokens,/:root\[data-theme="dark"\]/);
  assert.match(tokens,/--component-button-primary-bg:\s*var\(--semantic-brand-primary\)/);
  assert.match(tokens,/--component-card-bg:\s*var\(--semantic-bg-surface\)/);
});
