import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

function loadNotificationModule() {
  const source = readFileSync(new URL("../src/lib/discovery-notification.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const env = {
    RESEND_API_KEY: "fixture-resend-key",
    DISCOVERY_NOTIFICATION_TO: "studio@example.test",
    DISCOVERY_NOTIFICATION_FROM: "notices@example.test",
  };
  const context = {
    exports,
    process: { env },
    fetch: async () => { throw new Error("Unexpected network request"); },
    console: { warn() {}, error() {} },
    URL,
    URLSearchParams,
    Date,
    AbortSignal,
  };
  context.require = name => {
      if (name === "server-only") return {};
      throw new Error(`Unexpected dependency: ${name}`);
    };
  vm.runInNewContext(code, context);
  return { ...exports, env, context };
}

function response(ok, rows = []) {
  return { ok, status: ok ? 200 : 500, json: async () => rows };
}

const config = { url: "https://supabase.example.test", serviceRoleKey: "fixture-service-key" };
const submission = {
  fullName: "Fixture Client",
  email: "fixture@example.test",
  company: "Example Studio",
  services: ["Product Design"],
  discoveryMethod: "Email",
  industry: "Software",
  businessStage: "Early",
  projectOverview: "A fixture project overview",
  objectives: "Validate the notification dispatch contract",
  mustHaveFeatures: "An idempotent email notice",
  budget: "",
  timeline: "",
};

test("discovery notifications claim, dispatch idempotently and record provider acceptance", async () => {
  const loaded = loadNotificationModule();
  const calls = [];
  loaded.context.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) return response(true, [{ id: "fixture-id" }]);
    if (calls.length === 2) {
      assert.equal(String(url), "https://api.resend.com/emails");
      const body = JSON.parse(init.body);
      assert.equal(body.to[0], "studio@example.test");
      assert.match(body.text, /Lead reference: fixture-id/);
      assert.equal(init.headers["Idempotency-Key"], "discovery-fixture-id");
      return response(true);
    }
    return response(true, [{ id: "fixture-id" }]);
  };

  assert.equal(
    (await loaded.attemptDiscoveryNotification(
      config, "fixture-id", "2026-11-01T10:00:00.000Z", submission, "pending",
    )).status,
    "sent",
  );
  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /notification_status=eq\.pending/);
  assert.match(calls[2].url, /notification_status=eq\.sending/);
  assert.equal(JSON.parse(calls[2].init.body).notification_status, "sent");
});

test("failed provider responses are recorded as failed, not successful delivery", async () => {
  const loaded = loadNotificationModule();
  let dispatches = 0;
  const statuses = [];
  loaded.context.fetch = async (url, init) => {
    if (String(url).startsWith("https://api.resend.com")) {
      dispatches++;
      return response(false);
    }
    if (init.method === "PATCH") statuses.push(JSON.parse(init.body).notification_status);
    return response(true, [{ id: "fixture-id" }]);
  };

  assert.equal(
    (await loaded.attemptDiscoveryNotification(
      config, "fixture-id", "2026-11-01T10:00:00.000Z", submission, "retry",
    )).status,
    "failed",
  );
  assert.equal(dispatches, 1);
  assert.deepEqual(statuses, ["sending", "failed"]);
});

test("invalid email configuration fails closed without an external dispatch", async () => {
  const loaded = loadNotificationModule();
  loaded.env.DISCOVERY_NOTIFICATION_TO = "not-an-email";
  let dispatches = 0;
  loaded.context.fetch = async _url => {
    if (String(_url).startsWith("https://api.resend.com")) dispatches++;
    return response(true, [{ id: "fixture-id" }]);
  };

  assert.equal(
    (await loaded.attemptDiscoveryNotification(
      config, "fixture-id", "2026-11-01T10:00:00.000Z", submission, "pending",
    )).status,
    "failed",
  );
  assert.equal(dispatches, 0);
});

test("concurrent notification claim loss does not send a duplicate", async () => {
  const loaded = loadNotificationModule();
  let calls = 0;
  loaded.context.fetch = async () => {
    calls++;
    return response(true, []);
  };

  assert.equal(
    (await loaded.attemptDiscoveryNotification(
      config, "fixture-id", "2026-11-01T10:00:00.000Z", submission, "pending",
    )).status,
    "not_claimed",
  );
  assert.equal(calls, 1);
});

test("stale notification claims are retryable but recent claims are not", () => {
  const loaded = loadNotificationModule();
  assert.equal(loaded.isStaleDiscoveryNotification("sending", new Date(0).toISOString()), true);
  assert.equal(loaded.isStaleDiscoveryNotification("sending", new Date().toISOString()), false);
  assert.equal(loaded.isStaleDiscoveryNotification("failed", null), false);
});
