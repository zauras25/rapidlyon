// Static launch guardrails: these tests do not replace authenticated browser QA.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
const text = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

test('admin route renders its loading landmark and console content landmark', () => {
  const route = text('src/app/admin/[[...segments]]/page.tsx');
  const console = text('src/components/console/admin-console.tsx');
  assert.match(route, /<main className="auth-layout" aria-busy="true">/);
  assert.match(route, /<AdminConsole\s*\/>/);
  assert.match(console, /<main className="console-content">/);
});

test('admin mobile menu closes by keyboard Escape and restores focus', () => {
  const console = text('src/components/console/admin-console.tsx');
  assert.match(console, /event\.key==='Escape'&&mobile/);
  assert.match(console, /setMobile\(false\)/);
  assert.match(console, /document\.querySelector<HTMLButtonElement>\('\.console-mobile-top'\)\?\.focus\(\)/);
  assert.match(console, /aria-label="Open navigation"/);
});

test('admin navigation exposes current workspace sections and marks active routes', () => {
  const console = text('src/components/console/admin-console.tsx');
  for (const route of ['/admin/inquiries', '/admin/discovery', '/admin/operations', '/admin/projects']) {
    assert.ok(console.includes(`url:'${route}'`), `Missing admin navigation route ${route}`);
  }
  assert.match(console, /pathname===x\.url/);
  assert.match(console, /pathname\.startsWith\(x\.url/);
});

test('internal migrations and internal implementation documentation are never served from public', () => {
  assert.equal(exists('public/supabase'), false);
  assert.equal(exists('public/IMPLEMENTATION.md'), false);
  assert.equal(exists('supabase/migrations/20261027000600_discovery_work_scopes.sql'), true);
  const publicDir = new URL('../public/', import.meta.url);
  assert.equal(readdirSync(publicDir).some((name) => name.endsWith('.sql')), false);
});

test('inquiry writes and admin pipeline counts have network timeout safeguards', () => {
  assert.match(text('src/app/api/inquiries/route.ts'), /signal: AbortSignal\.timeout\(8000\)/);
  assert.match(text('src/app/api/admin/pipeline-counts/route.ts'), /signal: AbortSignal\.timeout\(8000\)/);
});

test('not-found page has a main landmark and a return-home link', () => {
  const notFound = text('src/app/not-found.tsx');
  assert.match(notFound, /<main>/);
  assert.match(notFound, /href="\/"[^>]*>[\s\S]*?Back to homepage/);
});
