import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (p) => readFileSync(p,'utf8');
const core=read('src/app/unified-design-system.css');
const theme=read('src/app/summit-inspired-system.css');
const app=read('src/app/globals.css');
const capture=read('scripts/full-site-screenshots.mjs');
test('single token bridge provides teal base plus dark mode',()=>{
 for(const name of ['--primitive-forest-900: #063a40','--primitive-forest-800: #07565e','--semantic-bg-page: #0d2024','--component-type-page-title: clamp(2.75rem, 5.3vw, 4.5rem)']) assert.ok(core.includes(name),name);
});
test('shared layout sheet is imported after legacy sheets',()=>{
 assert.ok(app.indexOf('summit-inspired-system.css')>app.indexOf('progress.css'));
 for(const selector of ['.rp-home .hero-v9','.rp-admin-main','.site-header-v9','.rp-page .ds-section']) assert.ok(theme.includes(selector),selector);
});
test('capture covers all three surfaces and responsive breakpoints',()=>{
 for(const route of ['/admin/inquiries','/client/billing','/discovery','/pricing','/work']) assert.ok(capture.includes(route),route);
 for(const size of ['390','768','1440']) assert.ok(capture.includes(size),size);
 assert.ok(capture.includes('authRedirect'));
});
