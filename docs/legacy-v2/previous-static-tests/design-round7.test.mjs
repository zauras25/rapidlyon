import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');
const admin = read('src/app/studio-os.css');
const tokens = read('src/app/unified-design-system.css');
test('round7 admin legacy stylesheet contains no literal hex color', () => {
  assert.doesNotMatch(admin, /#[0-9a-fA-F]{3,8}\b/);
});
test('round7 admin status icons and shadows consume semantic/component tokens', () => {
  assert.match(admin, /\.r-os-live span\{background:var\(--semantic-status-success\)/);
  assert.match(admin, /\.r-os-icon-button i\{[^}]*background:var\(--semantic-status-warning\)/);
  assert.match(admin, /\.r-os-stat\{[^}]*box-shadow:var\(--component-card-shadow\)/);
  assert.match(admin, /\.r-os-stat-icon\.purple[^}]*var\(--semantic-status-info-bg\)/);
});
test('round7 information status tokens exist for both themes', () => {
  assert.match(tokens, /--semantic-status-info:/);
  assert.match(tokens, /--semantic-status-info-bg:/);
  assert.match(tokens, /:root\[data-theme="dark"\]\s*\{\s*--semantic-status-info:/);
});
