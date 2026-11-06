import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('client, discovery, admin progress bars use native metrics instead of inline width', () => {
  for (const path of ['src/components/admin/admin-operations.tsx','src/components/client/client-workspace.tsx','src/components/forms/discovery-form.tsx']) {
    const source = read(path);
    assert.doesNotMatch(source, /style=\{\{\s*width:/, path);
    assert.match(source, /<progress\b/, path);
  }
});
test('shared progress styling reads Figma semantic design tokens', () => {
  assert.match(read('src/app/globals.css'), /@import "\.\/progress\.css"/);
  assert.match(read('src/app/progress.css'), /var\(--semantic-brand-primary\)/);
  assert.match(read('src/app/progress.css'), /::-moz-progress-bar/);
  assert.match(read('src/app/progress.css'), /::-webkit-progress-value/);
});
