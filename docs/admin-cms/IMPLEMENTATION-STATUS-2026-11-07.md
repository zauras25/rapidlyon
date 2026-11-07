# RapidlyOn Admin CMS: source audit and implementation status

Date: 2026-11-07. This package is an **incremental implementation**, not a claim that all locked decisions have been completely developed or independently QA-approved.

## What the original ZIP already contained

- Next.js 16.4.2, React 19, TypeScript, preexisting RapidlyOn color/type/spacing tokens and admin components.
- Real admin APIs for inquiries, discovery, client project operations, milestone transitions, commercial proposals/agreements/invoices, payment reconciliation, record events, and follow-ups.
- Supabase migrations including commercial schedule guards and discovery clarification workflow.
- Existing project `/admin/projects` was the public **portfolio editor**, not the client **delivery project** workspace. The route was renamed to `/admin/portfolio` (legacy category paths preserved), and `/admin/projects` now renders delivery records.
- Login was a shared password-only session; it did not meet locked mandatory MFA requirements. No independent permission system for future team existed.
- Archive and current enums in the original system differ from some approved decision names; they cannot be relabeled safely without a staged schema/API migration.

## Changes in this updated ZIP

| Capability | Implementation | Status |
|---|---|---|
| Existing design system | Retained `globals.css` and existing UI primitives; additive token-based admin styles | Extended, visual QA pending |
| Adaptive Admin app shell | Grouped new navigation, desktop collapse, mobile drawer from existing UI, top-bar search link, Ctrl/Cmd+K navigation | Implemented baseline |
| Delivery projects | `/admin/projects` now reads real operations, project detail/milestones, guarded server-backed milestone transitions, deliverables and change-request summaries | Implemented baseline; end-to-end staging QA needed |
| Public portfolio | Kept under `/admin/portfolio` and legacy `/admin/projects/[discipline]` | Preserved |
| Operations Inbox | Five views backed by existing `operations`/`action-center` APIs | Implemented baseline; task rules/coverage need expansion |
| Client 360° | Live clients, linked projects/proposals/agreements/invoices, client relationship notes | Implemented baseline; note migration required |
| Support tickets | Authenticated create/triage/update, state-transition guards, close resolution, event history trigger | Implemented baseline; support migration required; paid support authorization is still external |
| Finance analytics | Currency separated invoice/payment register with explicit limitations | Partial; exact accounting and reporting need reconciliation and more KPIs |
| Audit log | Existing record-events API surfaced in dedicated read-only workspace | Partial; needs actor/rationale/evidence upgrades |
| Global search | Cross-module client-side search of authorized admin API results and keyboard route | Partial; no indexed server search, pinned records or command actions |
| Files & approvals | Operational deliverable review summary links to project operations | Partial; no full central versioned storage/catalog UI |
| Business settings | Live server-backed safe non-secret preferences; fixed payment rule untouched | Implemented baseline; settings migration required |
| Admin auth | Mandatory 2-stage password + authenticator TOTP challenge and MFA-marked signed sessions | Implemented baseline; owner enrollment and staging test mandatory |
| Commercial workflow | Existing proposal/agreement/invoice code retained | **Not** independently verified against all Decisions 15–18 |
| Decision-specific assessment/approval flows | Existing code retained | **Not** complete for all requested future states |
| Team roles/RLS | Owner first; new tables deny anon/authenticated | Future multiuser RBAC **not implemented** |
| WCAG 2.2 AA / responsive/dark QA | Existing design-system patterns and responsive rules retained | **Not independently tested** |

## Important security observations

1. The original admin login used a shared password; MFA is now required for **new sessions**. A missing or invalid `DISCOVERY_ADMIN_TOTP_SECRET` blocks new admin login. This requires manual owner enrollment with an authenticator app and secure deployment configuration. Do not commit the TOTP seed, Supabase service key, or provider secrets.
2. The new admin session token contains a signed `mfa-` marker; pre-upgrade session tokens are rejected by the new verifier. The existing signed-cookie approach is still not a full identity-provider-backed Supabase Auth/RBAC solution; durable revocation, MFA account recovery and device management remain follow-up work.
3. New support/notes/settings tables are additive and intentionally **deny `anon` and `authenticated` roles**. Only server routes using the authorized service role can access them. Future team access needs a reviewed per-user authorization layer and a staging RLS audit.
4. Do not auto-apply SQL to production. No live migrations or Safepay actions were performed in preparing this ZIP. Supabase CLI `.temp` linked-project metadata was excluded from the output package deliberately to prevent accidental commands targeting the wrong project.
5. The saved source included no usable `node_modules` contents; `npm ci` was attempted but could not complete in this isolated environment. Full Next.js `tsc`, build, lint, browser visual QA and database integration tests are **NOT VERIFIED**.

## Safe Windows PowerShell verification (after backup)

```powershell
# In the extracted project root; before doing any database work:
npm ci
node --test scripts/admin-locked-decisions.test.mjs
npx tsc --noEmit
npm run lint
npm run build
npm test
# Optional: only against separately approved STAGING target
npx supabase migration list
npx supabase db push --dry-run
```

Verify which Supabase project is linked. Do not run `supabase db push` against production without a separate explicit review and authorization. Apply the new additive migration only to **staging** first, then test ticket creation/closure, notes, settings and RLS isolation. Configure `DISCOVERY_ADMIN_TOTP_SECRET` securely and enroll it into the owner's authenticator app before login. Test real role-gated routes and server-side payment reconciliation in staging.

## Remaining decision gaps before honest “all 36 complete” signoff

- Complete Inquiry statuses and case transition mapping (Decision 10); full structured Assessment/Decision Desk/client-action flow with all gates (Decisions 11–15).
- Versioned proposal-to-agreement-to-payment acceptance checks and complete safeguards (16–18) across end-to-end scenarios; remain partially present in original code.
- Unified controlled Change Order pricing/approval and final handoff checklist (20–21); separate Support ticket baseline is now present (22).
- Future team RBAC and independent authorized accounts (24), scheduled notification delivery/preferences (25), actor-attributed audit (26).
- Full document file versioning and exact-version approvals (29), comprehensive business reporting (31), all error/recovery states and operational QA (32).
- WCAG 2.2 AA / dark-mode / responsive screen-by-screen evidence (33); recoverable MFA account lifecycle (34); indexed global search + command palette (35); test and developer handoff evidence (36).

This report intentionally distinguishes **source code added**, **existing code retained**, **unverified integrations**, and **features not yet implemented**. Do not represent the updated archive as fully launch-ready.
