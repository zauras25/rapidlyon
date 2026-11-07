# RapidlyOn public form UX refinement — 2026-11-07

## Changes
- Expanded `/contact` from narrow split-column form to a full-width stacked layout (keeps intro and the two approved form choices).
- Expanded `/discovery` into a full-width form workspace rather than a narrow right column.
- Improved approved Inquiry and Discovery typography, field and helper text, responsive form grid spacing, minimum action and radio/checkbox touch dimensions, and narrow mobile padding.
- Discovery profile Time zone now explicitly drives auto-selected Country for the curated, country-labelled options: Pakistan, United Arab Emirates, United Kingdom, United States.
- Country is displayed read-only for those options. `Other / Confirm later` allows country entry because a timezone alone does not uniquely identify a country globally.
- Added Preferred city dropdown for each supported timezone, with optional Other city field; Other / Confirm later supports entering a city. City is optional and does not block discovery.
- Country continues to populate the existing API's `country` property; city is saved in existing JSONB `answers` as `approved.preferredCity`, with backward-compatible profile answer keys. No database migrations.

## Verification
- `node scripts/v4-release-check.mjs`: PASS (20 essential paths, 128 TS files syntax checked, 307 local imports resolved).
- `tsc --noEmit`: unable to complete because node_modules type dependencies are incomplete (`estree`, `react`, `node`, etc. missing). Run `npm ci` on your development machine then typecheck and build.
- Browser viewport QA: not run; Playwright browser dependencies are unavailable in this container. Verify at 360, 390, 768, 1024 and 1440 px before production release.
- Supabase: no remote writes or schema updates; database functionality remains unverified.
