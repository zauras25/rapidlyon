# RapidlyOn — Unified Type & Spacing System (2026-10-29)

## Purpose

The current project contains multiple historical design layers. This release begins to replace conflicting per-page typography and layout values with **one set of design roles**. It is a practical engineering consolidation, **not** a claim that every screen has completed visual QA.

## Visual language

- **Brand:** existing warm ivory / forest / sage semantic colors; no new palette.
- **Typeface:** existing single Manrope variable (`--font-sans`) for public, client, and admin.
- **Editorial/public:** deliberately expressive display headings, a clear section heading tier, readable body text.
- **Client/admin:** deliberately compact product typography with the same font, colors, focus, geometry and control behavior. "Cohesive" does not mean that a CRM table heading must be the same size as a landing-page hero.

## Canonical roles

All values below are defined in `src/app/unified-design-system.css`.

| Token | Intended usage | Value |
| --- | --- | --- |
| `--component-type-hero-title` | Home page hero only | `clamp(3.05rem, 7.6vw, 6rem)` |
| `--component-type-page-title` | Public route H1 | `clamp(2.75rem, 6.3vw, 4.75rem)` |
| `--component-type-section-title` | `SectionHeading` | `clamp(2rem, 3.75vw, 3.45rem)` |
| `--component-type-lead` | Section intro/description | `clamp(1.0625rem, 1.3vw, 1.1875rem)` |
| `--component-type-app-page-title` | Client/admin H1 | `clamp(1.75rem, 2.5vw, 2.375rem)` |
| `--component-type-app-body` | Dense product body | `0.875rem` |
| `--component-layout-section-gap` | Standard public section | `clamp(4.25rem, 7vw, 7rem)` |
| `--component-layout-section-gap-tight` | Compact section | `clamp(3rem, 5vw, 4.5rem)` |
| `--component-layout-hero-gap` | Route hero | `clamp(4.5rem, 8vw, 7.5rem)` |
| `--component-layout-page-gutter` | Public horizontal gutter | `clamp(1.25rem, 3.5vw, 3.5rem)` |
| `--component-layout-content-max` | Main grid | `82rem` |
| `--component-button-height` | Public action control | `3rem` |
| `--component-input-height` | Public input control | `3rem` |

## Where these are consumed

- `src/components/ui/section-heading.tsx`: shared eyebrow/title/description roles, no conflicting breakpoint-specific utility text sizes.
- `src/app/globals.css`: Tailwind-compatible variable mapping, shared section helpers, dense app heading fallback.
- `src/app/rapidlyon-unified-v3.css`: public page titles and shared heading styling.
- `src/app/rapidlyon-redesign.css`: legacy feature treatments use the common scale rather than a separate hero/title scale.
- `src/app/rapidlyon-premium.css`: sections and page containers mapped to common grid spacing.
- `src/app/studio-os.css`: operational workspace uses the compact type scale and shared button geometry.

## Acceptance checks

**Source checks:** `npm test` includes `scripts/design-rhythm-contract.test.mjs` (five new regression cases). Normal lint and TypeScript/build checks remain mandatory.

**Browser QA:** after `npm run build` and `npm run start` (or `npm run dev`), use `npm run qa:rhythm`. It takes screenshots and records computed font size, line height, section padding, and horizontal overflow for public routes at **390 / 768 / 1440px**, writing to `qa-artifacts/visual-rhythm`. The script also detects unexpectedly large H1 sizes and reports routes without a measurable semantic section separately. Review the screenshots manually; numerical checks alone cannot certify polished visual design.

**Do not release based on unit tests alone.** Validate hero wraps, form labels/field spacing, card rhythm, long text, authenticated client/admin screens, focus, color contrast, and both themes. Online payment gateway remains unavailable, unchanged by this visual patch.

## What this does not yet solve

- All page-local grid/spacing variations and remaining legacy `!important` rules.
- Authenticated admin/client visual screenshot review and interactive design checks.
- Full responsive/manual a11y pass for forms, dialogs, dense tables and mobile navigation.
- Lead pipeline logic and payment integration (not part of a styling refactor).

After visual approval, remove obsolete CSS layers **incrementally with before/after screenshots**, not with blind deletion.

## Desktop display-size calibration (2026-10-29 follow-up)

The first 1440px run showed a 109.44px home hero and 90.72px public route H1s.
These values matched the previous `8vw` and `6.3vw` middle terms and passed the original QA because it only checked HTTP status and horizontal overflow.
The new maximum values are **96px for the home hero** and **76px for public route H1s**.
At 390px and 768px the existing computed sizes remain unchanged.

`/discovery` and `/client/login` intentionally use compact workflow typography.
Their H1 sizes are not required to match marketing page titles, but are independently bounded by the browser QA.
Missing `.ds-section` does not mean spacing is zero: QA now samples semantic `<section>` elements where possible and reports any unmeasured page as **not sampled**. This is a prompt for manual inspection rather than a silent pass.

Browser checks are still restricted to public routes. The authenticated client and admin interfaces require separate browser review.

Note: the late `globals.css` homepage override also now consumes the hero token instead of retaining a separate `7.6vw` clamp. This was the source of the original measured 768/1440 behavior.
