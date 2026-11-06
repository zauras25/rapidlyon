import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
import * as zod from 'zod';

// Execute the actual handler, replacing only service boundaries. The fake
// database applies generic PostgREST filters/projection rather than deciding
// which billing statuses should be visible.
const source = ts.transpileModule(readFileSync(fileURLToPath(new URL('../src/app/api/client/commercial/route.ts', import.meta.url)), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

async function billing(rows, clientId = 'client-a') {
  const calls = [];
  const routeModule = { exports: {} };
  class CommercialError extends Error {}
  const dependencies = {
    'next/server': { NextResponse: { json: (body, options = {}) => ({
      status: options.status ?? 200, body: JSON.parse(JSON.stringify(body)),
    }) } },
    zod,
    '@/lib/client-auth': { getAuthenticatedClient: async () => clientId
      ? { clientId, name: 'Test client', email: 'test@example.com' } : null },
    '@/lib/discovery-auth': {},
    '@/lib/commercial': { CommercialError, readCommercialRows: async (table, query) => {
      calls.push({ table, query });
      let result = rows[table] ?? [];
      for (const [field, filter] of query) {
        if (filter.startsWith('eq.')) result = result.filter(row => row[field] === filter.slice(3));
        if (filter.startsWith('in.(')) {
          const values = filter.slice(4, -1).split(',');
          result = result.filter(row => values.includes(row[field]));
        }
      }
      const fields = query.get('select');
      return result.map(row => fields === '*' ? { ...row } : Object.fromEntries(
        fields.split(',').filter(key => key in row).map(key => [key, row[key]])));
    } },
    '@/lib/supabase-server': { getSupabaseServerConfig: () => ({
      url: 'https://example.invalid', serviceRoleKey: 'test-only',
    }) },
  };
  vm.runInNewContext(source, {
    exports: routeModule.exports,
    require: name => {
      if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    URLSearchParams, process: { env: {} }, console,
    fetch: async () => ({ ok: true }),
  });
  return { response: await routeModule.exports.GET(new Request('https://example.invalid/api/client/commercial')), calls };
}

const record = (id, status, client_id = 'client-a') => ({
  id, status, client_id, project_id: 'project-a', title: 'Public title',
  notes: 'Internal proposal notes', future_private_field: 'Never expose this',
});

test('hides drafts and unrecognized states for every commercial document type', async () => {
  const rows = Object.fromEntries(['project_proposals', 'project_agreements', 'invoices']
    .map(table => [table, [record(`${table}-draft`, 'draft'), record(`${table}-future`, 'new_private_state')]]));
  const { response } = await billing(rows);
  assert.equal(response.status, 200);
  for (const field of ['proposals', 'agreements', 'invoices', 'lineItems', 'payments']) {
    assert.deepEqual(response.body[field], []);
  }
});

test('keeps shared and historical documents available', async () => {
  const { response } = await billing({
    project_proposals: ['sent', 'viewed', 'accepted', 'declined', 'expired'].map(s => record(`p-${s}`, s)),
    project_agreements: ['sent', 'accepted', 'declined', 'superseded'].map(s => record(`a-${s}`, s)),
    invoices: ['sent', 'viewed', 'pending', 'paid', 'overdue', 'cancelled', 'refunded'].map(s => record(`i-${s}`, s)),
  });
  assert.equal(response.body.proposals.length, 5);
  assert.equal(response.body.agreements.length, 4);
  assert.equal(response.body.invoices.length, 7);
});

test('never returns another client documents or related rows', async () => {
  const { response } = await billing({
    project_proposals: [record('p-other', 'sent', 'client-b')],
    project_agreements: [record('a-other', 'sent', 'client-b')],
    invoices: [record('i-own', 'paid'), record('i-other', 'paid', 'client-b')],
    invoice_line_items: [{ id: 'own', invoice_id: 'i-own', client_id: 'client-a' },
      { id: 'foreign', invoice_id: 'i-own', client_id: 'client-b' }],
    invoice_payments: [{ id: 'foreign-pay', invoice_id: 'i-own', client_id: 'client-b' }],
  });
  assert.deepEqual(response.body.proposals, []);
  assert.deepEqual(response.body.agreements, []);
  assert.deepEqual(response.body.invoices.map(r => r.id), ['i-own']);
  assert.deepEqual(response.body.lineItems.map(r => r.id), ['own']);
  assert.deepEqual(response.body.payments, []);
});

test('hides line items and payment metadata belonging to draft invoices', async () => {
  const { response } = await billing({
    invoices: [record('i-draft', 'draft'), record('i-paid', 'paid')],
    invoice_line_items: ['i-draft', 'i-paid'].map(invoice_id => ({
      id: invoice_id, invoice_id, client_id: 'client-a', description: 'Example',
    })),
    invoice_payments: ['i-draft', 'i-paid'].map(invoice_id => ({
      id: invoice_id, invoice_id, client_id: 'client-a', status: 'paid',
    })),
  });
  assert.deepEqual(response.body.lineItems.map(r => r.invoice_id), ['i-paid']);
  assert.deepEqual(response.body.payments.map(r => r.invoice_id), ['i-paid']);
});

test('does not fetch related records when there are no visible invoices', async () => {
  const { calls } = await billing({ invoices: [record('hidden', 'draft')] });
  assert.equal(calls.some(c => ['invoice_line_items', 'invoice_payments'].includes(c.table)), false);
});

test('uses explicit fields and excludes internal proposal notes', async () => {
  const { response, calls } = await billing({ project_proposals: [record('sent', 'sent')] });
  assert.equal(response.body.proposals[0].title, 'Public title');
  assert.equal('notes' in response.body.proposals[0], false);
  assert.equal('future_private_field' in response.body.proposals[0], false);
  assert.ok(calls.every(c => c.query.get('select') !== '*'));
});

test('rejects unauthenticated access without reading commercial data', async () => {
  const { response, calls } = await billing({}, null);
  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});
