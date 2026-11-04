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
- Migration is additive. No existing discovery records altered.
