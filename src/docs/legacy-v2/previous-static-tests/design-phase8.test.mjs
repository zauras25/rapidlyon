import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../src/app/unified-design-system.css', import.meta.url), 'utf8');
test('Hero CTA default and hover use primary component aliases', () => {
  const block = css.match(/\.rp-home \.hero-v9-actions > a:first-child \{([^}]+)\}/)?.[1];
  assert.ok(block);
  for (const role of ['bg','text','border']) assert.ok(block.includes(`--component-button-primary-${role === 'bg' ? 'bg' : role === 'text' ? 'text' : 'border'}`));
  const hover = css.match(/\.rp-home \.hero-v9-actions > a:first-child:hover \{([^}]+)\}/)?.[1];
  assert.ok(hover?.includes('--component-button-primary-hover-bg'));
  assert.doesNotMatch(block + hover, /#[0-9a-f]{3,8}/i);
});
test('shared card and button styles use component aliases', () => {
  assert.ok(css.includes('/* Phase 8: central token consumers'));
  for (const token of ['--component-card-bg','--component-card-border','--component-button-primary-bg','--component-button-primary-hover-bg']) {
    assert.ok(css.includes(`var(${token})`));
    assert.ok(tokens.includes(`${token}:`));
  }
});
test('light and dark mode expose semantic roles for component references', () => {
  assert.match(tokens, /:root\[data-theme="dark"\]/);
  for (const token of ['--semantic-bg-page','--semantic-bg-surface','--semantic-text-primary','--semantic-brand-primary']) {
    assert.ok(tokens.includes(`${token}:`));
  }
});
