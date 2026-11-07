# RapidlyOn — Approved Public Forms Replacement

## Delivered

- General Inquiry: approved wording, reason choices, optional urgency and WhatsApp branching, Supabase inquiry submission, receipt, and private browser-session handoff to Discovery.
- Discovery: approved five-step adaptive form; working persona, optional age and gender, Design / Development / SEO branching, consent, review, and existing submission endpoint.
- `/discovery` uses the approved Discovery page/form, replacing the old GuidedDiscovery public route. `/contact` offers Inquiry and Discovery forms.
- Selected package IDs are retained from the existing pricing option catalog; invitation tokens are verified before submission and invalid invitations are blocked.
- Responses are persisted within the existing `discovery_submissions.submission` JSON data using `answers['approved.*']` and unchanged columns. No database migration is included.
- Conditionally hidden details (including unselected services and self-described demographic input) are filtered out of the approved answers payload.
- Inquiry permits concise, nonempty questions in the server validation schema (instead of requiring 20 characters).

## Important qualifications

- No live Supabase connection was made, and no remote migration or deployment was performed.
- No production data was accessed or modified.
- Static contract tests: 6 / 6 passed (`node --test scripts/approved-public-forms-contract.test.mjs`).
- TS/TSX syntax parsed successfully using globally available TypeScript transpilation. This is **not** a full typecheck.
- Full `npm ci` could not complete in this execution environment. Consequently `npm run build`, full lint, browser QA, and end-to-end authenticated Supabase tests are **not verified**.
- Direct Inquiry → Discovery prefill is preserved, but inquiry-to-discovery relational linkage is guaranteed only for an existing valid invite token; direct handoff does not fabricate an invite token. Review the desired linkage policy before production deployment.
- Legacy GuidedDiscovery component is retained in source for rollback and compatibility; it is no longer mounted on the public `/discovery` route.
- Production access/privacy notice should be reviewed before launch because optional age and gender are now collected.

## Local verification (PowerShell, RapidlyOn project root)

```powershell
npm ci
node --test scripts/approved-public-forms-contract.test.mjs
npx tsc --noEmit
npm run lint
npm test
npm run build
```

Then browser-test `/contact` and `/discovery` with all three service combinations, pricing package preselect, valid/expired invitation links, and an authorized Supabase staging environment. Run integration tests against staging **only with explicit staging target verification**. Do not apply migrations or push to production automatically.
