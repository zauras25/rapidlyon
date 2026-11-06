# RapidlyOn — Discovery Work Definition v1

## Included
- Internal work assessment embedded in Admin → Discovery details
- Work type, multiple services, custom service, assets, scope, deliverables, exclusions, dependencies, acceptance criteria, internal notes
- Append-only version history and reload-as-new-draft
- Admin-only GET/POST API, same-origin validation, Zod validation, rate limiting
- Supabase database table with strict RLS/service-role access

## Installation
1. Back up DB and commit source. Merge 3 source files preserving newer local changes (source baseline is the previously uploaded RapidlyOn ZIP).
2. Apply `supabase/migrations/20261027000600_discovery_work_scopes.sql` in the **same Supabase project as .env.local**.
3. Restart, open `/admin/discovery`, choose submission, scroll to **Define Work & Scope**.
4. Enter title, 1+ services, >=15 characters summary, 1+ deliverable. Save draft. Reload, check version 1. Modify and save: version 2; old version preserved.
5. Test unauthorized GET/POST (401) and same-origin protection on write (403).
6. Run `npx tsc --noEmit`, `npm run lint`, `npm run build`.

## Deliberate limits
- This is an **internal scoping module**, not client-approved scope, proposal or payment workflow.
- Ready for proposal means internal readiness ONLY. No auto project creation, client notifications, or proposals.
- Latest local modifications may differ from uploaded ZIP. Carefully merge, do not blindly overwrite `discovery-admin.tsx`.
- Version allocation uses unique (discovery_id, version); simultaneous writers receive 409 and should reload.
- Migration is additive. It backfills the new readiness flag for records already qualified or scoped so existing workflows remain usable.

## Discovery Clarification & Session Workflow

1. Apply `supabase/migrations/20261105000100_discovery_clarification_workflow.sql` after the existing Discovery and work-scope migrations.
2. Configure `RESEND_API_KEY`, `DISCOVERY_NOTIFICATION_FROM` (or `INQUIRY_REPLY_FROM`), `NEXT_PUBLIC_SITE_URL`, and a `LEAD_LINK_SECRET` of at least 32 characters.
3. Open an active Discovery record. Add questions, offer discussion methods, and send the private client link.
4. The client can answer, confirm a service choice when the original request was unsure, and select a discussion method. The admin plans the session, requests confirmation, records findings, assesses each service, and saves scope readiness.
5. Scope versions and project conversion remain blocked until the saved readiness status is `ready`.

Client response tokens are hashed in storage and expire after 30 days. Clarification/session data is private and accessed through authenticated admin APIs or the scoped response link; no provider delivery or meeting is claimed until the respective provider accepts the request.
