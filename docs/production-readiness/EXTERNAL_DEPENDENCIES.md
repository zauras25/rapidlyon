# External dependencies and release blockers

| Dependency / decision | Current state | Required owner action |
|---|---|---|
| Authorized Supabase test target | Local Supabase at `127.0.0.1:54322` is unavailable; Docker/Podman unavailable. A separate PostgreSQL 18 Windows service listens on port 5432, but its ownership/authorization for RapidlyOn is unknown and it was not accessed. Remote project was not verified as staging. | Confirm the 5432 database is the authorized isolated RapidlyOn test database, or provide a local Docker-capable environment / confirmed staging project and explicit authorization. Never apply this pass's migrations to production. |
| PostgreSQL migration validation | Supabase local connection at `127.0.0.1:54322` was unavailable. No migration was applied; the 22-assertion pgTAP schema contract has not been run. | Start local Supabase or use authorized staging; lint/apply, then run positive/negative proposal and agreement acceptance, invoice-trigger, and payment-RPC tests. |
| Safepay official contract | Documentation host could not be resolved from this environment; no supplied reference contract found. | Supply current official API/webhook documentation, especially amount units, checkout lifecycle, event types, signature and replay rules. |
| Safepay sandbox | Credentials and test merchant are unavailable. | Provide authorized sandbox credentials and a controlled test account. Keep checkout disabled until independent verification. |
| Email delivery | Resend dispatch exists in source, but no authorized mailbox/provider dispatch was tested. | Supply a test sender, recipient mailbox, API key through the deployment secret manager, and approved retry/reconciliation procedure. |
| Scheduled follow-ups | Endpoint is protected by `CRON_SECRET`; deployment scheduler and secret were not exercised. | Configure a scheduler with a secret of at least 32 characters and verify logs, deduplication, and failed/uncertain sends in staging. |
| Client/admin workflow fixtures | No fixture accounts or authenticated E2E setup available. | Provide distinct client accounts, an admin account, and controlled inquiry/proposal/project/milestone records in staging. |
| Legal approval | Privacy/terms pages are preliminary; draft pack is marked approval-required. | Confirm legal business name, operating jurisdictions, governing law, data retention/contact details, and have counsel approve terms, privacy, services agreement, and cancellation/refund language. |
| Release authorization | Production change authorization was not supplied. | Keep current decision NO-GO; authorize staging validation first and separately approve any production deployment. |

The project has no confirmed database target for integration testing. Do not infer that the running service on port 5432 is project-owned or safe to mutate.
