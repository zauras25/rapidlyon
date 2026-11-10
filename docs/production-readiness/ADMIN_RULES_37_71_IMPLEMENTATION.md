# RapidlyOn Admin CMS — Rules 37–71 implementation contract

**Status: IN PROGRESS — NOT PRODUCTION READY.** This branch is a controlled replacement of the legacy Admin UI route, not a rewrite of business data or APIs.

## Approved product contract

- **37–42:** Client 360 as the master account; UX/UI, Next.js and SEO service workstreams; scope-adaptive delivery; controlled quotes in USD/PKR with the 40/30/30 schedule.
- **43–52:** Owner capacity; communication hub; progressive invitation and secure portal; real issued documents; server-verified payments; cancellation/refund/support; portfolio consent; recovery; launch controls.
- **53–63:** Grouped nav; focus-first task screens; authorized client views; shared workflow states; blocking deadlines; profitability and reporting; future least-privilege roles; client-owned assets; organization contacts; purpose-based retention.
- **64–69:** Figma-approved screens and state coverage; shared token-bound master system (Rapid Studio OS) with RapidlyOn brand; paired Admin/Client scenarios; functional prototype validation and documented QA freeze.
- **70–71:** Keep the existing discovery → proposal → agreement → verified payment technical contract; replace only the legacy Admin interface using the approved fresh design direction.

## Implemented in this first source commit

- New `AdminStudio` component: premium grouped navigation, owner sign-in, authorized session check, responsive sidebar, sections, loading/error/empty states, local search, read-only record detail.
- Read paths backed by existing /api/admin endpoints for inquiries, discovery, operations, commercial data, feedback and record history where available.
- Existing commercial workflow component retained for active document operations instead of introducing fake buttons.
- `/admin/[[...segments]]` routes only to `AdminStudio`. No legacy visual fallback.
- **No production migrations or payment/provider claims. No secrets modified.**

## Critical outstanding gates — do not merge or deploy before passing

1. **Repository parity:** GitHub `main` appears older than `rapidlyon-clean(9).zip` from the 2026-11-10 audit. Reconcile the most current source before treating this branch as the definitive implementation.
2. **Session contract:** Current GitHub Admin session route is password-cookie based and differs from the audit's MFA-enforced route. Bring owner authentication to approved MFA policy before production.
3. **Feature completeness:** All 37–71 domain screens require their approved task-based forms, authorization, workflows, Client Portal synchronization and exceptions. Current generic record views are transitional, not complete implementations.
4. **Source mapping:** Validate API collection names with real fixtures and TypeScript. No CI/build was executed by the connector-only edit.
5. **Documents:** Versioned scope, assessment, proposals, agreements, e-sign evidence, invoices/receipts, deliverable notes and handoff with printable original-format snapshots.
6. **Payments:** Official Safepay sandbox tests or explicitly approved owner-verified manual payment workflow. Never credit a redirect or client-entered receipt as payment.
7. **Dispatch:** Separate document issue from delivery; provider-accepted, retries, failed notices, immutable audit evidence.
8. **Security:** Staging 43-migration reconciliation; RLS, grants, organization access, cross-tenant negative tests, backups and restore.
9. **Operational:** Verify Hostinger compatibility, environment, Redis rate limiter, DNS sender, TOTP, monitoring, rollback.
10. **Acceptance:** 3 service scenarios and all audit exceptions, TypeScript, ESLint, Next production build, automated+browser QA, explicit owner signoff.

## Safe cleanup policy

The old `admin-console.tsx` remains present but is no longer used by the Admin route on this branch. Remove it and its now-orphaned components only after action parity and regression checks. Removing it now risks destroying still-required business operations.
