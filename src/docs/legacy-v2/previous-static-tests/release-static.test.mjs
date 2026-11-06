// Fast, dependency-free source contracts for launch fixes. These do NOT replace production E2E QA.
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('client login can preserve billing destination without widening external redirect rules', () => {
  const src = read('src/app/client/login/page.tsx');
  assert.match(src, /next === "\/client\/billing"/);
  assert.match(src, /return "\/client"/);
  assert.doesNotMatch(src, /return next\s*;[\s\S]*window\.location/);
});
test('admin billing page uses same server session guard as other admin pages', () => {
  const src = read('src/app/admin/billing/page.tsx');
  assert.match(src, /await isDiscoveryAdmin\(\)/);
  assert.match(src, /redirect\("\/admin\/discovery\/login\?next=%2Fadmin%2Fbilling"\)/);
});
test('inquiry selection deep link has protected exact-id fallback', () => {
  const inbox = read('src/components/admin/inquiry-inbox.tsx');
  const route = read('src/app/api/admin/inquiries/route.ts');
  assert.match(inbox, /searchParams\.get\("inquiry"\)/);
  assert.match(inbox, /\/api\/admin\/inquiries\?id=/);
  assert.match(inbox, /detailRef\.current\?\.focus\(\)/);
  assert.match(route, /z\.uuid\(\)\.safeParse\(id\)/);
  assert.match(route, /query\.set\("id", `eq\.\$\{id\}`\)/);
  assert.match(route, /await isDiscoveryAdmin\(\)/);
});
test('operations dashboard is content only, with shared shell as sole navigation', () => {
  const src = read('src/components/admin/admin-operations.tsx');
  const dashboard = src.split('export function AdminOperationsDashboard()')[1].split('export function AdminProjectOperations')[0];
  assert.doesNotMatch(dashboard, /<main\b|<aside\b|r-os-topbar|<nav\b/);
  assert.match(read('src/app/admin/operations/page.tsx'), /<StudioAdminFrame>/);
});
test('guest discovery is available without an account while preserving private client access', () => {
  const form = read('src/components/forms/discovery-form.tsx');
  const api = read('src/app/api/discovery/route.ts');
  assert.match(form, /guestDraftKey/);
  assert.match(form, /window\.sessionStorage\.setItem\(draftKey/);
  assert.doesNotMatch(form, /window\.localStorage\.getItem\(draftKey\)/);
  assert.doesNotMatch(form, /if \(accountStatus !== "signed_in"\)/);
  assert.match(form, /label="Email address"/);
  assert.match(api, /if \(request\.headers\.has\("authorization"\)\)/);
  assert.match(api, /client_id: clientId/);
  assert.match(api, /if \(user\)/);
  assert.match(api, /isSameOriginRequest\(request\)/);
  assert.match(api, /checkRateLimit\(request/);
  assert.match(api, /readBoundedBody\(request/);
  assert.match(api, /hasAllowedSignature\(file\)/);
  assert.match(read('src/app/api/admin/discovery/route.ts'), /await isDiscoveryAdmin\(\)/);
});
test('payments remain explicitly unconfigured', () => {
  const provider = read('src/lib/payments/provider.ts');
  assert.match(provider, /throw new PaymentProviderUnavailableError\(\)/);
  assert.match(read('src/app/api/client/invoices/[invoiceId]/payment/route.ts'), /status: 503/);
});
test('duplicate migration and source folders are excluded from release', () => {
  assert.equal(existsSync(new URL('../src/src/', import.meta.url)), false);
  assert.equal(existsSync(new URL('../supabase/supabase/', import.meta.url)), false);
});
