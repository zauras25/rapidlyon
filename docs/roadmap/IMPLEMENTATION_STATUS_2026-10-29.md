# RapidlyOn — Roadmap implementation handoff

**Source:** `rapidlyon-fresh(1).zip` provided 29 October 2026  
**Plan:** `ORIGINAL_IMPLEMENTATION_ROADMAP.txt`, version 1.0  
**Delivery:** Updated full-source ZIP (not a production deployment)

## What was actually implemented in source

| Roadmap | Implemented in this package | Status | Still required before declaring phase complete |
|---|---|---|---|
| Phase 0 — Baseline | Retained original ZIP as backup; archived `src/src` under `docs/legacy-v2/archived-src-src`; enumerated 30 migrations / 50 API routes; added roadmap smoke tests | **Source work done; deployment baseline incomplete** | Confirm DB backup + restore, staging migrations, `npm ci`, lint, TypeScript, Next build and browser sessions |
| Phase 1 — Clarity | Clearer homepage hero, custom-quote language, four engagement paths with deliverables/exclusions, shorter Inquiry and Discovery forms | **Code implemented** | Business owner approves claims/pricing/scope, supplies real case-study screenshots and legal review |
| Phase 2 — Leads | HMAC-signed 48-hour Inquiry → Discovery invite with admin send, private prefill, email-match and one-link-per-inquiry database relation; lead timeline; generated public-safe reference, acknowledgement email attempt, 30-day status links, stable retry keys | **Code and migrations implemented** | Run migrations; verify real Resend delivery/webhooks; test expired/replayed links, user email, statuses, auth and historic records |
| Phase 3 — Activation | Existing scope, proposal, agreement, invite and project lifecycle preserved without destructive edits; unified timeline can show resulting proposals | **Existing, not re-verified** | Full signed-in commercial acceptance and scope-version consistency QA; real approval trails |
| Phase 4 — Delivery/Billing | Added admin due-follow-up action center and authenticated cron reminder digest with unique dispatch attempt table; preserved existing client approvals and billing | **Partial code implementation** | Configure cron/email; verify permissions/receipts; select and implement verified payment solution if needed |
| Phase 5 — Launch | Public Work/homepage/detail now read published data; dynamic project/service/insight metadata; protected route robots rules, referrer protection for signed links | **Partial code implementation** | Real portfolio assets, legal review, consent-aware analytics, accessibility/browser QA, credentials, security audit, monitoring and deployment gates |

**Important:** This is a meaningful source implementation across multiple phases, **not** completion of the roadmap's production acceptance gates. The archive has not been deployed, a real Supabase instance has not been migrated, and no email/payment/browser flow has been verified live.

## Source changes

### Safety + baseline
- `src/src` moved to `docs/legacy-v2/archived-src-src` (no blind deletion).
- The original user ZIP was not modified.
- `docs/roadmap/SOURCE_INVENTORY.md` enumerates API routes/migration files.
- `scripts/roadmap-smoke.test.mjs` exercises signing/verification behavior and source wiring.

### Public UX
- Hero clarifies services and value; starts project review with discovery.
- Four scope options: Design Only, Development Only, Complete Build, Optimization, with out-of-scope disclosures.
- Inquiry now prioritizes question, name, email and service; optional budget/company/timeline collapsed.
- Discovery only asks core details upfront; other business context optional, represented as `Not provided` internally.
- Client request receipt shows business serial + secure public-safe status link, when signing secret exists.

### Lead handling + database
- **Migration 001:** `source_inquiry_id` (FK, unique) on discovery submissions.
- **Migration 002:** unique at-most-once follow-up dispatch attempt records (RLS).
- **Migration 003:** optional unique `submission_key` for inquiries.
- Admin invite calls real configured Resend account; stores status of provider attempt in existing inquiry messages; link itself is intentionally excluded from conversation log.
- Invite signature is scope-specific, expiry-bound and verified with constant-time comparison, configured via `LEAD_LINK_SECRET` or a sufficiently long existing session secret. Linked discovery requires same contact email. Reuse after successful linking fails; same-key retries can retrieve the prior receipt.
- Unified admin timeline reads inquiry, email attempts, related discovery, and proposals connected through project ID.
- Public status returns **only reference, safe state, received date**. No internal notes or client identity are exposed.
- Receipt email is best-effort and provider acceptance does not prove delivery.
- Stable client idempotency keys are retained across form retries.

### Workflow, data and SEO
- Due follow-ups are visible in admin Overview/Operations; Cron `GET /api/cron/follow-ups` requires secret and sends only a studio digest, not unsolicited client messages.
- Cron attempts are unique by record + due time, and `accepted` means accepted by email provider (not delivered). Unknown/failed attempts must be investigated rather than blindly retried; the scheduler is **not** enabled without external configuration.
- Work pages now consume published project storage rather than static-only featured items. If Supabase is configured but unavailable, portfolio returns no projects instead of potentially showing database-unpublished static records. Without Supabase, static published examples remain.
- Dynamic per-slug metadata for services, insights, work; robots disallow `/admin`, `/client`, `/api`, private status routes.

## Configuration and rollout (in order)

1. **Back up** current app, deployed DB, storage and restore instructions; use a separate staging environment. Never test migrations directly on the only production database.
2. Run existing migrations (if missing) **in filename order**, followed by the three `20261029...` migrations, through the normal Supabase CLI/migration pipeline. Confirm all 30 migration files match the deployed history.
3. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, existing admin/session variables and rate limit environment. Configure `RESEND_API_KEY`, verified sender domain (`INQUIRY_REPLY_FROM` or `DISCOVERY_NOTIFICATION_FROM`), `DISCOVERY_NOTIFICATION_TO`, and random **32+ character** `LEAD_LINK_SECRET` / `CRON_SECRET` in server secrets. Do **not** commit `.env.local`.
4. Configure an authenticated cron scheduler to call `GET /api/cron/follow-ups` with `Authorization: Bearer $CRON_SECRET`. For daily 09:00 Asia/Karachi, a UTC schedule is `0 4 * * *`; adjust to business preference and host cron capabilities. Inspect failed/pending dispatches in Supabase; these are not auto-retried.
5. Install/test in an environment with npm registry access:

   ```bash
   npm ci
   npm test
   npm run test:roadmap
   npm run lint
   npx tsc --noEmit
   npm run build
   ```

6. Stage QA: Inquiry submit + serial/status link + receipt; admin reply + signed invitation email; client prefill + linked Discovery; duplicate/expired/tampered tokens; admin timeline and due reminder; scope → proposal → agreement → invite → client workspace; milestones/invoices; published vs draft portfolio; metadata and unauthorized access.
7. Browser-test 390/768/1440 widths with real signed-in admin/client test accounts. Test keyboard, reduced motion, error states and files. Do not deploy until Phase 0 + Phase 5 launch gates pass and rollback is rehearsed.

## Known limitations and business decisions

- **Next.js build/lint/typecheck and browser QA were not runnable in this environment:** npm registry DNS unavailable, dependencies could not be installed. The local source checks are not substitutes for these gates.
- Supabase/Resend credentials, deployed schema, real client/admin accounts and gateway sandbox were not provided. Data migrations, replies, webhooks and signed-in flows **cannot be called validated**.
- Proposal/Agreement/Client billing backend existed in input ZIP; this patch preserves it, but does not claim it passed end-to-end tests.
- **Online payment intentionally remains 503.** Choose a manual verified bank-transfer workflow or a real gateway with verified webhook reconciliations before enabling payment initiation. Do not mark an invoice paid based solely on redirects.
- Public legal copy needs review; client testimonials, portfolio results and case-study metrics need evidence. No fabricated metrics/assets were introduced.
- Consent-aware conversion analytics, a full CRM-style lead dedupe migration, comprehensive retry/reconciliation of inbound email, and comprehensive E2E/accessibility testing are not implemented by this patch.
- Cron source caps one queue scan to the earliest 100 due records per category; high-volume deployments need pagination and a provider-confirmed retry policy before production use.
- Current account security uses existing single-operator admin controls; adding team roles was out of scope under report's "existing-first" rule.

## Verification performed in this handoff

- `node scripts/v4-release-check.mjs` — **PASS:** 20 required paths, 112 TS/TSX files syntax-parsed and 275 internal imports resolved.
- `node --test scripts/roadmap-smoke.test.mjs` — **PASS:** four tests including token expiry/scope/tamper and migration/source wiring.
- A clean `npm ci` attempt was blocked by inability to resolve `registry.npmjs.org`; no claim of successful `npm run build`, live email, authenticated browser QA or production readiness.

## Rollback guidance

The three new migrations are additive; do **not** reverse them destructively on a live database. To revert source, deploy the user's original ZIP, disable the new cron, and keep the new columns/tables until a carefully reviewed cleanup is warranted. Existing data should remain intact. Old code does not provide the new request-status routes, so communicate that temporary limitation if rolling back after sending links.

## Windows follow-up fix (29 October 2026)

After receiving Windows PowerShell failures (`EPERM` against `next-swc.win32-x64-msvc.node`, stale `src/src` directory, and Linux global-TypeScript path), the release package was patched: `scripts/roadmap-smoke.test.mjs` no longer references `/opt/nvm/versions/...`; `scripts/v4-release-check.mjs` uses project-local TypeScript if available and warns when parsing is skipped; and `Windows-Verify.ps1` plus `docs/roadmap/WINDOWS_SETUP_AND_TROUBLESHOOTING.md` provide a fail-fast installation procedure. The ZIP contains no `src/src`. Users must extract into a fresh empty folder and complete `npm ci` before running lint/typecheck/build. On 1 November 2026, the app built successfully on Windows using the existing installed dependencies; a clean `npm ci` was not rerun.

## Engineering update — 1 November 2026

This update records a local source pass only. No production database, email provider, payment provider, or deployment was changed.

### Implemented

- Replaced inconsistent, unapproved public package prices with one shared service-path catalog. Public pricing and Discovery now say custom quote; package selection is explicitly not an offer or commitment. Discovery validates selected package IDs.
- Restricted new commercial proposals and invoices to USD or PKR. Proposal creation and draft edits generate the standard 40% advance / 30% agreed milestone / 30% final schedule using integer minor-unit arithmetic, and ensure the installments sum to the contract total.
- Added migration `20261101000100_require_standard_proposal_payment_schedule.sql`. It prevents proposal acceptance unless the stored schedule is in the supported currency, matches the percentages and amounts, and sums to the accepted proposal total. The accepted snapshot retains those terms.
- Updated the admin proposal form and Windows release preflight tests. Refreshed the release source inventory to 31 migrations.

### Local verification

| Check | Result |
|---|---|
| Focused release/business/billing/roadmap tests | **22 passed, 0 failed** |
| `npm test` | **Pass** — source-contract check only; not the full test suite |
| `npx tsc --noEmit` | **Pass** |
| `npm run build` | **Pass** |
| `npm run lint` | **Pass with 3 existing `<img>` performance warnings** |
| Full `node --test scripts/*.test.mjs` | **77 total: 43 passed, 34 failed** |

The full-suite failures are in legacy design-contract tests expecting removed phase-specific CSS files, old token names, and retired component paths. They are not represented as passing or deleted.

### Remaining launch blockers

- Safepay's official documentation host could not be resolved from this environment, and sandbox credentials were not available. No checkout endpoint or webhook/signature contract was guessed. The provider, client payment endpoint, and webhook reconciliation remain deliberately disabled; online payment still returns 503.
- The new SQL migration is generated but **not applied or verified against staging**. Review outstanding proposals before applying it: proposals without the new valid payment schedule will not be accepted until corrected and reissued.
- Invoice issuance is not yet automatically driven by the three installment triggers. Payment verification, refunds, receipts, and project release still need a complete staged end-to-end implementation and test.
- Live Supabase schema/RLS, Resend delivery, cron scheduling, signed-in admin/client journeys, cross-client isolation, rollback, and monitoring are not verified in staging.
- Business-owner approval of service scope, final prices, legal identity, and legal text is still required. Legal pages remain short general information, not the requested reviewed legal drafts.
- No production deployment was made. Do not treat this local pass as production readiness.
