# RapidlyOn — Typography QA follow-up (29 October 2026)

## Evidence from the local QA output

The previous `npm run qa:rhythm` run returned HTTP 200 for all nine tested public routes at 390, 768, and 1440 px, with no reported horizontal overflow. The script did not yet treat oversized headings as errors. Desktop typography was therefore not visually approved.

- Homepage at 1440: **109.44px**; standard public route H1: **90.72px**.
- The initial QA script sampled only `.ds-section`; pages without that class displayed `sectionTop: undefined`, which is an unmeasured section rather than evidence of zero spacing.

## Changes

- Set the maximum home hero type size to **96px** (`--component-type-hero-title: clamp(3.05rem, 7.6vw, 6rem)`).
- Set public page H1 maximum to **76px** (`--component-type-page-title: clamp(2.75rem, 6.3vw, 4.75rem)`).
- Connect the old late homepage `globals.css` override to the shared token, removing one competing hardcoded clamp.
- Extend QA with route-specific heading guardrails and alternate semantic section sampling.
- Add `qa-artifacts/visual-rhythm/assessment.json` with failures and manual-review notes; a missing section measurement is explicitly marked for visual review.
- Add deterministic regression tests of the original and corrected desktop typography thresholds.

### Computed type values in isolated Chromium CSS check

| Viewport | Home H1 | Public page H1 |
| --- | ---: | ---: |
| 390px | 48.8px | 44px |
| 768px | 58.368px | 48.384px |
| 1440px | 96px | 76px |

This check loaded the shared design tokens and heading consumers, not the live Next.js pages. Run the full browser QA for final evidence.

## Verification

- 99 available Node source tests passed (two TypeScript-dependent test files could not run in this tool environment because project dependencies are not installed here).
- No full Next.js build or authenticated page screenshot QA was run on this follow-up package.
- Run `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run build`, `npm run start`, then `npm run qa:rhythm` in the Windows project.
- Review generated screenshots at 390/768/1440 px and both themes. QA does **not** certify the visual consistency of client/admin dashboards.

This is a targeted typography and QA correctness improvement, **not a completed end-to-end design-system overhaul**.
