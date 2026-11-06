import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = (name) => readFileSync(new URL(`../src/app/${name}`, import.meta.url), 'utf8');
const system = read('unified-design-system.css');
const premium = read('rapidlyon-unified-v3.css');
const roles = [
  'component-layout-content-premium-max','component-input-radius-premium',
  'component-card-radius-premium','component-feature-radius',
  'component-admin-sidebar-width','component-admin-topbar-height',
  'component-header-min-height','component-header-link-padding-block',
  'component-header-link-padding-inline','component-button-padding-inline',
  'component-admin-nav-radius','component-admin-nav-height',
  'component-admin-main-padding','component-admin-main-padding-mobile',
  'component-admin-table-heading-size','component-admin-table-body-size',
  'component-admin-table-padding-block','component-admin-control-font-size',
];

test('premium component geometry has one central declaration and a consumer', () => {
  for (const name of roles) {
    assert.match(system, new RegExp(`--${name}\\s*:`), `Missing central token ${name}`);
    assert.match(premium, new RegExp(`var\\(--${name}\\)`), `No premium consumer for ${name}`);
    assert.equal((system.match(new RegExp(`--${name}\\s*:`, 'g')) || []).length, 1, `Duplicate ${name}`);
  }
});

test('v3 buttons use shared component geometry tokens', () => {
  assert.match(premium, /min-height:var\(--component-button-height\)/);
  assert.match(premium, /padding-inline:var\(--component-button-padding-inline\)/);
  assert.match(premium, /border-radius:var\(--component-button-radius\)/);
});
