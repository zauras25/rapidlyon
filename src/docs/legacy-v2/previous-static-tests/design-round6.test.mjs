import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = (name) => readFileSync(new URL(`../src/app/${name}`, import.meta.url), 'utf8');
test('phase5 operational UI uses semantic aliases without fixed hex fallback', () => {
  const source=css('rapidlyon-phase5.css');
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b/i);
  for(const alias of ['--semantic-bg-surface','--semantic-border-default','--semantic-text-muted','--semantic-text-primary','--semantic-brand-primary']) assert.ok(source.includes(`var(${alias})`));
});
test('legacy sidebar and raised surfaces consume centralized roles', () => {
  assert.match(css('rapidlyon-premium.css'), /\.r-os-sidebar\{background:var\(--component-sidebar-bg\)/);
  assert.match(css('rapidlyon-redesign.css'), /var\(--component-card-shadow-color\)/);
  assert.match(css('unified-design-system.css'), /--component-card-shadow-color:/);
});
