# RapidlyOn — Summit-inspired full-site design implementation

**Reference:** https://summitfamilydentalcare.com/vip-program

**Status:** Code-level design implementation and screenshot automation; **not** a completed pixel-perfect visual comparison. This environment could read public website text and a portfolio image, but could not access the live rendered reference CSS, install full Next dependencies, or run the user's authenticated local website. Its proprietary assets, content and brand identity have not been copied.

## Scope and changes

- Basis: latest uploaded RapidlyOn source, with previously issued Rhythm V2 and guest Discovery changes retained.
- Central tokens in `src/app/unified-design-system.css`: blue-green/teal, mint-white canvas, accessible brand/text combinations, restrained hero/page/section type scale, shared spacing/radii/shadows, matching dark mode.
- Reusable layout/geometry contract: `src/app/summit-inspired-system.css` (imported last in `src/app/globals.css`), scoped to public, client and admin; includes dynamic article/service pages that lack `.rp-page`.
- The same component roles govern buttons, card surfaces, inputs, form focus, headers, data tables, navigation, motion and mobile breakpoints.
- No Supabase migrations, API handler behavior, guest Discovery, payment integration, or authentication logic intentionally changed.

### Proposed identity, pending exact reference measurement

| Role | Current project value | Notes |
|---|---|---|
| Deep brand | `#063A40` | token `primitive-forest-900` (compatibility name retained) |
| Primary teal | `#07565E` | main actions and dark hero |
| Hover teal | `#13747B` | secondary primary hue |
| Mint accent | `#B8E9E5` | accent/soft contrast |
| Page | `#F5F9F8` | slightly tinted off-white |
| Muted background | `#E3F4F2` | sections and fields |
| Text | `#163E43` | neutral dark teal |
| Border | `#D0E2E2` | strokes and separators |
| Display type | `clamp(3.05rem, 7.1vw, 5.75rem)` | homepage only |
| Page title | `clamp(2.75rem, 5.3vw, 4.5rem)` | general public pages |
| Section rhythm | `clamp(4.25rem, 7vw, 6.5rem)` | tokens; tighter for nested layouts |
| Typography family | existing Manrope | consistent, **not verified as the reference site's exact font** |

## How to get **real** screenshots from the running website

1. Unpack into a **new directory**, copy your local `.env.local` separately (never upload secrets), run `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`.
2. Start production-like server with `npm run start` on the appropriate port.
3. In another terminal, execute `npm run qa:reference`. It screenshots the actual Summit VIP page at 390 and 1440 widths, and extracts **measured** live typography, colors and geometry into `qa-artifacts/summit-reference/computed-styles.json`. This requires internet access on that machine.
4. Run `npm run qa:full-site`. This captures public, admin and client routes at 390/768/1440 and writes `qa-artifacts/full-site/index.html` plus metrics. Auth redirects are labeled, **not** counted as reviewed admin/client UI.
5. To capture protected screens, use `npm run qa:save-session` for admin, `npm run qa:save-session -- --client` for client, then rerun `npm run qa:full-site`. These sessions use manual login; no password is stored in the source code. The saved `qa-artifacts/sessions/*.json` files contain confidential cookies: never share them or commit them.
6. Dynamic routes requiring real project/invoice IDs must be supplied as comma-separated `QA_EXTRA_ROUTES` e.g. `/admin/operations/projects/REAL_ID,/client/receipts/REAL_ID`; test data only, no placeholders or guessed IDs.
7. Inspect screenshots and the `metrics.json`; complete visual QA requires mobile navigation, authenticated page state, forms, interaction, dark mode, accessibility and content comparison.

### Windows PowerShell example

```powershell
npm run start
# In another PowerShell terminal:
npm run qa:reference
npm run qa:full-site
Start-Process .\qa-artifacts\full-site\index.html
```

**Privacy:** screenshots of admin/client pages can include real customer information. Redact personally identifying details before sharing screenshot collections. Do not upload `.env.local` or session JSON.

## Limitations / outstanding verification

- The current container lacked installed Next.js packages and access to the running local application; therefore no current RapidlyOn **real page screenshots** were collected here.
- The reference's true CSS/color and font metrics have **not yet** been measured. The palette and geometry above are reference-inspired approximations to be calibrated with `qa:reference` outputs, not claims of exact replication.
- 98/98 available CSS/static/release tests passed, but complete lint, TypeScript, 101+ full tests, production build and actual browser screenshots need to run in the user's environment.
- Pre-existing stylesheet cascade includes extensive legacy rules and must still be visually reviewed page by page. New rules are shared and centralized rather than copying individual styles into each page.
