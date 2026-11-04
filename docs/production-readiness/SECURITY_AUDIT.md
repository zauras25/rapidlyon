# Security audit — implementation review

## Scope and evidence

This is a repository/source review plus mocked route tests and local unauthenticated browser smoke checks. It is not a penetration test or a live Supabase/RLS verification. Supabase local port 54322 was unavailable; a separate PostgreSQL 18 service on port 5432 is not confirmed as an authorized test target and was not accessed. No remote target was confirmed as staging.

## Controls observed

- **Commercial data:** client APIs scope records to the authenticated client and select explicit response fields. The regression suite checks that drafts/internal notes are not exposed and that another client's records are not returned using mocked responses.
- **Database privileges:** commercial tables are not directly granted to `anon`/`authenticated`; privileged RPCs used for payment/audit work revoke public execution and grant `service_role` only. These grants have not been applied or verified against a database.
- **Agreement acceptance:** the acceptance RPC requires an active client mapped to `auth.uid()`, a confirmed auth email, a sent agreement, and an accepted proposal snapshot. It records acceptance actor/time and triggers advance invoice issuance in the same transaction.
- **Financial integrity:** accepted schedule amounts/currencies are checked; installment issuance is unique by agreement/sequence; issued financial fields are immutable; the deferred check requires all three invoices to equal the accepted total and share currency.
- **Payment reconciliation:** service-role-only RPCs match provider attempt, invoice, amount, and currency and deduplicate provider event IDs. Actual signature verification is unavailable until a real adapter is implemented.
- **Private attachments:** the admin attachment route checks administrator access, validates the path against the submission's stored attachment list, and requests a 300-second signed URL from the private discovery bucket. Public portfolio media is separate and intentionally public.
- **Scheduled email:** the follow-up endpoint requires a configured 32-character minimum `CRON_SECRET`, reserves idempotent dispatch attempts, and reports provider acceptance separately from confirmed delivery.
- **Checkout:** fails closed; no payment is represented as started when a provider is unconfigured.

## Release risks / unverified controls

1. The three billing migrations are not applied, and PostgreSQL has not parsed or executed them in this environment.
2. RLS policies, trigger behavior, acceptance actor binding, financial audit immutability, duplicate issuance, and actual tenant isolation need database tests in staging.
3. Safepay webhook authenticity and provider-side amount units are unverified. Keep checkout disabled.
4. No authenticated client/admin E2E, live email dispatch, or scheduler invocation was performed.
5. Existing `/privacy` and `/terms` pages contain introductory statements, not approved complete legal instruments. Legal and jurisdiction review is required before release.

## Security disposition

No live exploit was demonstrated in this source-only pass. This does **not** establish production security. Treat database and payment controls as unverified until the staged tests listed above pass.

## Pass 3 evidence and limits

- The current automated suite passes 92/92 Node tests; lint, TypeScript, and production build pass. Mocked notification/email tests exercise failure and idempotency behavior, not real provider delivery.
- The fresh-build browser smoke checks cover 32 unauthenticated routes with zero reported page errors or overflow; component QA reports 46/46 checks. They do not authenticate as a client/admin or probe authorization boundaries against Supabase.
- `GET /api/health` only reports web-process liveness and returns `Cache-Control: no-store`; it must not be used as evidence that database, email, payments, or cron are healthy.
- The local Supabase port 54322 is unavailable. A separate PostgreSQL 18 service on 5432 exists but is not confirmed as an authorized test target; it was not connected to. No migration, live RLS test, email dispatch, or payment transaction was performed.
