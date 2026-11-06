# RapidlyOn — Discovery V10 integration audit

## Reviewed
- Uploaded RapidlyOn source archive: Next.js 16.4.2, React 19, Supabase schema and admin routes.
- `rapidlyon_guided_discovery_v10(1).html`: browser-only prototype with 5-step workflow and 3 service question groups.

## Verified findings from source
1. The existing `/discovery` page still used the older `DiscoveryForm`. V10 had only local-storage preview and exported JSON; it did not submit requests.
2. The existing `/api/discovery` server requires a strict multipart `submission` JSON contract with idempotency, service enums, required structured fields, consent and optional invitation token. Copying V10 HTML directly would fail this contract.
3. Existing admin `/admin/discovery` already has persisted submissions, service reviews, clarification invitations, answer tracking, follow-up methods, readiness decision and history. Reuse these records; do not create a duplicate pipeline.
4. Existing admin question bank already contains UX / design, Next.js development and SEO suggestions, with one custom question box and close/reopen actions. However the default method `chat` was not part of the accepted backend enum (`whatsapp` instead).
5. Existing public and admin both render the shared `Brand` component, but admin sidebar CSS uses different mark geometry and inverted wordmark. The bundled `public/brand/rapidlyon-wordmark.svg` is the active wordmark; the `rapidlyon-original.svg` is a CorelDRAW-exported file with an oversized page-like viewBox, and is not a drop-in UI asset.
6. Existing workflow lets admins append and close questions; this is not unrestricted deletion of sent/audited client questions. Keeping an audit history is safer than destructive deletion.

## Implemented in this copy
- `/discovery` now uses React implementation of V10 5-step guided questionnaire, including 3 service groups, multi-select, review, draft storage, optional recommendation, timing/budget and direct submission to existing API.
- Existing secure endpoint and server validation are reused. V10-specific answers use `answers` keys prefixed `gd` where necessary; admin original-brief display already renders the answer map.
- Existing invitation token lookup and optional package preselection retained in guided flow.
- Admin clarification editor now supports adding, editing and removing multiple custom draft questions; selected suggestions are optional. Existing question history and closure mechanics retained.
- Corrected default clarification method from invalid `chat` to `whatsapp`.
- Aligned sidebar logo geometry with shared public branding component.

## Open before production
- Full TypeScript, ESLint and Next build were not confirmed because dependency installation did not complete during this review. Run `npm ci`, `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` in a clean local environment.
- Verify live Supabase migrations through **staging**, especially `20261105000100_discovery_clarification_workflow.sql`; do not apply unverified migrations to production.
- E2E test discovery submission, invitation prefill, admin receipt, admin question send, client response, subsequent follow-up, readiness, and accessibility.
- Existing admin layout/design beyond branding was not fully redesigned; visual parity needs actual browser screenshot comparison and design references.
- V10's general inquiry tab was not moved into discovery because the website already has a separate `/contact` inquiry flow.
- V10 budget values use USD display guidance; pricing and quote currency must be decided by the admin, not interpreted as commitments.
- No external emails, payments, database migrations or production mutations were executed.
