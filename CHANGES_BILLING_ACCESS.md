# Billing draft access fix — 26 October 2026

## Included change
Client billing now queries an explicit allowlist of shared document states. Draft proposals, draft agreements, draft invoices and unknown future states are excluded server-side. Previously shared historical states remain available. Internal proposal notes and unspecified future columns are excluded through explicit field selection. Invoice line items and payment summaries are limited to invoices visible to the authenticated client. Existing client ownership filters are retained.

Changed files:
- src/app/api/client/commercial/route.ts
- package.json (adds npm test)
- scripts/client-billing-access.test.mjs (new)

No database migration or environment-variable change is required for this fix.

## Verification
- npm test: 7 passing regression tests using the actual handler with mocked external service boundaries.
- Tests against the original vulnerable handler: 4 failures, confirming the suite detects the draft/related-record/projection defects.
- npm run build: passed, including TypeScript and 67/67 generated entries.
- npm run lint: passed after adapting the new test file to the existing ESM lint conventions.

Live Supabase/RLS and browser/end-to-end verification were not performed. Test authorization is mocked; these tests check route-level query scoping rather than independently certifying the authentication helper or live database policies.

## Scope and remaining work
This package fixes audit F01 only. Payments are still unavailable. Automatic viewed tracking, email resend/retry, payment reconciliation and other audit findings remain for subsequent work. No site has been deployed.

## Usage
This ZIP contains the complete source project. Extract into a new directory, configure your existing environment variables, then run:

    npm ci
    npm test
    npm run build

Use your normal deployment process after review. The original uploaded ZIP was preserved. node_modules, .next, generated TypeScript build info and Supabase temporary link state are omitted.
