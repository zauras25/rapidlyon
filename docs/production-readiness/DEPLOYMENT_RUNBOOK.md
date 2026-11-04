# Deployment and recovery runbook

**Status: operational draft; platform credentials and release approval are not present in the workspace.** No production deployment, database connection, backup, or restore was performed in this pass.

## Pass 3 execution evidence

Against a fresh local production build, `npm test`, the 92-test Node suite, `npm run lint`, `npx tsc --noEmit`, and `npm run build` passed. Component QA reported 46 passed/0 review/0 skipped; visual QA covered 32 routes with zero issues. `/api/health` and six representative routes returned HTTP 200. These are local build/browser checks, not deployment, authenticated workflow, database, payment, email, or recovery verification. See [`TEST_RESULTS.md`](./TEST_RESULTS.md).

## Architecture and environment separation

Target services: Next.js on Vercel, Supabase database/auth/storage, Resend email, and Safepay only after the provider contract and merchant account are verified. No `vercel.json`, Supabase project config, verified scheduler configuration, or monitoring SDK is present in this repository. Do not infer that a production resource is provisioned merely because the application has an endpoint for it.

Maintain separate staging and production resources, credentials, admin users, email recipients, storage buckets, cron secrets, and payment credentials. Never copy production client data or secrets into staging. Keep `.env.local` untracked and out of logs/support bundles.

Use the names in the repository's [`.env.example`](../../.env.example) as the current application configuration inventory:

- Browser-visible configuration: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, and only approved public social/calendar URLs.
- Server-only Supabase credentials: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. The service-role key must never be exposed to browser code.
- Authentication/security secrets: `DISCOVERY_ADMIN_PASSWORD`, `DISCOVERY_SESSION_SECRET`, `LEAD_LINK_SECRET`, `CRON_SECRET`; use unique random secret-manager values per environment. The session, lead-link, and cron secrets require at least 32 characters where their route validates length.
- Email: `RESEND_API_KEY`, verified `DISCOVERY_NOTIFICATION_FROM`, `DISCOVERY_NOTIFICATION_TO`, and optional `INQUIRY_REPLY_FROM`. Use a controlled test recipient in staging.
- Rate limiting: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` when the selected rate-limit configuration requires them.
- Payment: leave `PAYMENT_PROVIDER` unset. Safepay has no implemented adapter or verified sandbox contract; do not activate it by setting an environment variable.

Validate secret presence in the deployment secret manager without printing values. Check the public site URL is the correct environment origin. The production environment must not include staging credentials or test recipient addresses.

## Release gates and deploy

1. Review the current diff and run all checks from the repository root:

   ```powershell
   npm test
   node --test --test-reporter=spec scripts/*.test.mjs
   npm run lint
   npx tsc --noEmit
   npm run build
   ```

2. Obtain explicit release-owner approval and confirm Vercel's target project, deployment environment, custom domains, and environment-variable scope in its dashboard. No deployment command is authorized by this runbook.
3. Configure staging first. Confirm only synthetic/test data and controlled mail recipients are used.
4. After staging migration, browser, authentication, and workflow checks pass, deploy through the approved Vercel workflow and verify deployment logs and representative routes.
5. Keep payment checkout unavailable until official Safepay documentation, credentials, signature verification, currency units, and sandbox transactions have all been verified.

## Database migration procedure

The repository currently has 33 ordered SQL migration files and no `supabase/config.toml`. A `supabase/.temp/linked-project.json` is present, but its project is not confirmed as staging. Local Supabase at port 54322 is unavailable. A separate PostgreSQL 18 Windows service listens on port 5432, but its ownership and authorization for this project are unknown; it was not accessed. Never use a temporary project link or an unconfirmed local database as deployment authorization.

Before any database command that can contact Supabase:

1. Confirm with the release owner in writing that the project reference is a non-production staging database and that applying the listed migrations is authorized.
2. Verify the project identity in the Supabase dashboard and confirm the selected environment; do not rely only on `.env.local` or CLI link state.
3. Confirm the previous backup completed and a restore rehearsal is current. Do not proceed if backup/restore is unknown.
4. Link only the confirmed staging project, inspect the target, and review dry-run output:

   ```powershell
   $StagingProjectRef = Read-Host 'Authorized STAGING project ref'
   npx supabase link --project-ref $StagingProjectRef
   npx supabase migration list --linked
   npx supabase db push --dry-run
   ```

5. If the CLI refuses because repository configuration is absent, stop and have the database owner add/review the project configuration. Do not point the command at a convenient existing project.
6. With a reviewed diff and explicit staging approval, apply only to staging:

   ```powershell
   npx supabase db push
   npx supabase migration list --linked
   ```

7. Record migration versions and output, then run `npx supabase test db` against the local isolated Supabase stack when available. Run the staging-specific acceptance/payment tests only with dedicated fixture accounts and explicit staging confirmation.
8. Do not run these commands against production automatically. Promotion to production requires a separate approval, backup, reviewed migration diff, and rollback/recovery plan.

The billing migrations are additive and currently unapplied. There is no down migration. Prefer a reviewed forward-fix migration; do not manually delete financial or audit data to reverse a release.

## Billing database test

The transaction-scoped, read-only schema privilege/trigger assertions are in [`supabase/tests/20261101_billing_schema_contract.test.sql`](../../supabase/tests/20261101_billing_schema_contract.test.sql). Once an isolated local Supabase test database is available and the migrations are applied:

```powershell
npx supabase test db
```

These schema checks do not replace positive/negative proposal acceptance, agreement acceptance, installment issuance, duplicate-payment, or concurrent-request tests. Those remain blocked until an authorized database and test fixtures are supplied.

## Health, logs, backups, and alerts

- `GET /api/health` is an uncached **web-process liveness** endpoint. It deliberately does not claim that Supabase, Resend, Safepay, or scheduled jobs are healthy.
- Configure an external uptime monitor for the deployment URL and alert on non-2xx responses. No monitor or destination is configured here.
- Review Vercel deployment/runtime logs, Supabase database/auth/storage logs, and Resend message/event logs using their dashboards. Avoid logging tokens, signed URLs, personal project data, or full payment payloads.
- No application error-monitoring provider is configured. Select and approve one before relying on exception alerts; add only sanitized telemetry and document retention/access.
- Use the backup/PITR features actually available on the selected Supabase plan. Confirm schedule, retention, restore point, and accountable operator in the Supabase dashboard. This repository does not establish plan entitlements.
- Before applying migrations, confirm a recent backup or export is complete. A backup is not verified until an isolated restore rehearsal demonstrates that schema and required records can be recovered.
- Maintain a written restore record with timestamp, environment, verified backup identifier, operator, restore target, test outcome, and cleanup authorization. Do not rehearse restore over production.

## Rollback and incident response

1. Stop further deploys/migrations and disable affected scheduled jobs or provider configuration without deleting records.
2. Preserve deployment/database/provider logs and record the time window, affected version, migration versions, and known customer impact.
3. If application-only regression: redeploy the last known-good Vercel build using the approved release workflow.
4. If schema/data integrity is affected: do not run a speculative down migration. Engage the database owner; recover to an isolated target from a verified backup/PITR point or write a reviewed corrective migration.
5. For payment uncertainty, keep checkout disabled and reconcile with authoritative provider records. Never mark an invoice paid from a browser redirect or user report.
6. For email uncertainty, inspect provider event logs and dispatch-attempt state before retrying; the follow-up route intentionally avoids blind resend after uncertain provider acceptance.
7. Document the incident, verification evidence, recovery approval, customer communication, and follow-up tests before reopening release.

## Current infrastructure blockers

- Existing Windows PostgreSQL service on local port 5432 is not identified as this application's authorized test database. Supabase local port 54322 is unavailable; Docker and Podman are unavailable.
- A linked Supabase project reference is present locally but is not confirmed as staging. No remote connections or migration operations were made.
- No fixture accounts, Safepay sandbox, controlled email recipient, verified cron scheduler, monitoring configuration, backup, or restore rehearsal were available.
