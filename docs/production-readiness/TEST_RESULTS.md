# Production readiness test results

Results below were executed in this workspace against the current modified source and a fresh local production build. Source tests and mocked browser checks are not live database, provider, or authenticated end-to-end evidence.

| Check | Result | Evidence / limits |
|---|---|---|
| `npm test` | PASS | V4 source contracts: 20 essential paths, 123 TypeScript files syntax-checked, 289 local imports resolved. The command explicitly does not authenticate users or verify Supabase/payment services. |
| `node --test --test-reporter=spec scripts/*.test.mjs` | PASS, 92 passed, 0 failed, 0 skipped | Complete current Node regression suite, including billing contracts, notifications, commercial email, admin runtime, and roadmap checks. |
| `npm run lint` | PASS | ESLint completed with no warnings or errors. |
| `npx tsc --noEmit` | PASS | No TypeScript diagnostics after the production build generated current Next route types. |
| `npm run build` | PASS | Fresh Next.js 16.4.2 production build; generated 56 static pages and compiled `/api/health`. |
| `npm run qa:components` | PASS, 46 passed, 0 review, 0 skipped | Against the fresh local production server on port 3100. Unauthenticated component/token smoke test. |
| `npm run qa:visual` | PASS, 32 routes, 0 issues | Against the fresh local production server. Zero page errors and overflow reports. Semantic-token checks ran on 3 routes, with 6 total consumers; all changed as expected across themes. |
| Health and route smoke | PASS | `GET /api/health` returned `{"status":"ok",...}`; `/`, `/services`, `/pricing`, `/contact`, `/client/login`, and `/admin/discovery/login` each returned HTTP 200. This is web-process liveness only. |
| Billing access tests | PASS (mocked) | Suite covers unauthenticated access, hidden drafts, explicit field selection, and cross-client row isolation using mocked API responses; this is not live RLS validation. |
| Supabase migration lint / DB acceptance tests | BLOCKED | Supabase local port `127.0.0.1:54322` is unavailable; Docker/Podman are unavailable. A separate PostgreSQL 18 Windows service listens on port 5432, but it is not confirmed as an authorized RapidlyOn test database and was not accessed. No migration was applied. |
| Billing pgTAP contract | NOT RUN | Added a 22-assertion schema/privilege test at `supabase/tests/20261101_billing_schema_contract.test.sql`; no authorized isolated test database is available. |
| Client/admin Playwright E2E | NOT RUN | No fixture accounts or authenticated E2E setup were available. Route smoke and component QA do not substitute for journey testing. |
| Payment integration | NOT RUN | Safepay contract and sandbox credentials are unavailable; checkout is intentionally disabled. |
| Email delivery / scheduled job | NOT RUN | Resend behavior has mocked tests, but no controlled test mailbox or authorized scheduler invocation was available. |

The complete workflow from inquiry through handover, positive/negative database acceptance cases, payment reconciliation against a provider, cross-client testing against real RLS, and admin actions using fixture accounts still require an authorized test environment.
