import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css = readFileSync(new URL('../src/app/unified-design-system.css', import.meta.url), 'utf8');
// Resolve the *actual cascade order* for root declarations and the dark override.
function declarationsFor(theme) {
  const vars = new Map();
  const re = /(:root(?:\[data-theme="dark"\])?)\s*\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) {
    if (m[1] !== ':root' && (theme !== 'dark' || m[1] !== ':root[data-theme="dark"]')) continue;
    for (const d of m[2].matchAll(/(--[a-zA-Z0-9-]+)\s*:\s*([^;]+);/g)) vars.set(d[1], d[2].trim());
  }
  return vars;
}
function resolve(vars, name, seen = new Set()) {
  assert.ok(vars.has(name), `missing token ${name}`);
  assert.ok(!seen.has(name), `circular token alias at ${name}`);
  const next = new Set([...seen, name]);
  return vars.get(name).replace(/var\(\s*(--[a-zA-Z0-9-]+)(?:\s*,\s*([^)]*))?\)/g, (_, token, fallback) =>
    vars.has(token) ? resolve(vars, token, next) : (fallback ?? (()=>{throw new Error(`undefined ${token} referenced by ${name}`)})())
  );
}
for (const mode of ['light', 'dark']) {
  test(`${mode}: central component tokens resolve without cycles or missing aliases`, () => {
    const vars = declarationsFor(mode);
    for (const name of ['--component-button-primary-bg','--component-button-primary-hover-bg','--component-button-primary-text','--component-button-primary-border','--component-card-bg','--component-card-border','--component-input-bg','--component-input-focus','--component-nav-bg','--component-sidebar-bg']) {
      const value = resolve(vars, name);
      assert.ok(value && !value.includes('var('), `${name}: ${value}`);
    }
  });
}
test('primary button changes are inherited from semantic brand in both modes', () => {
  for (const mode of ['light', 'dark']) {
    const vars = declarationsFor(mode);
    assert.equal(resolve(vars, '--component-button-primary-bg'), resolve(vars, '--semantic-brand-primary'));
    assert.equal(resolve(vars, '--component-button-primary-border'), resolve(vars, '--component-button-primary-bg'));
  }
});
test('light and dark modes resolve to different button, page and card colors', () => {
  const light = declarationsFor('light'); const dark = declarationsFor('dark');
  for (const token of ['--component-button-primary-bg','--semantic-bg-page','--component-card-bg'])
    assert.notEqual(resolve(light, token), resolve(dark, token), token);
});
