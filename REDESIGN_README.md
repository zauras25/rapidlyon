# Rapidlyon 12-route redesign package

Updated routes: `/`, `/work`, `/services`, `/pricing`, `/faq`, `/contact`, `/admin/operations`, `/admin/discovery`, `/admin/projects`, `/admin/billing`, `/admin/reviews`, `/client/login`.

## Changes
- Dedicated page-scoped visual treatments for six public pages, including hero, spacing, cards, forms, accordions, and pricing surfaces.
- New reusable `StudioAdminFrame` (dark responsive sidebar, active states, admin topbar, accessible mobile menu) on four admin sections.
- Existing operations Studio OS dashboard preserved, with shared visual styling.
- Client login redesigned using the shared visual layer, without changing auth flow.
- Marketing header/footer hidden for authenticated admin pages; login pages retain their existing behavior.
- No API, database schema, payment, or authentication logic intentionally modified.

## Install
Back up your project. Replace project files with this package, but preserve your own `.env.local` and other secrets. Run `npm install`, `npm run build`, `npm run dev`. Test all routes while signed in, including billing and discovery workflows. Hard refresh browser after restarting Next.js.

## Validation
This package was generated from the supplied source. No complete Next.js production build or browser screenshot regression test was run in this environment. Do not deploy to production before testing authenticated flows, payments, and responsive layouts.
