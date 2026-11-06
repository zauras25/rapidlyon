import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
for (const file of ['rapidlyon-phase6.css', 'rapidlyon-phase9.css']) {
  test(`${file} has no literal hex color overrides`, () => {
    const css = readFileSync(new URL(`../src/app/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b/, `Hardcoded color in ${file}`);
  });
}
test('phase 6 primary CTA uses the shared component button contract', () => {
  const css = readFileSync(new URL('../src/app/rapidlyon-phase6.css', import.meta.url), 'utf8');
  assert.match(css, /\.phase6-primary\{[^}]*background:var\(--component-button-primary-bg\)/);
  assert.match(css, /\.phase6-primary:hover:not\(:disabled\)\{[^}]*background:var\(--component-button-primary-hover-bg\)/);
});
test('phase 9 nav and review surfaces resolve through semantic roles', () => {
  const css = readFileSync(new URL('../src/app/rapidlyon-phase9.css', import.meta.url), 'utf8');
  assert.match(css, /\.r-p9-nav a:hover[^}]*background:var\(--semantic-bg-hover\)/);
  assert.match(css, /\.r-p9-review\s*\{[^}]*background:var\(--semantic-status-success-bg\)/);
});
