import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const globals = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const v3 = readFileSync(new URL('../src/app/rapidlyon-unified-v3.css', import.meta.url), 'utf8');
test('round8 shared input/card/divider rules use design aliases', () => {
 assert.match(globals, /border: 1px solid var\(--component-card-border\)/);
 assert.match(globals, /border: 1px solid var\(--component-input-border\)/);
 assert.match(globals, /box-shadow: var\(--component-input-focus-ring\)/);
 assert.doesNotMatch(globals, /border-color: rgb\(23 25 22 \/ (?:7|12|20)%\)/);
});
test('round8 v3 shadows and topbar are theme-aware', () => {
 assert.match(v3, /--v3-shadow:var\(--component-card-shadow\)/);
 assert.match(v3, /--ds-color-admin-topbar:var\(--semantic-bg-surface\)/);
 assert.match(v3, /--ds-focus-ring:var\(--component-focus-ring\)/);
 assert.doesNotMatch(v3, /background:rgba\(247,247,241,\.96\)!important/);
});
