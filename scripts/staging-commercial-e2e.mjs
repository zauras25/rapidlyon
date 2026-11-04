import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { randomUUID } from 'node:crypto';

const root = process.cwd();
const authorizedRef = 'tfsdwfykhufmjtyvlgmn';
const statuses = new Map();
const blocked = [];
const required = [
  'STAGING_SITE_URL',
  'SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STAGING_CLIENT_A_EMAIL',
  'STAGING_CLIENT_A_PASSWORD',
  'STAGING_CLIENT_A_RECORDS_JSON',
  'STAGING_CLIENT_B_EMAIL',
  'STAGING_CLIENT_B_PASSWORD',
  'STAGING_CLIENT_B_RECORDS_JSON',
  'DISCOVERY_ADMIN_PASSWORD',
];

function importLocalEnvironment() {
  const file = path.join(root, '.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/u)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/u.exec(line);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2];
    if (value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  }
}

function verifyUrl(raw) {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:'
      && parsed.hostname === `${authorizedRef}.supabase.co`
      && !parsed.port
      && parsed.pathname === '/'
      && !parsed.username
      && !parsed.password
      && !parsed.search
      && !parsed.hash;
  } catch {
    return false;
  }
}

function verifySiteUrl(raw) {
  try {
    const parsed = new URL(raw);
    const local = ['localhost', '127.0.0.1'].includes(parsed.hostname);
    return (parsed.protocol === 'https:' || (local && parsed.protocol === 'http:'))
      && (local || /(^|[.-])staging([.-]|$)/iu.test(parsed.hostname))
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
}

function parseRecords(name) {
  let records;
  try {
    records = JSON.parse(process.env[name] || '');
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
  assert.ok(records && typeof records === 'object' && !Array.isArray(records), `${name} must be an object`);
  for (const key of ['projectIds', 'proposalIds', 'agreementIds', 'invoices', 'paymentIds']) {
    assert.ok(Array.isArray(records[key]) && records[key].length > 0, `${name}.${key} must contain synthetic fixture IDs`);
  }
  for (const id of [...records.projectIds, ...records.proposalIds, ...records.agreementIds, ...records.paymentIds]) {
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
  }
  for (const invoice of records.invoices) {
    assert.match(invoice.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu);
    assert.ok(Number.isInteger(invoice.sequence) && invoice.sequence >= 1 && invoice.sequence <= 3);
    assert.match(String(invoice.amount), /^\d+\.\d{2}$/u);
  }
  assert.match(String(records.contractTotal), /^\d+\.\d{2}$/u);
  return records;
}

function recordIds(records) {
  return [
    ...records.projectIds,
    ...records.proposalIds,
    ...records.agreementIds,
    ...records.invoices.map((invoice) => invoice.id),
    ...records.paymentIds,
  ];
}

function collectIds(value, found = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectIds(item, found);
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (['id', 'project_id', 'proposal_id', 'agreement_id', 'invoice_id', 'payment_id'].includes(key) && typeof item === 'string') {
        found.add(item);
      }
      collectIds(item, found);
    }
  }
  return found;
}

function record(name, state) {
  statuses.set(name, state);
  console.log(`${state}: ${name}`);
  if (state === 'BLOCKED') blocked.push(name);
}

async function loginClient(page, email, password) {
  await page.goto(new URL('/client/login', process.env.STAGING_SITE_URL), { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: /^sign in\b/i }).click();
  await page.waitForURL(/\/client(?:\/|$)/u, { timeout: 30_000 });
}

async function readClientCommercial(context, page) {
  const responsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname === '/api/client/commercial' && response.request().method() === 'GET',
  { timeout: 30_000 });
  await page.goto(new URL('/client/billing', process.env.STAGING_SITE_URL), { waitUntil: 'domcontentloaded' });
  const response = await responsePromise;
  assert.equal(response.status(), 200, 'authenticated client commercial endpoint must return 200');
  const payload = await response.json();
  assert.equal(payload.success, true);
  return payload;
}

async function authenticatedSession(context) {
  const storageKey = `sb-${authorizedRef}-auth-token`;
  const token = await context.pages()[0].evaluate((key) => {
    const raw = localStorage.getItem(key);
    if (!raw) return '';
    try { return JSON.parse(raw).access_token || ''; } catch { return ''; }
  }, storageKey);
  assert.ok(token, 'Supabase client must persist an authenticated staging session');
  const response = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      authorization: `Bearer ${token}`,
    },
  });
  assert.equal(response.status, 200, 'staging Auth must accept the client-issued session');
  const user = await response.json();
  return { token, email: user.email };
}

async function verifyClientPartition(label, context, page, session, own, other) {
  const payload = await readClientCommercial(context, page);
  const workspaceResult = await page.evaluate(async (token) => {
    const response = await fetch('/api/client/workspace', {
      headers: { authorization: `Bearer ${token}` },
    });
    return { status: response.status, payload: await response.json() };
  }, session.token);
  assert.equal(workspaceResult.status, 200, 'authenticated client workspace endpoint must return 200');
  assert.equal(workspaceResult.payload.success, true);
  const actual = collectIds([payload, workspaceResult.payload]);
  for (const id of recordIds(own)) assert.ok(actual.has(id), `${label} must see its seeded commercial records`);
  for (const id of recordIds(other)) assert.ok(!actual.has(id), `${label} must not see the other client’s seeded records`);
  const actualInvoices = new Map(payload.invoices.map((invoice) => [invoice.id, invoice]));
  for (const expected of own.invoices) {
    const invoice = actualInvoices.get(expected.id);
    assert.ok(invoice, `${label} must see its own invoice`);
    assert.equal(Number(invoice.installment_sequence), expected.sequence);
    assert.equal(Number(invoice.total).toFixed(2), expected.amount);
  }
  assert.deepEqual(
    own.invoices.map((invoice) => invoice.sequence).sort((a, b) => a - b),
    [1, 2, 3],
    `${label} fixture must include all 40/30/30 installments`,
  );
  const amounts = own.invoices.map((invoice) => Math.round(Number(invoice.amount) * 100));
  assert.equal(amounts.reduce((sum, amount) => sum + amount, 0), Math.round(Number(own.contractTotal) * 100));
  record(`${label} authenticated login, invoice visibility, and ownership isolation`, 'PASS');
  return payload;
}

async function run() {
  importLocalEnvironment();
  const projectRefPath = path.join(root, 'supabase', '.temp', 'project-ref');
  const projectRef = fs.existsSync(projectRefPath) ? fs.readFileSync(projectRefPath, 'utf8').trim() : '';
  if (projectRef !== authorizedRef) {
    record('exact authorized Supabase project reference', 'BLOCKED');
    return 2;
  }
  if (!verifyUrl(process.env.SUPABASE_URL) || !verifyUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    record('server and public Supabase URLs match the authorized staging host', 'BLOCKED');
    return 2;
  }
  for (const [name, value] of Object.entries(process.env)) {
    if (/SUPABASE.*URL$/iu.test(name) && !verifyUrl(value)) {
      record('all configured Supabase URLs match staging', 'BLOCKED');
      return 2;
    }
  }
  if (process.env.RAPIDLYON_STAGING_QA_APPROVED !== 'true'
      || process.env.RAPIDLYON_STAGING_E2E_APPROVED !== 'true') {
    record('explicit staging E2E approval', 'BLOCKED');
    return 2;
  }
  if (!verifySiteUrl(process.env.STAGING_SITE_URL)) {
    record('staging site URL is explicitly staging-scoped or localhost', 'BLOCKED');
    return 2;
  }
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    console.log(`BLOCKED: missing required configuration names: ${missing.join(', ')}`);
    record('synthetic identities, authenticated staging credentials, and fixture IDs', 'BLOCKED');
    return 2;
  }

  const clientAEmail = process.env.STAGING_CLIENT_A_EMAIL;
  const clientBEmail = process.env.STAGING_CLIENT_B_EMAIL;
  if (![clientAEmail, clientBEmail].every((email) => /@(example\.invalid|rapidlyon\.test)$/iu.test(email))) {
    record('synthetic client identity domain validation', 'BLOCKED');
    return 2;
  }
  const clientARecords = parseRecords('STAGING_CLIENT_A_RECORDS_JSON');
  const clientBRecords = parseRecords('STAGING_CLIENT_B_RECORDS_JSON');
  assert.ok(clientARecords.contractTotal, 'Client A records must declare the contract total');
  assert.ok(clientBRecords.contractTotal, 'Client B records must declare the contract total');

  let serverIdentity;
  try {
    const identityResponse = await fetch(new URL('/api/staging-qa/identity', process.env.STAGING_SITE_URL), {
      signal: AbortSignal.timeout(10_000),
    });
    serverIdentity = identityResponse.status === 200 ? await identityResponse.json() : null;
  } catch {
    record('deployed server-side Supabase URL matches staging', 'BLOCKED');
    return 2;
  }
  if (serverIdentity?.verified !== true) {
    record('deployed server-side Supabase URL matches staging', 'BLOCKED');
    return 2;
  }
  record('deployed server-side Supabase URL matches staging', 'PASS');

  const browser = await chromium.launch({ headless: true });
  let exitCode = 0;
  try {
    const clientAContext = await browser.newContext();
    const pageA = await clientAContext.newPage();
    const authRequests = [];
    pageA.on('request', (request) => {
      const requestUrl = new URL(request.url());
      if (requestUrl.hostname === `${authorizedRef}.supabase.co` && requestUrl.pathname.startsWith('/auth/v1/')) {
        authRequests.push(requestUrl.pathname);
      }
    });

    const unauthClientResponse = await clientAContext.request.get(
      new URL('/api/client/commercial', process.env.STAGING_SITE_URL),
    );
    assert.equal(unauthClientResponse.status(), 403, 'unauthenticated client commercial API must be denied');
    record('unauthorized client API request denied', 'PASS');

    await loginClient(pageA, clientAEmail, process.env.STAGING_CLIENT_A_PASSWORD);
    const sessionA = await authenticatedSession(clientAContext);
    assert.equal(sessionA.email?.toLowerCase(), clientAEmail.toLowerCase());
    assert.ok(authRequests.some((requestPath) => requestPath.startsWith('/auth/v1/token')), 'client login must reach staging Supabase Auth');
    await verifyClientPartition('Client A', clientAContext, pageA, sessionA, clientARecords, clientBRecords);

    const unauthAdminResponse = await clientAContext.request.get(
      new URL('/api/admin/commercial', process.env.STAGING_SITE_URL),
    );
    assert.equal(unauthAdminResponse.status(), 401, 'client session cannot access admin commercial API');
    record('client-to-admin protected API request denied', 'PASS');
    await pageA.goto(new URL('/admin', process.env.STAGING_SITE_URL), { waitUntil: 'domcontentloaded' });
    await pageA.getByRole('button', { name: /sign in securely/i }).waitFor({ timeout: 15_000 });
    record('client navigation to the admin workspace presents the sign-in gate', 'PASS');
    await readClientCommercial(clientAContext, pageA);

    if (clientARecords.workflow?.proposalId && clientARecords.workflow?.agreementId) {
      if (process.env.RAPIDLYON_STAGING_COMMERCIAL_WRITE_APPROVED === 'true'
          && process.env.RAPIDLYON_STAGING_EXTERNAL_EMAIL_APPROVED === 'true') {
        for (const [action, id] of [
          ['accept_proposal', clientARecords.workflow.proposalId],
          ['accept_agreement', clientARecords.workflow.agreementId],
        ]) {
          const result = await pageA.evaluate(async ({ actionName, recordId }) => {
            const response = await fetch('/api/client/commercial', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ action: actionName, id: recordId }),
            });
            return { status: response.status, payload: await response.json() };
          }, { actionName: action, recordId: id });
          assert.ok(result.status >= 200 && result.status < 300 && result.payload.success === true);
        }
        record('Client A proposal and agreement acceptance workflow', 'PASS');
      } else {
        console.log('BLOCKED: commercial transitions require separate fixture-write and external-email approvals.');
        record('Client A proposal and agreement acceptance workflow', 'BLOCKED');
      }
    } else {
      record('Client A proposal and agreement acceptance workflow', 'BLOCKED');
    }

    const crossProposal = clientBRecords.proposalIds[0];
    const crossAttempt = await pageA.evaluate(async (id) => {
      const response = await fetch('/api/client/commercial', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'accept_proposal', id }),
      });
      return response.status;
    }, crossProposal);
    assert.ok([404, 409].includes(crossAttempt), 'cross-client proposal action must return an authorization/not-available response');
    record('cross-client proposal action denied', 'PASS');

    const clientBContext = await browser.newContext();
    const pageB = await clientBContext.newPage();
    await loginClient(pageB, clientBEmail, process.env.STAGING_CLIENT_B_PASSWORD);
    const sessionB = await authenticatedSession(clientBContext);
    assert.equal(sessionB.email?.toLowerCase(), clientBEmail.toLowerCase());
    await verifyClientPartition('Client B', clientBContext, pageB, sessionB, clientBRecords, clientARecords);
    await pageB.getByRole('button', { name: /sign out/i }).click();
    await pageB.waitForURL(/\/client\/login(?:\?|$)/u, { timeout: 15_000 });
    const clientLogout = await pageB.evaluate(async () => {
      const response = await fetch('/api/client/commercial');
      return response.status;
    });
    assert.equal(clientLogout, 403, 'client API must deny requests after sign out');
    record('client logout clears protected API access', 'PASS');
    await clientBContext.close();

    const storageFixture = clientARecords.storage;
    if (storageFixture?.own?.bucket && storageFixture?.own?.path
        && storageFixture?.other?.bucket && storageFixture?.other?.path) {
      const storageResponse = async (fixture) => fetch(
        `${process.env.SUPABASE_URL}/storage/v1/object/${encodeURIComponent(fixture.bucket)}/${fixture.path.split('/').map(encodeURIComponent).join('/')}`,
        {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
            authorization: `Bearer ${sessionA.token}`,
          },
        },
      );
      const ownObject = await storageResponse(storageFixture.own);
      const otherObject = await storageResponse(storageFixture.other);
      assert.equal(ownObject.status, 200, 'Client A must be able to read its own staged storage fixture');
      assert.ok([400, 403, 404].includes(otherObject.status), 'cross-client storage denial must be an authorization/not-found response');
      record('authenticated storage ownership fixture and bucket policy', 'PASS');
    } else {
      record('authenticated storage ownership fixture and bucket policy', 'BLOCKED');
    }

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const unauthAdmin = await adminContext.request.get(
      new URL('/api/admin/commercial', process.env.STAGING_SITE_URL),
    );
    assert.equal(unauthAdmin.status(), 401, 'admin commercial endpoint must reject unauthenticated callers');
    await adminPage.goto(new URL('/admin/discovery/login', process.env.STAGING_SITE_URL), { waitUntil: 'domcontentloaded' });
    await adminPage.locator('input[type="password"]').fill(process.env.DISCOVERY_ADMIN_PASSWORD);
    await adminPage.getByRole('button', { name: /sign in securely/i }).click();
    await adminPage.waitForURL(/\/admin(?:\/|$)/u, { timeout: 30_000 });
    const adminData = await adminContext.request.get(
      new URL('/api/admin/commercial', process.env.STAGING_SITE_URL),
    );
    assert.equal(adminData.status(), 200, 'application-issued admin session must authorize the admin API');
    const adminPayload = await adminData.json();
    assert.equal(adminPayload.success, true);
    record('Admin authentication and protected commercial API access', 'PASS');

    await adminPage.getByRole('button', { name: /sign out/i }).click();
    const expiredAdmin = await adminContext.request.get(
      new URL('/api/admin/commercial', process.env.STAGING_SITE_URL),
    );
    assert.equal(expiredAdmin.status(), 401, 'admin API must reject the session after logout');
    record('admin logout invalidates protected API access', 'PASS');
    await adminContext.close();

    const storageKey = `sb-${authorizedRef}-auth-token`;
    await pageA.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        const session = JSON.parse(raw);
        session.expires_at = Math.floor(Date.now() / 1000) - 60;
        session.expires_in = 0;
        session.refresh_token = '';
        localStorage.setItem(key, JSON.stringify(session));
      } catch {
        localStorage.removeItem(key);
      }
    }, storageKey);
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    const hasSession = await pageA.evaluate((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      try {
        const session = JSON.parse(raw);
        return Boolean(session.access_token) && Number(session.expires_at) > Math.floor(Date.now() / 1000);
      } catch {
        return false;
      }
    }, storageKey);
    assert.equal(hasSession, false, 'the expired Supabase session must be cleared or remain expired');
    const expiredClient = await pageA.evaluate(async () => (await fetch('/api/client/commercial')).status);
    assert.equal(expiredClient.status(), 403, 'expired local session must not authorize protected client API access');
    record('expired client session no longer authorizes protected API access', 'PASS');
    await pageA.getByRole('button', { name: /sign out/i }).click().catch(() => undefined);
    await clientAContext.close();

    if (process.env.RAPIDLYON_STAGING_DISCOVERY_WRITE_APPROVED === 'true'
        && process.env.RAPIDLYON_STAGING_EXTERNAL_EMAIL_APPROVED === 'true'
        && process.env.STAGING_QA_DISCOVERY_EMAIL
        && /@(example\.invalid|rapidlyon\.test)$/iu.test(process.env.STAGING_QA_DISCOVERY_EMAIL)) {
      const submission = {
        idempotencyKey: randomUUID(),
        fullName: 'RapidlyOn Staging QA',
        email: process.env.STAGING_QA_DISCOVERY_EMAIL,
        company: 'RapidlyOn Synthetic QA',
        website: '',
        country: 'Test',
        timeZone: 'UTC',
        industry: 'Software',
        businessStage: 'Prototype',
        businessModel: '',
        services: ['Product Design'],
        answers: {},
        projectOverview: 'Synthetic staging-only discovery submission for Playwright verification.',
        objectives: '',
        mustHaveFeatures: '',
        niceToHaveFeatures: '',
        constraints: '',
        budget: '',
        timeline: '',
        productUrl: '',
        competitorReferences: '',
        discoveryMethod: 'Self-guided discovery',
        preferredTimes: '',
        consent: true,
      };
      const discovery = await pageA.evaluate(async (data) => {
        const form = new FormData();
        form.set('submission', JSON.stringify(data));
        const response = await fetch('/api/discovery', { method: 'POST', body: form });
        return { status: response.status, payload: await response.json() };
      }, submission);
      assert.equal(discovery.status, 201);
      assert.equal(discovery.payload.success, true);
      record('synthetic discovery submission (persistent write and external-notification approvals required)', 'PASS');
    } else {
      console.log('BLOCKED: discovery submission requires persistent-write and external-notification approvals.');
      record('synthetic discovery submission (persistent write and external-notification approvals required)', 'BLOCKED');
    }

    const mandatory = [
      'Client A authenticated login, invoice visibility, and ownership isolation',
      'Client B authenticated login, invoice visibility, and ownership isolation',
      'Admin authentication and protected commercial API access',
      'Client A proposal and agreement acceptance workflow',
      'authenticated storage ownership fixture and bucket policy',
      'synthetic discovery submission (persistent write and external-notification approvals required)',
    ];
    for (const testName of mandatory) {
      if (!statuses.has(testName)) record(testName, 'BLOCKED');
    }
    if (blocked.length) exitCode = 2;
  } finally {
    await browser.close();
  }
  return exitCode;
}

run().then((code) => {
  if (code !== 0) process.exitCode = code;
}).catch(() => {
  console.error('FAIL: staging commercial Playwright assertions did not complete; details intentionally omitted.');
  process.exitCode = 1;
});
