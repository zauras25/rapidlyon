// Static launch guardrails: these tests do not replace authenticated browser QA.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
const text = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));

test('admin has exactly one intended main landmark in the React component hierarchy', () => {
  const chrome = text('src/components/ui/site-chrome.tsx');
  const frame = text('src/components/ui/studio-admin-frame.tsx');
  const operations = text('src/components/admin/admin-operations.tsx');
  const projectDetails = operations.split('export function AdminProjectOperations')[1];
  assert.match(chrome, /isOperations \? \([\s\S]*?<div id="main-content"/);
  assert.match(frame, /<main id="rp-admin-main"/);
  assert.doesNotMatch(projectDetails, /<main\b/);
});

test('admin mobile menu closes by keyboard Escape and restores focus', () => {
  const frame = text('src/components/ui/studio-admin-frame.tsx');
  assert.match(frame, /closeMenuOnEscape/);
  assert.match(frame, /menuButtonRef\.current\?\.focus\(\)/);
  assert.match(frame, /ref=\{menuButtonRef\}/);
});

test('admin project route uses correct breadcrumbs and direct return link', () => {
  const frame = text('src/components/ui/studio-admin-frame.tsx');
  const operations = text('src/components/admin/admin-operations.tsx');
  assert.match(frame, /pathname\.startsWith\("\/admin\/operations\/projects\/"\)/);
  assert.match(operations, /href="\/admin\/operations" className="text-sm font-medium underline/);
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

test('not-found, error and loading share a single tokenized feedback component', () => {
  for (const page of ['error', 'loading', 'not-found']) {
    assert.match(text(`src/app/${page}.tsx`), /<FeedbackPanel\b/);
  }
  const component = text('src/components/ui/feedback-panel.tsx');
  const tokens = text('src/app/unified-design-system.css');
  assert.match(component, /rp-feedback-panel/);
  assert.match(tokens, /\.rp-feedback-panel/);
  assert.match(tokens, /prefers-reduced-motion: reduce/);
});
