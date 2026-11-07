# RapidlyOn Admin CMS V1 — Greenfield implementation ledger

**Branch:** `feat/admin-cms-lock36-greenfield`  
**Authority:** User-approved 7 November 2026 LOCK 01–36, including revised Decision 01 and reconciled Decision 24.  
**Status:** IN PROGRESS — read-only UI foundation, **not** certified, complete, production-ready or a replacement for `/admin`.

## Current changes

- `src/components/admin-v1/admin-v1.css`: isolated semantic theme tokens, 16px body baseline, 26–36px headings, responsive shell at 1200/768 and reduced-motion support.
- `src/components/admin-v1/admin-workspace.tsx`: independent layout, grouped navigation, existing protected API reads, loading/error/unauthorized/empty states, record filtering, record detail read-only panel, theme toggle and sign-out.
- `src/app/admin-preview/[[...segments]]/page.tsx`: opt-in preview at `/admin-preview`; no changes to `/admin` or validated existing workflows.

## Explicit limitations

1. This is NOT a production-ready system. Important actions are read-only and the preview does not replace the legacy admin console.
2. The preview **does not** implement the required permission-aware server global search; its filter only searches the currently fetched records. Do not describe it as LOCK 35 compliance.
3. The detail panel needs focus-trap/restoration, keyboard audit and responsive visual verification. The sidebar needs a full grouped collapse interaction audit. Do not claim WCAG compliance yet.
4. Existing Owner login + MFA at `/admin/discovery/login` is reused rather than reimplemented. Security E2E evidence is missing.
5. All other screen modules, commercial state-changing workflows, support, notifications, settings, advanced search and file approvals remain unimplemented in the new V1 UI.
6. No migrations, database permissions, live email, payment settings, public website or client portal are changed.
7. GitHub branch creation and file writes are proven; tests, build, screenshots and live API correctness have **not** been executed in this working environment.

## Full locked product route inventory (planned)

- Auth: Owner sign-in and mandatory TOTP, recovery, session expiry
- Workspace: Overview; Operations Inbox; Owner Decision Desk
- Pipeline: Inquiries; Discovery master case; service assessments
- Commercial: Proposals; Agreements; Invoices & Payments
- Delivery: Projects; Milestones; Files & Approvals; Change Requests; Closure
- Relationships: Clients (Client 360); Support
- Governance: Notifications; Unified Audit; Business Settings
- Cross-cutting: global server-authorized search, advanced filters, Ctrl/Cmd+K; responsive states; verified staging E2E

**Future team compatibility** is a required code architecture boundary, **not** a staff management screen in this release.

## Implementation evidence matrix

| LOCK decisions | New UI | Validated acceptance evidence |
| --- | --- | --- |
| 01, 24 — current Owner / future staff-ready | partial navigation only | NOT TESTED |
| 02, 04, 05, 27, 28, 33 — design/accessibility/responsive | partial | NOT TESTED |
| 03, 34 — Owner MFA/session | existing route only; not replaced | NOT TESTED for V1 |
| 06–08 — domains/client/business operations | existing APIs read-only | NOT TESTED for V1 |
| 09–23 — operational/commercial/delivery/support | record lists only for some domains | NOT TESTED for V1 |
| 25, 26, 29–32 — notifications, audit, files, settings, UX states | partial states and audit read list | NOT TESTED |
| 35 — global search | not implemented | NOT TESTED |
| 36 — certified handoff | pending | BLOCKED |

## Required Windows PowerShell QA

Run from the actual project root after checking out this branch:

```powershell
git status --short
git switch feat/admin-cms-lock36-greenfield
npm ci
npx tsc --noEmit
npm run lint
npm run build
npm test
npm run test:roadmap
npm run dev
```

Visit `http://localhost:3000/admin-preview`, authenticate through existing Owner MFA, then check each available preview route. Run desktop/tablet/mobile visual and keyboard tests before cutover.

## Go / no-go

**NO-GO for replacing `/admin` or production deployment.** Leave the original Admin CMS operational until LOCK 01–36 is implemented, covered by regression tests and signed off with explicit evidence. Never assume `HTTP 200` means business-flow verification.
