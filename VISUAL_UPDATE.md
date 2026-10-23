# Rapidlyon Visual Update — Pass 01

## Scope

This pass focuses on the public visual foundation and brand integration without changing Supabase, API, authentication, or business logic.

## Updated

- Replaced the text-only public header brand with the supplied Rapidlyon vector wordmark.
- Added focused vector brand assets:
  - `public/brand/rapidlyon-wordmark.svg` — public/marketing use.
  - `public/brand/rapidlyon-mark.svg` — compact/internal use.
  - `public/brand/rapidlyon-master.svg` — supplied master artwork preserved as source.
- Strengthened the homepage hero hierarchy, spacing, visual signal panel, and CTA grouping.
- Added reusable section-spacing and visual hierarchy utilities to the design system.
- Refined the selected-work presentation with stronger framing and depth while keeping the existing evidence language.
- Added compact mark branding to the client workspace and admin operations surface.
- Preserved existing routes, data structures, Supabase/API flows, and business logic.

## Validation

A full `npm run lint` / `npm run build` could not be completed in this environment because the dependency installation did not finish and the local `node_modules` tree has no usable `eslint`, `next`, or TypeScript binaries. No application logic was intentionally changed in this pass.

## Pass 02 — Site-wide public visual system

- Added a reusable `PageHero` composition so public pages share one mature hierarchy instead of bespoke hero implementations.
- Applied the new page hierarchy to About, Process, Pricing, Insights, FAQ, Contact, Services, Work, service detail, and insight detail surfaces.
- Added consistent page-level spacing and subtle ambient brand treatment through the shared visual system.
- Strengthened Work project cards with featured signaling and interactive depth while preserving project evidence language.
- Improved Insights index cards with consistent interactive elevation.
- Preserved all existing application/data/API/Supabase behavior; changes are presentation-layer only.

## Validation note

The container could not complete `npm ci` within the available execution window, so the local Next.js/TypeScript binaries were not available for a full build/lint run. Changes were kept scoped to TSX presentation components and CSS, and no API/database/auth code was modified.


## Pass 03 — Responsive, case-study, and visual-system consolidation

- Refined mobile-first spacing and page-title sizing through shared CSS tokens/utilities.
- Improved mobile navigation surface treatment and responsive header spacing without changing navigation logic.
- Added the supplied Rapidlyon wordmark to the public footer so the brand is carried consistently beyond the header.
- Refined case-study hero hierarchy, section rhythm, media framing, horizontal section navigation, and final CTA treatment for smaller viewports.
- Replaced several repeated arbitrary visual values with existing design-system tokens/classes across homepage, portfolio, pricing, client workspace, admin project surfaces, and shared labels.
- Preserved routes, Supabase/API/auth flows, data structures, and interaction logic.

## Validation note

- Source-level visual consolidation completed from Pass 02. Full Next.js/TypeScript runtime validation remains dependent on a complete dependency installation in an environment where the package binaries are available.

## Pass 04 — responsive and interaction QA layer

Built on Pass 03. This pass is limited to presentation-layer hardening and does not alter Supabase, API routes, authentication, database schemas, or business workflow logic.

### Changes

- Refined small-screen page and case-study title scaling to prevent oversized typography from dominating narrow viewports.
- Tightened mobile case-study section spacing and reduced media/CTA corner radii for better viewport fit.
- Reduced mobile hero vertical padding while preserving desktop composition.
- Disabled hover lift/underline effects on touch-only devices so mobile interactions do not leave misleading hover states.
- Added a high-contrast preference layer for dividers and form controls.
- Consolidated reduced-motion handling into one global accessibility rule.
- Improved admin navigation on narrow screens with horizontal scrolling instead of awkward wrapping/crowding.
- Tightened client workspace header sizing and long-name behavior on narrow screens.
- Reused the shared primary button treatment for global error and 404 recovery actions.
- Confirmed there are no remaining arbitrary radius/text/letter-spacing/line-height utility values in TSX/TS source matching the targeted hardcoded visual patterns.

### Validation note

The checked-out archive does not contain runnable `eslint`/`next` binaries in `node_modules`, so a local lint/build could not be certified in this environment. No claim of a passing build is made here.

## Pass 05 — visual consistency and contrast correction

Built on Pass 04. This pass targets a site-wide visual regression identified during page-by-page inspection: multiple light-surface cards, forms, content panels, legal pages, service/process sections, work CTAs, and review surfaces were using the `bg-on-dark` token while retaining dark `text-ink`/body text. Because `--color-on-dark` is white, that combination flattened contrast and made several surfaces read as blank/washed-out UI.

### Changes

- Replaced non-alpha `bg-on-dark` usages with the semantic light `bg-surface` token across public pages, forms, client surfaces, admin surfaces, pricing, reviews, and legal/error states.
- Preserved intentional translucent dark overlays such as `bg-on-dark/5`, `bg-on-dark/10`, and `bg-on-dark/95` where they are used over dark compositions.
- Kept all dark hero/brand compositions on their existing `bg-ink`/`bg-navy` surfaces; this pass does not flatten intentional dark sections.
- Standardized the visual meaning of `on-dark`: it remains a foreground/text token for dark surfaces, while `surface` is used for light cards and panels.
- No API, Supabase, authentication, database, routing, or business workflow code was changed.

### Validation note

The checked-out archive still does not expose runnable `next`, `eslint`, or `tsc` binaries in `node_modules`, so a full build/lint certification is not claimed. The pass was verified at source level, including a scan confirming there are no remaining non-alpha `bg-on-dark` background usages.

## Pass 07 — Final rendered-safety polish

- Added a global horizontal overflow guard so decorative glows and wide visual treatments cannot create accidental mobile page scrolling.
- Added balanced heading wrapping to improve editorial hierarchy at intermediate breakpoints.
- Removed default tap-highlight flash from links and buttons for cleaner touch interaction.
- Re-checked the source for intentional horizontal scrolling: admin tables and case-study navigation remain explicitly scrollable where required.
- Re-checked remaining `bg-on-dark` usages: only intentional dark overlays/translucent surfaces remain.
- Attempted runtime validation, but the supplied dependency snapshot is incomplete: the `next` package executable and `.bin` shims are absent, so a real browser-rendered build could not be started from this archive.

## Pass 08 — Runtime/asset preflight

- Corrected the intrinsic SVG dimensions for the Rapidlyon wordmark and compact mark so browser image layout uses the same aspect ratio as the SVG viewBox.
- Updated the Next/Image intrinsic dimensions in the public header and footer to match the corrected wordmark geometry.
- Render-preflighted both brand assets from their SVG sources to confirm they rasterize cleanly after the dimension correction.
- Preserved existing routes, application logic, Supabase integration, API routes, and internal workflows.

### Validation note

A full Next.js browser runtime could not be started from this snapshot because the supplied `node_modules` tree does not contain the Next/ESLint executables and `npm ci` did not complete within the available execution window. This pass therefore does not claim a live-browser pass; the asset rendering and source-level preflight were completed instead.
