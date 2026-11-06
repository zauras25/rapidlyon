# RapidlyOn — Senior UX pass 2

## Implemented
- Hero secondary CTA routes to Services when no work is published; routes to Work when published projects exist.
- Site-wide keyboard skip link targeting a consistent main-content anchor.
- Escape closes mobile navigation and returns focus to the menu toggle.
- Homepage process steps use a semantic ordered list while maintaining existing visual styling.

## Verified
- `npm run test:design` — PASS
- `npm run test` — PASS (source contracts and import resolution only)

## Not verified
- Next.js production build, Playwright/browser pixel-diff, authenticated dashboard, Supabase flows.
- The installed node_modules folder does not include the `next` or `tsc` executables in this workspace.

## Local Windows PowerShell QA
```powershell
npm ci
npx tsc --noEmit
npm run lint
npm run build
npm run qa:visual
```
