import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const nodeRequire = createRequire(import.meta.url);

const root = process.cwd();
const projectRefPath = path.join(root, 'supabase/.temp/project-ref');
const authorizedRef = 'tfsdwfykhufmjtyvlgmn';

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

function loadModuleFromSource(sourceText, moduleName) {
  const compiled = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const mod = { exports: {} };
  const requireFromModule = (specifier) => {
    if (specifier === 'server-only') return {};
    if (specifier === 'node:crypto') return nodeRequire('node:crypto');
    if (specifier === 'zod') return nodeRequire('zod');
    return nodeRequire(specifier);
  };

  new Function('require', 'module', 'exports', compiled)(requireFromModule, mod, mod.exports);
  return mod.exports[moduleName] ?? mod.exports;
}

test('Authorized staging project reference is pinned exactly in repo metadata', () => {
  const value = fs.readFileSync(projectRefPath, 'utf8').trim();
  assert.equal(value, authorizedRef, 'supabase/.temp/project-ref must match the authorized staging project reference exactly.');
});

test('Billing payment schedule matches the 40/30/30 contract and totals the full amount', () => {
  const scheduleModule = loadModuleFromSource(read('src/lib/payment-schedule.ts'), 'createProjectPaymentSchedule');
  const installments = scheduleModule('12345.67', 'USD', 2);

  assert.equal(installments.length, 3, 'three installments are required');
  assert.deepEqual(
    installments.map((installment) => ({
      sequence: installment.sequence,
      stage: installment.stage,
      percentage: installment.percentage,
      amount: installment.amount,
      currency: installment.currency,
    })),
    [
      { sequence: 1, stage: 'advance', percentage: 40, amount: '4938.27', currency: 'USD' },
      { sequence: 2, stage: 'agreed_milestone', percentage: 30, amount: '3703.70', currency: 'USD' },
      { sequence: 3, stage: 'final', percentage: 30, amount: '3703.70', currency: 'USD' },
    ],
  );

  const totalMinor = installments.reduce((sum, installment) => {
    const [whole, fraction = '00'] = installment.amount.split('.');
    return sum + (Number(whole) * 100 + Number(fraction.padEnd(2, '0')));
  }, 0);

  assert.equal(totalMinor, 1234567, 'schedule must total the full contract amount in minor units');
  assert.equal(installments[0].amount, '4938.27');
  assert.equal(installments[1].amount, '3703.70');
  assert.equal(installments[2].amount, '3703.70');
});

test('Commercial billing functions and payment guardrails are present in the migration set', () => {
  const migrationFiles = [
    'supabase/migrations/20261101000100_require_standard_proposal_payment_schedule.sql',
    'supabase/migrations/20261101000200_automatic_contract_installment_invoices.sql',
    'supabase/migrations/20261101000300_payment_attempts_and_verified_reconciliation.sql',
  ];

  for (const migrationFile of migrationFiles) {
    assert.ok(fs.existsSync(path.join(root, migrationFile)), `${migrationFile} must exist`);
  }

  const proposalSchedule = read('supabase/migrations/20261101000100_require_standard_proposal_payment_schedule.sql');
  const installmentInvoices = read('supabase/migrations/20261101000200_automatic_contract_installment_invoices.sql');
  const paymentReconciliation = read('supabase/migrations/20261101000300_payment_attempts_and_verified_reconciliation.sql');

  assert.match(proposalSchedule, /accept_project_proposal\(p_proposal_id uuid\)/i);
  assert.match(proposalSchedule, /proposal_payment_schedule_invalid/i);
  assert.match(installmentInvoices, /issue_agreement_installment_invoice\(/i);
  assert.match(installmentInvoices, /commercial_financial_events/i);
  assert.match(installmentInvoices, /contract_installment_total_check/i);
  assert.match(paymentReconciliation, /create_invoice_payment_attempt\(/i);
  assert.match(paymentReconciliation, /process_commercial_payment_event\(/i);
  assert.match(paymentReconciliation, /service_role_required/i);
});

test('Transactional billing SQL is migration-backed, rollback-scoped, and has an exact pgTAP plan', () => {
  const billingTest = read('supabase/tests/20261102_staging_billing_functional.test.sql');
  const plan = Number(/extensions\.plan\((\d+)\)/iu.exec(billingTest)?.[1]);
  const assertions =
    (billingTest.match(/^\s*SELECT extensions\.ok\s*\(/gimu) || []).length
    + (billingTest.match(/DO \$test\$[\s\S]*?\$test\$;/giu) || []).length;

  assert.equal(plan, assertions, 'billing pgTAP plan must equal all explicit assertions');
  assert.match(billingTest, /extensions\.finish\s*\(\s*\)\s*;/iu);
  assert.match(billingTest, /ROLLBACK\s*;\s*$/iu);
  assert.doesNotMatch(billingTest, /CREATE\s+EXTENSION/iu);
  assert.match(billingTest, /round\(amount\s*\*\s*0\.40,\s*2\)\s*=\s*4938\.27/iu);
  assert.match(billingTest, /sum\(total\)\s*=\s*4938\.27/iu);
  assert.match(billingTest, /sum\(total\)\s*=\s*8641\.97/iu);
  assert.match(billingTest, /sum\(total\)\s*=\s*12345\.67/iu);
  assert.match(billingTest, /transition_project_milestone/iu);
  assert.match(billingTest, /installment_invoice_issued/iu);
});

test('RLS SQL fixtures follow actual grants, verify expected denials, and have an exact pgTAP plan', () => {
  const rlsTest = read('supabase/tests/20261102_staging_rls_isolation.test.sql');
  const plan = Number(/extensions\.plan\((\d+)\)/iu.exec(rlsTest)?.[1]);
  const assertions =
    (rlsTest.match(/^\s*SELECT extensions\.ok\s*\(/gimu) || []).length
    + (rlsTest.match(/DO \$test\$[\s\S]*?\$test\$;/giu) || []).length;

  assert.equal(plan, assertions, 'RLS pgTAP plan must equal all explicit assertions');
  assert.match(rlsTest, /extensions\.finish\s*\(\s*\)\s*;/iu);
  assert.match(rlsTest, /ROLLBACK\s*;\s*$/iu);
  assert.match(rlsTest, /WHEN\s+insufficient_privilege/iu);
  assert.match(rlsTest, /RETURNED_SQLSTATE/iu);
  assert.match(rlsTest, /set_config\(\s*'request\.jwt\.claim\.sub'/iu);
  assert.match(rlsTest, /role-simulated Client A/iu);
  assert.match(rlsTest, /role-simulated Client B/iu);
  assert.match(rlsTest, /app_metadata/iu);
  assert.match(rlsTest, /storage\.objects/iu);
});

test('Staging runner requires independently scoped approval and a direct staging DB host', () => {
  const runner = read('Run-Staging-QA.ps1');
  assert.match(runner, /RAPIDLYON_STAGING_SQL_WRITE_APPROVED/iu);
  assert.match(runner, /RAPIDLYON_STAGING_E2E_APPROVED/iu);
  assert.match(runner, /db\.\$authorizedRef\.supabase\.co/iu);
  assert.match(runner, /STAGING_VERIFIED/iu);
  assert.match(runner, /--set ON_ERROR_STOP=1/iu);
  assert.doesNotMatch(runner, /supabase\s+db\s+(?:reset|push)|supabase\s+migrations?\s+up/iu);
  assert.doesNotMatch(runner, /FromBase64String|ConvertFrom-Json|sb_secret_/iu);
});

test('Environment audit does not expose secrets and distinguishes key acceptance from presence', () => {
  const audit = read('scripts/Verify-Environment.ps1');
  assert.match(audit, /Get-DatabaseUrlStatus/iu);
  assert.match(audit, /Test-SupabaseKey/iu);
  assert.match(audit, /Authenticity = 'UNVERIFIED'/iu);
  assert.match(audit, /Authentication.*VERIFIED|Authenticity.*VERIFIED/iu);
  assert.doesNotMatch(audit, /Write-Output\s+.*\$Key\b/iu);
  assert.doesNotMatch(audit, /Write-Output\s+.*\$Value\b/iu);
});

test('Playwright E2E performs real staging auth and never treats missing tests as PASS', () => {
  const e2e = read('scripts/staging-commercial-e2e.mjs');
  const identityRoute = read('src/app/api/staging-qa/identity/route.ts');
  assert.match(e2e, /from 'playwright'/iu);
  assert.match(e2e, /api\/staging-qa\/identity/iu);
  assert.match(e2e, /auth\/v1\/user/iu);
  assert.match(e2e, /STAGING_CLIENT_A_PASSWORD/iu);
  assert.match(e2e, /STAGING_CLIENT_B_PASSWORD/iu);
  assert.match(e2e, /DISCOVERY_ADMIN_PASSWORD/iu);
  assert.match(e2e, /cross-client proposal action denied/iu);
  assert.match(e2e, /expired client session/iu);
  assert.match(e2e, /record\(.*'BLOCKED'/su);
  assert.doesNotMatch(e2e, /homepage availability|homepage check/iu);
  assert.match(identityRoute, /tfsdwfykhufmjtyvlgmn/iu);
  assert.match(identityRoute, /NEXT_PUBLIC_SUPABASE_URL/iu);
  assert.match(identityRoute, /await connection\(\)/iu);
  assert.doesNotMatch(identityRoute, /SUPABASE_SERVICE_ROLE_KEY|fetch\(/iu);
});

test('Safepay remains disabled until an official provider contract and verified sandbox credentials exist', () => {
  const providerSource = read('src/lib/payments/provider.ts');
  assert.match(providerSource, /safepay/i);
  assert.match(providerSource, /PaymentProviderUnavailableError/i);
  assert.match(providerSource, /throw new PaymentProviderUnavailableError\(\);/);
  assert.match(providerSource, /never accept an unknown provider name/i);
});
