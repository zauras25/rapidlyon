import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import ts from "typescript";

const read = path => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");

function loadTypeScriptModule(path) {
  const source = ts.transpileModule(read(path), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "exports", "module", source)(
    name => {
      if (name === "server-only") return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
    loaded.exports,
    loaded,
  );
  return loaded.exports;
}

test("public service catalog keeps unapproved rates unpublished and quote-only", () => {
  const { engagementOptions } = loadTypeScriptModule("src/data/engagement-options.ts");
  assert.equal(engagementOptions.length, 4);
  for (const option of engagementOptions) {
    assert.equal(option.startingPriceMinor, null);
    assert.equal(option.priceCurrency, null);
    assert.equal(option.priceApproval, "pending");
    assert.ok(option.id);
  }

  const pricingPage = read("src/components/site/public-pages.tsx");
  const discoveryForm = read("src/components/forms/public-forms.tsx");
  const siteCopy = read("src/data/site.ts");
  for (const source of [pricingPage, discoveryForm, siteCopy]) {
    assert.doesNotMatch(source, /\$(?:179|299|549|129|499|899|199)\b/);
  }
  assert.match(pricingPage, /Custom quote/);
  assert.match(discoveryForm, /No commitment required/i);
  assert.match(read("src/lib/discovery.ts"), /Choose a valid service path/);
});

test("proposal payment installments use exact minor-unit arithmetic", () => {
  const { createProjectPaymentSchedule } = loadTypeScriptModule("src/lib/payment-schedule.ts");
  const cases = [
    { amount: "100.00", currency: "USD", expected: ["40.00", "30.00", "30.00"] },
    { amount: "123.45", currency: "USD", expected: ["49.38", "37.04", "37.03"] },
    { amount: "0.03", currency: "PKR", expected: ["0.01", "0.01", "0.01"] },
  ];

  for (const item of cases) {
    const schedule = createProjectPaymentSchedule(item.amount, item.currency);
    assert.deepEqual(schedule.map(row => row.amount), item.expected);
    assert.deepEqual(schedule.map(row => row.percentage), [40, 30, 30]);
    assert.ok(schedule.every(row => row.currency === item.currency));
    const total = schedule.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
    assert.equal(total, Math.round(Number(item.amount) * 100));
  }

  const selectedMilestone = createProjectPaymentSchedule("123.45", "PKR", 3);
  assert.equal(selectedMilestone[1].milestone_position, 3);
});

test("proposal payment schedules reject unsupported currency and unusable totals", () => {
  const { createProjectPaymentSchedule } = loadTypeScriptModule("src/lib/payment-schedule.ts");
  assert.throws(() => createProjectPaymentSchedule("100.00", "EUR"), /Choose USD or PKR/);
  assert.throws(() => createProjectPaymentSchedule("100.00", "USD", 0), /valid agreed milestone/);
  assert.throws(() => createProjectPaymentSchedule("100.00", "USD", 51), /valid agreed milestone/);
  assert.throws(() => createProjectPaymentSchedule("0.02", "USD"), /at least 0.03/);
  assert.throws(() => createProjectPaymentSchedule("1.001", "USD"), /valid project total/);
});

test("proposal creation, edits and client acceptance are guarded by the standard schedule", () => {
  const createRoute = read("src/app/api/admin/commercial/route.ts");
  const updateRoute = read("src/app/api/admin/commercial/[kind]/[id]/route.ts");
  const migration = read("supabase/migrations/20261101000100_require_standard_proposal_payment_schedule.sql");
  assert.match(createRoute, /createProjectPaymentSchedule\([\s\S]*parsed\.data\.agreed_milestone_position/);
  assert.match(updateRoute, /createProjectPaymentSchedule\([\s\S]*parsed\.data\.agreed_milestone_position/);
  assert.match(migration, /proposal_payment_schedule_required/);
  assert.match(migration, /proposal_payment_schedule_invalid/);
  assert.match(migration, /milestone_position/);
  assert.match(migration, /jsonb_array_elements\(v_milestones\)/);
  assert.match(migration, /accepted_snapshot = v_snapshot/);
});

test("billing migrations are ordered and enforce acceptance rounding and identity guards", () => {
  const migrationNames = readdirSync(fileURLToPath(new URL("../supabase/migrations/", import.meta.url)))
    .filter(name => /^20261101000[1-3]00_.*\.sql$/.test(name))
    .sort();
  assert.deepEqual(migrationNames, [
    "20261101000100_require_standard_proposal_payment_schedule.sql",
    "20261101000200_automatic_contract_installment_invoices.sql",
    "20261101000300_payment_attempts_and_verified_reconciliation.sql",
  ]);

  const migration = read("supabase/migrations/20261101000100_require_standard_proposal_payment_schedule.sql");
  assert.match(migration, /c\.status = 'active'/);
  assert.match(migration, /email_confirmed_at, auth_user\.confirmed_at/);
  assert.match(migration, /v_currency not in \('USD', 'PKR'\)/);
  assert.match(migration, /jsonb_array_length\(v_schedule\) <> 3/);
  assert.match(migration, /v_schedule->0->>'percentage' = '40'/);
  assert.match(migration, /v_schedule->1->>'percentage' = '30'/);
  assert.match(migration, /v_schedule->2->>'percentage' = '30'/);
  assert.match(migration, /pg_catalog\.round\(v_amount \* 0\.40, 2\)/);
  assert.match(migration, /v_schedule_total <> v_amount/);
  assert.match(migration, /proposal_payment_schedule_invalid/);
});

test("accepted agreements issue exact immutable installment invoices at agreed triggers", () => {
  const migration = read("supabase/migrations/20261101000200_automatic_contract_installment_invoices.sql");
  const milestoneTrigger = migration.match(
    /create or replace function public\.issue_milestone_installment_invoices\(\)([\s\S]*?)\$\$;/,
  )?.[1];
  assert.match(migration, /commercial_agreement_acceptance_invoice/);
  assert.match(migration, /commercial_milestone_installment_invoices/);
  assert.match(migration, /invoices_agreement_installment_unique_idx/);
  assert.match(migration, /contract_installment_total_mismatch/);
  assert.match(migration, /issued_contract_installment_is_immutable/);
  assert.match(migration, /commercial_financial_events/);
  assert.match(migration, /agreed_milestone_mismatch/);
  assert.ok(milestoneTrigger, "milestone invoice trigger function exists");
  assert.match(milestoneTrigger, /order by milestone\.position desc/);
  assert.match(milestoneTrigger, /v_final_milestone_id/);
  assert.match(milestoneTrigger, /v_sequence_two_invoice is not null/);
});

test("Safepay stays disabled until its official API contract and sandbox credentials are verified", () => {
  const fixture = JSON.parse(read("scripts/fixtures/payment-provider-contract.json"));
  const provider = read("src/lib/payments/provider.ts");
  assert.equal(fixture.external_contract_verified, false);
  assert.equal(fixture.sandbox_credentials_available, false);
  assert.equal(fixture.checkout_enabled, false);
  assert.equal(fixture.provider_endpoint, null);
  assert.equal(fixture.authentication_scheme, null);
  assert.equal(fixture.webhook_signature_scheme, null);
  assert.match(provider, /provider === "safepay"[\s\S]*PaymentProviderUnavailableError/);
  assert.equal(fixture.normalized_checkout_request.amountMinor, 12345);
  assert.equal(fixture.normalized_checkout_request.currency, "USD");
  assert.equal(fixture.normalized_webhook_event.amountMinor, 12345);
});
