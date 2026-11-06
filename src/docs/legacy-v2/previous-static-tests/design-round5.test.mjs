import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const redesign = readFileSync(new URL('../src/app/rapidlyon-redesign.css', import.meta.url), 'utf8');
const tokens = readFileSync(new URL('../src/app/unified-design-system.css', import.meta.url), 'utf8');
test('homepage service hover has a valid centralized background value', () => {
  assert.doesNotMatch(redesign, /var\(--component-card-bg\)fff0b/);
  assert.match(redesign, /\.rp-home \.hero-v9-service:hover\{background:var\(--component-card-bg\)/);
});
test('mobile admin sidebar consumes component color aliases', () => {
  assert.match(redesign, /\.rp-admin-mobile-menu\{[^}]*background:var\(--component-sidebar-bg\)/);
  assert.match(redesign, /\.rp-admin-mobile-menu\{[^}]*color:var\(--component-sidebar-text\)/);
});
test('redesign decorative hero and divider aliases are defined', () => {
  for (const name of ['--component-hero-glow', '--component-sidebar-divider']) {
    assert.match(tokens, new RegExp(`${name}: var\\(--`));
  }
  assert.match(redesign, /background:radial-gradient\(ellipse at 90% 5%,var\(--component-hero-glow\)/);
});
test('services and FAQ hover borders use a shared token', () => {
  assert.match(redesign, /\.rp-services \.services-v9-list>li:hover\{border-color:var\(--component-card-hover-border\)/);
  assert.match(redesign, /\.rp-faq details\.rounded-panel\[open\]\{border-color:var\(--component-card-hover-border\)/);
});
