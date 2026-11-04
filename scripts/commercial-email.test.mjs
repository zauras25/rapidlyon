import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

function loadCommercialModule() {
  const source = readFileSync(new URL("../src/lib/commercial.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const env = {
    RESEND_API_KEY: "fixture-resend-key",
    DISCOVERY_NOTIFICATION_FROM: "notices@example.test",
    NEXT_PUBLIC_SITE_URL: "https://rapidlyon.example.test",
  };
  const context = {
    exports,
    process: { env },
    fetch: async () => { throw new Error("Unexpected network request"); },
    console: { warn() {}, error() {} },
    URL,
    AbortSignal,
  };
  context.require = name => {
    if (name === "server-only") return {};
    if (name === "zod") return { z };
    if (name === "@/lib/supabase-server") return { getSupabaseServerConfig: () => null };
    throw new Error(`Unexpected dependency: ${name}`);
  };
  vm.runInNewContext(code, context);
  return { ...exports, env, context };
}

const email = {
  to: "fixture-client@example.test",
  subject: "Review your fixture proposal",
  heading: "<script>alert(1)</script> Proposal ready",
  message: "Review the agreed scope and milestone schedule.",
  actionLabel: 'Review "proposal"',
  actionUrl: "/client/billing?section=proposal",
  idempotencyKey: "fixture-proposal-notice",
};

test("commercial email escapes template content and uses a same-origin action link", async () => {
  const loaded = loadCommercialModule();
  let request;
  loaded.context.fetch = async (url, init) => {
    request = { url: String(url), init };
    return { ok: true, status: 200 };
  };

  assert.equal(await loaded.sendCommercialEmail(email), true);
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.init.headers["Idempotency-Key"], email.idempotencyKey);
  const body = JSON.parse(request.init.body);
  assert.equal(body.to[0], email.to);
  assert.match(body.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(body.html, /<script>/);
  assert.match(body.html, /https:\/\/rapidlyon\.example\.test\/client\/billing\?section=proposal/);
});

test("commercial email rejects off-origin action links without dispatch", async () => {
  const loaded = loadCommercialModule();
  let dispatches = 0;
  loaded.context.fetch = async () => {
    dispatches++;
    return { ok: true, status: 200 };
  };

  assert.equal(await loaded.sendCommercialEmail({ ...email, actionUrl: "https://attacker.example/" }), false);
  assert.equal(dispatches, 0);
});

test("commercial email records provider rejection as failure", async () => {
  const loaded = loadCommercialModule();
  loaded.context.fetch = async () => ({ ok: false, status: 422 });

  assert.equal(await loaded.sendCommercialEmail(email), false);
});

test("commercial email fails closed when Resend credentials are missing", async () => {
  const loaded = loadCommercialModule();
  delete loaded.env.RESEND_API_KEY;
  let dispatches = 0;
  loaded.context.fetch = async () => {
    dispatches++;
    return { ok: true, status: 200 };
  };

  assert.equal(await loaded.sendCommercialEmail(email), false);
  assert.equal(dispatches, 0);
});
