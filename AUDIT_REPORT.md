# RapidlyOn — Design & Project Audit (6 Nov 2026)

**Method:** static review of all source, CSS, tokens, config and scripts; WCAG contrast computed from the actual token values; project's own static suite run before and after (`node --test scripts/*.test.mjs`: baseline 65/73 pass → after fixes 65/73 pass, **0 new failures**).
**Not possible here:** `npm install`/build/lint/Playwright (no network). Run the Checks in README before shipping — visual changes below are unverified in a browser.

## Fixed

### Accessibility / contrast (WCAG 2.2 AA)
| Item | Before | After |
|---|---|---|
| Muted body text on cream | 4.40:1 (fail) | 5.9:1 |
| Brand green text (eyebrows, links) | 3.69:1 (fail) | 5.5:1 |
| White text on brand-green buttons | 3.87:1 (fail) | 5.8:1 |
| Focus ring on light bg | 2.16:1 (fail, needs 3:1) | 5.5:1 (dark mode: lime, 11.5:1) |
| Danger / warning text | 4.41 / 4.21 (fail) | 5.7 / 5.6 |
| Hero card small text (#7d8977) | 3.30 (fail) | ≥5 |
| `.brand-on` (#7db62b), 404 headline accent (#7eaf28) | ~2.3 (fail) | brand token |
- Mobile menu button now a 44×44px target (was ~41px).
- Redundant `aria-label`s on Login/Register removed; labels now match visible text ("Log in" / "Sign up", matching the `/client/sign-up` route).
- Form errors announce with `role="alert"`; required `*` hidden from screen readers (inputs already `required`); `autocomplete` added for name, email, organization, URL, country (WCAG 1.3.5).

### Design system
- Heading scale was oversized on small screens (H1 min 3.55rem ≈ 57px; H2 2.7rem; H3 2rem) → fluid `2.6→6rem`, `2.1→4.2rem`, `1.65→2.8rem`.
- Fonts moved from a render-blocking Google `@import` in CSS to `next/font` (self-hosted, no layout shift, no runtime third-party request). Token font stacks keep system fallbacks.
- Removed `src/design-tokens.json`, a stale second token set (Manrope + forest green) that contradicted the live system (Outfit + lime/charcoal). `tokens.css` is now the only source; `figma-handoff/` snapshot and CSVs regenerated to match (86 tokens, 0 drift).

### UX / SEO / correctness
- Header no longer remounts on every navigation (`key={pathname}` replayed the logo animation and reset state); mobile menu closes on route change via derived state.
- Footer year was hard-coded `2026` → computed.
- Added `viewport` (themeColor, colorScheme), Open Graph/Twitter defaults, homepage canonical. Twitter card downgraded `summary_large_image`→`summary` because no OG image exists (a large card with no image renders blank).
- Layout deliberately does **not** set a global canonical (it would be inherited by every page).

### Project hygiene
- Deleted a full nested duplicate project inside `src/` (package.json, scripts, docs, supabase migrations (8 of 36, stale), public, figma-handoff, configs, README describing files that don't exist, 5 `DESIGN_REVIEW_*` notes) — it was being type-checked via `tsconfig` globs and could be edited by mistake.
- Deleted `globals.css…bak`, `route.ts.bak-…`, committed `tsconfig.tsbuildinfo`, and two superseded staging-gate scripts (kept `…-V3.ps1`).
- `.env.example`: real Supabase project URL replaced with a placeholder; `.gitignore` now keeps `.env.*.example` templates and ignores `*.bak`.
- Added a real `README.md`.

## Not fixed — needs your decision or a browser
1. **Build/lint/visual QA unrun.** Run `npm i && npx tsc --noEmit && npm run lint && npm run build && npm run qa:visual`. Heading-size and brand-green changes will shift the look slightly; review the hero.
2. **`globals.css` is 95 KB / 1,437 lines of minified-style rules** with later override layers, 11 `!important`s and many hard-coded hex values bypassing tokens (e.g. `#81a83e` 2.8:1, `#92846a` 3.7:1 remain). I fixed only the values I measured. Consolidating needs screenshot regression; I didn't do it blind.
3. **Dark theme is defined but never activated** (nothing sets `data-theme`). Either ship a toggle or delete the dead tokens.
4. **Footer LinkedIn falls back to a personal profile** labelled "RapidlyOn on LinkedIn". Set `NEXT_PUBLIC_LINKEDIN_URL` to a studio page or remove the fallback.
5. **No OG image** — add one, then restore `summary_large_image`.
6. **8 pre-existing failing tests** (admin-runtime, business-release, client-billing-access, notifications, staging-integration, commercial-email, two admin-workflow tests) — unchanged by this work; likely stale expectations or missing staging env.
7. `supabase/.temp/` (linked project refs) ships in the archive; it's gitignored — don't commit it. It is excluded from the fixed zip.
8. No CSP header in `next.config.ts` (other security headers are good).
