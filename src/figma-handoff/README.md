# RapidlyOn — Figma foundation handoff / 30 October 2026

## Status
**Ready to START a Figma component library; not yet a pixel-perfect approved Figma master.** Based on the latest Pass 5 source. The live site reads `src/styles/globals.css` which imports `src/design-system/tokens.css`. That CSS is the source of truth used in these exports.

## Known conflict fixed for the handoff
`src/design-tokens.json` is **legacy / not canonical** (Manrope + forest green). The active site uses **Outfit + DM Sans** with charcoal / lime / cream variables. **Use `canonical-live-tokens.json` and the CSV exports, NOT the old JSON.** Existing legacy JSON is retained for compatibility with older scripts.

## Files
- `figma-variables-light.csv`: extracted root variables with aliases and grouping; some formulas/values require manual interpretation in Figma.
- `figma-variables-dark-overrides.csv`: actual CSS dark theme overrides only. Unlisted tokens inherit light values / semantic aliases; do not manufacture values.
- `canonical-live-tokens.json`: machine-readable snapshot (including CSS `var()` strings; NOT directly importable as standards-compliant design tokens without conversion).
- `figma-component-inventory.csv`: initial component and variant blueprint.
- `hardcoded-color-audit.csv`: CSS literals that prevent full token alignment.

## Figma setup (practical)
1. Create pages: `00 Cover`, `01 Foundations`, `02 Components`, `03 Patterns`, `04 Public Pages`, `05 Console`, `06 States & QA`.
2. Create Variable collections: `Primitive`, `Semantic Color` (Light / Dark), `Component`, `Spacing`, `Radius`, `Motion`. Do not make arbitrary visual colors into new semantic roles.
3. Recreate primitive tokens first, then semantic aliases, then component aliases. Color CSV is a specification; Figma native CSV import depends on selected plugin.
4. Define text styles: Outfit headings, DM Sans body, with fluid CSS typography documented as desktop/mobile styles rather than pretending Figma supports CSS `clamp()`.
5. Create Auto Layout components following `figma-component-inventory.csv`. Make component state and viewport variations explicit.
6. Build pages after components and review the 390px / 768px / 1440px Playwright captures against Figma.

## Source-consistency gates
Run `node scripts/check-figma-readiness.mjs` to ensure legacy-vs-live drift is highlighted, token aliases resolve and exported CSV is populated. The check warns on legacy duplicate tokens, which is expected until migrated.

## Still open (must fix before calling it a finished design system)
- Hundreds of literal CSS hex uses remain; audit file identifies common values. Do not bulk replace without contrast and screenshot regression.
- React input/select components and state variants are not fully consolidated.
- Real-browser design parity, font loading, dark mode, forms, console screens, and WCAG contrast must be verified before final sign-off.
- Screenshots of marketing pages are not automatically editable Figma frames; this deliverable is a source-backed handoff specification, not a Figma document.
