import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const css = (name) => readFileSync(join(root, 'src/app', name), 'utf8');
const core = css('unified-design-system.css');
const global = css('globals.css');
const v3 = css('rapidlyon-unified-v3.css');
const redesign = css('rapidlyon-redesign.css');
const premium = css('rapidlyon-premium.css');
const section = readFileSync(join(root, 'src/components/ui/section-heading.tsx'), 'utf8');

test('typography and vertical rhythm have canonical semantic roles', () => {
  for (const name of [
    '--component-type-page-title', '--component-type-hero-title',
    '--component-type-section-title', '--component-type-app-page-title',
    '--component-layout-section-gap', '--component-layout-section-gap-tight',
    '--component-layout-page-gutter', '--component-layout-content-max',
  ]) assert.match(core, new RegExp(`${name}:`), name);
});

test('public page title inherits one token across all stylesheet layers', () => {
  for (const file of [global, v3]) assert.match(file, /font-size:\s*var\(--component-type-page-title\)/);
  assert.doesNotMatch(redesign, /\.ds-page-title\s*\{[^}]*font-size:\s*clamp\(/);
  assert.doesNotMatch(v3, /\.rp-page \.ds-page-title\s*\{[^}]*font-size:\s*clamp\(/);
});

test('shared editorial sections use the same spacing contract', () => {
  assert.match(global, /--section-space:\s*var\(--component-layout-section-gap\)/);
  assert.match(v3, /--section-space:\s*var\(--component-layout-section-gap\)/);
  assert.match(premium, /\.ds-section\s*\{padding-block:var\(--component-layout-section-gap\)\}/);
  assert.doesNotMatch(redesign, /\.rp-page \.ds-section\s*\{padding-block:clamp\(/);
});

test('shared SectionHeading has no conflicting per-breakpoint font-size utilities', () => {
  assert.match(section, /rp-section-title font-semibold/);
  assert.match(section, /rp-section-description/);
  assert.doesNotMatch(section, /(?:sm|md|lg):text-(?:2xl|3xl|4xl|5xl)/);
  assert.match(v3, /\.rp-section-heading \.rp-section-title\s*\{font-size:var\(--component-type-section-title\)/);
});

test('operational UI keeps a consistent compact type scale, separate from marketing display', () => {
  const ops = css('studio-os.css');
  assert.match(ops, /\.r-os\s*\{[^}]*font-size:var\(--component-type-app-body\)/);
  assert.match(ops, /\.r-os-heading h1\s*\{font-size:var\(--component-type-app-page-title\)/);
});


test('large public headings have restrained desktop caps and one homepage token consumer', () => {
  assert.match(core, /--component-type-page-title:\s*clamp\(2\.75rem,\s*5\.3vw,\s*4\.5rem\)/);
  assert.match(core, /--component-type-hero-title:\s*clamp\(3\.05rem,\s*7\.1vw,\s*5\.75rem\)/);
  assert.doesNotMatch(global, /font-size:\s*clamp\(3\.6rem,\s*7\.6vw,\s*8\.5rem\)/);
});
