// Fast source contracts for the current root application. These do not replace production E2E QA.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("client authentication is implemented in the current catch-all workspace route", () => {
  const route = read("src/app/client/[[...segments]]/page.tsx");
  const consoleSource = read("src/components/console/client-console.tsx");
  assert.match(route, /<ClientConsole\s*\/>/);
  assert.match(consoleSource, /client\.auth\.signInWithPassword/);
  assert.match(consoleSource, /router\.push\('\/client'\)/);
});

test("admin billing uses the protected shared studio console and commercial API", () => {
  const route = read("src/app/admin/[[...segments]]/page.tsx");
  const consoleSource = read("src/components/console/admin-console.tsx");
  const api = read("src/app/api/admin/commercial/route.ts");
  assert.match(route, /<AdminConsole\s*\/>/);
  assert.match(consoleSource, /url:'\/admin\/billing'/);
  assert.match(api, /await isDiscoveryAdmin\(\)/);
});

test("inquiry actions use exact record IDs and admin-protected endpoints", () => {
  const consoleSource = read("src/components/console/admin-console.tsx");
  const route = read("src/app/api/admin/inquiries/route.ts");
  assert.match(consoleSource, /\/api\/admin\/inquiries\/\$\{encodeURIComponent\(id\)\}\/invite/);
  assert.match(route, /z\.uuid\(\)\.safeParse\(id\)/);
  assert.match(route, /query\.set\("id", `eq\.\$\{id\}`\)/);
  assert.match(route, /await isDiscoveryAdmin\(\)/);
});

test("operations navigation uses admin-only operational data", () => {
  const consoleSource = read("src/components/console/admin-console.tsx");
  const route = read("src/app/api/admin/operations/route.ts");
  assert.match(consoleSource, /url:'\/admin\/operations'/);
  assert.match(consoleSource, /operations:'\/api\/admin\/operations'/);
  assert.match(route, /await isDiscoveryAdmin\(\)/);
});

test("guest discovery retains server validation and optional verified-account linking", () => {
  const form = read("src/components/forms/public-forms.tsx");
  const api = read("src/app/api/discovery/route.ts");
  assert.match(form, /export function DiscoveryForm\(\)/);
  assert.match(form, /No login or account required/);
  assert.match(api, /if \(request\.headers\.has\("authorization"\)\)/);
  assert.match(api, /if \(user\)/);
  assert.match(api, /isSameOriginRequest\(request\)/);
  assert.match(api, /checkRateLimit\(request/);
  assert.match(api, /readBoundedBody\(request/);
  assert.match(api, /hasAllowedSignature\(file\)/);
  assert.match(read("src/app/api/admin/discovery/route.ts"), /await isDiscoveryAdmin\(\)/);
});

test("online payments remain explicitly disabled without a verified provider integration", () => {
  const provider = read("src/lib/payments/provider.ts");
  assert.match(provider, /throw new PaymentProviderUnavailableError\(\)/);
  assert.match(read("src/app/api/client/invoices/[invoiceId]/payment/route.ts"), /status: 503/);
});

test("duplicate source and migration trees are excluded from release", () => {
  assert.equal(existsSync(new URL("../src/src/", import.meta.url)), false);
  assert.equal(existsSync(new URL("../supabase/supabase/", import.meta.url)), false);
});
