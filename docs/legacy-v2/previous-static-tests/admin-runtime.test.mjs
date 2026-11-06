import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import * as crypto from 'node:crypto';
import ts from 'typescript';

function load(path, dependencies, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: name => {
    if (!(name in dependencies)) throw Error(`Unexpected dependency ${name}`);
    return dependencies[name];
  }, ...globals });
  return exports;
}

const { readSupabaseJson } = load('../src/lib/supabase-response.ts', { 'server-only': {} });

test('HTML response yields actionable diagnostics without leaking the body', async () => {
  await assert.rejects(readSupabaseJson(new Response('<!DOCTYPE html>PRIVATE', {
    headers: { 'content-type': 'text/html' },
  }), 'clients'), error => /clients: HTTP 200/.test(error.message)
    && /SUPABASE_URL/.test(error.message) && !/PRIVATE/.test(error.message));
});
test('valid JSON is returned', async () => {
  assert.deepEqual(await readSupabaseJson(Response.json([{ id: 'test' }]), 'clients'), [{ id: 'test' }]);
});
test('database errors include only the safe code, not private error details', async () => {
  await assert.rejects(readSupabaseJson(Response.json({ code: '42P01', message: 'PRIVATE' }, {
    status: 404,
  }), 'clients'), error => /42P01/.test(error.message) && !/PRIVATE/.test(error.message));
});
test('malformed JSON gets a controlled error', async () => {
  await assert.rejects(readSupabaseJson(new Response('PRIVATE', {
    headers: { 'content-type': 'application/json' },
  }), 'clients'), /Response contains invalid JSON/);
});

test('admin expiry is evaluated only after the request connection is established', async () => {
  let connected = false;
  let token;
  class RequestDate extends Date {
    static now() {
      assert.equal(connected, true);
      return 100000;
    }
  }
  const auth = load('../src/lib/discovery-auth.ts', {
    'server-only': {}, 'node:crypto': crypto,
    'next/server': { connection: async () => { connected = true; } },
    'next/headers': { cookies: async () => ({ get: () => ({ value: token }) }) },
  }, { Date: RequestDate, Buffer, URL, process: { env: {
    DISCOVERY_SESSION_SECRET: 'test-secret-with-at-least-32-characters',
  } } });
  const signed = expiry => `${expiry}.${crypto.createHmac('sha256',
    'test-secret-with-at-least-32-characters').update(String(expiry)).digest('base64url')}`;
  token = signed(200);
  assert.equal(await auth.isDiscoveryAdmin(), true);
  connected = false;
  token = signed(99);
  assert.equal(await auth.isDiscoveryAdmin(), false);
  token = '200.invalid-signature';
  assert.equal(await auth.isDiscoveryAdmin(), false);
});
