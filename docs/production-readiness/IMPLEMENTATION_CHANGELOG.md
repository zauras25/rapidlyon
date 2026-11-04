# Production readiness implementation changelog

## Pass 3 — hardening and evidence refresh

- Added `GET /api/health` as a no-store web-process liveness endpoint; it does not report dependency readiness.
- Added mocked Resend coverage for discovery dispatch, configuration and provider failures, idempotent claims, escaped commercial-email content, same-origin links, and missing credentials.
- Corrected browser QA theme initialization to wait for the document root; component QA now checks the current selector routes and reports 46 passed, 0 review, 0 skipped. Visual QA now checks current selectors/tokens and rejects a vacuous zero-consumer result.
- Added assertions to keep those browser-QA contracts under regression coverage.
- Added a 22-assertion pgTAP schema/privilege contract test. It is not executed because no authorized local/staging database is available.
- Added an operational deployment/recovery draft and clarified legal draft assumptions for a Pakistan-based individual sole proprietor. All unresolved identity, tax, jurisdiction, and counsel approval fields remain explicit.
- Fixed the liveness route for the repository's Next.js cache-components configuration by relying on its `Cache-Control: no-store` response header rather than an incompatible route-segment `dynamic` export.
- Fresh validation: `npm test` PASS; Node suite 92/92 PASS; lint, TypeScript, and production build PASS; component QA 46/46 PASS; visual QA 32 routes with zero issues; health and six representative routes returned HTTP 200.
- Pass 3 source/test files: `src/app/api/health/route.ts`, `scripts/admin-runtime.test.mjs`, `scripts/notifications.test.mjs`, `scripts/commercial-email.test.mjs`, `scripts/browser-component-qa.mjs`, `scripts/browser-design-qa.mjs`, `scripts/current-design-contract.mjs`, `scripts/design-qa-primary-isolation.test.mjs`, and `scripts/design-component-browser-qa.test.mjs`.
- Pass 3 additional deliverables: `supabase/tests/20261101_billing_schema_contract.test.sql`, `docs/production-readiness/DEPLOYMENT_RUNBOOK.md`, and `docs/production-readiness/LEGAL_DRAFTS.md`.

## Pass 2 status

Implemented in the current modified workspace. No ZIP was restored and no production database was touched.

### Billing and commercial workflow

- Proposal schedules keep the agreed milestone position in the accepted snapshot and validate the 40/30/30 amounts in minor units.
- Proposal acceptance now requires an active client with a confirmed authentication email.
- Agreement acceptance records the accepting user and timestamp, then issues the 40% advance invoice transactionally.
- Approved/completed milestones issue the 30% invoice at the agreed milestone and the 30% final invoice once every milestone is approved. Final issuance checks the final milestone directly, so an earlier update to that milestone cannot leave the final invoice unissued.
- Invoice uniqueness, immutable issued financial fields, exact installment-total checks, USD/PKR constraints, and service-role-only financial audit writes are included.
- Payment-attempt, failure, and verified-event reconciliation RPCs support idempotency, exact amount/currency matching, and transaction history.
- Admin and client invoice surfaces display installment sequence/stage; checkout remains visibly unavailable until a verified provider is configured.

### Safepay and images

- Checkout and webhook entry points use a provider abstraction that fails closed. No Safepay endpoint, authentication method, or webhook signature was invented.
- The internal contract fixture explicitly records that official contract verification and sandbox credentials are unavailable.
- Replaced the three affected raw image elements with `next/image`.

### Regression coverage

- Rebased stale design assertions that referenced removed CSS/component generations onto the active `src/design-system/tokens.css` and `src/styles/globals.css` contracts.
- Added a reusable live-token, component, accessibility, and layout contract helper.
- Extended the billing regression test to cover the final-milestone ordering edge case.

## Migrations

Created; **none applied**:

1. `supabase/migrations/20261101000100_require_standard_proposal_payment_schedule.sql`
2. `supabase/migrations/20261101000200_automatic_contract_installment_invoices.sql`
3. `supabase/migrations/20261101000300_payment_attempts_and_verified_reconciliation.sql`

The local Supabase CLI is present, but the local Supabase database at `127.0.0.1:54322` is unavailable and Docker/Podman are unavailable. A separate PostgreSQL 18 Windows service on port 5432 is running, but it is not confirmed as an authorized RapidlyOn test database and was not accessed. The configured remote target was not verified as authorized staging. Do not apply these migrations until a safe target is confirmed.

## Outstanding

- PostgreSQL syntax/constraint execution and positive/negative database acceptance tests remain unverified.
- Safepay checkout and signed webhook verification remain disabled pending official documentation and sandbox credentials.
- Authenticated client/admin end-to-end workflows, live email dispatch, scheduled-job execution, and legal approval remain outstanding.
