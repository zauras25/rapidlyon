# RapidlyOn Phase 7 browser QA — evidence-based findings

Input: uploaded `summary.csv` (42 screen×viewport observations) and original uploaded project ZIP.

- 42 observations: **21 PASS, 21 REVIEW**. All 42 have zero reported horizontal overflow. This is not full UI/functional acceptance.
- Failed API observations: `/api/admin/pipeline-counts` **16×502**, `/api/admin/inquiries` **3×502**, `/api/admin/support` **3×503**. These are repeated observations across viewports, not necessarily different defects.
- Source inspection: `/api/admin/pipeline-counts/route.ts` and `/api/admin/inquiries/route.ts` always supply `Authorization: Bearer <service key>`, while `src/lib/supabase-server.ts` defines `supabaseServerHeaders()` that adds Bearer only for legacy service-role JWT keys; modern `sb_secret_` keys use the `apikey` header alone. The discrepancy is real, but we cannot confirm it caused 502 without authenticated server-side logs and knowing the credential *type* (not the secret).
- `/api/admin/pipeline-counts` also returns 502 when the upstream count request fails or its `content-range` count header is missing. The route logs an error on the server. A timeout or absent table/query may also cause the error.
- `/api/admin/inquiries` returns 502 on an upstream Supabase failure; potentially missing columns or RLS/permissions, network, schema mismatch. Confirm via sanitized server-side log or safe HTTP status diagnostics.
- `/api/admin/support` catches all database errors as 503 with an explicit migration hint. The support migration's stage/production deployment was previously unverified. Do not assume access or deploy to production as an automatic fix.

## Patch
`Apply-Phase8-API-Headers.ps1` updates only two admin GET routes to use the project's existing `supabaseServerHeaders()` helper. It backs up originals to `qa-results`, verifies exact old source text before edits, does not touch `.env`, migrations, auth or payments, and does not make database queries. If the local files differ, it stops.

## Verification sequence
1. Apply guarded patch.
2. `npx tsc --noEmit`, `npm run lint`, `npm run build` and confirm they pass.
3. Restart dev server to reload changes, rerun Phase 7 live browser scan while signed in.
4. If 502 remains, capture **sanitized** dev-server log lines `Admin pipeline counts failed` and the response status only. Do not share Supabase keys, request authorization headers, cookies, personal records or env files.
5. Validate support migration state **on staging only** after staging access is resolved, with explicit authorization.
