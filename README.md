# RapidlyOn

Next.js 16 (App Router, `cacheComponents`) + Supabase studio site with public pages, a client portal (`/client`) and an admin studio (`/admin`).

## Layout
- `src/app`, `src/components`, `src/lib`, `src/data` — application code (`@/*` → `./src/*`)
- `src/design-system/tokens.css` — **single source of truth** for design tokens
- `src/styles/globals.css` — component/page styles consuming those tokens
- `supabase/migrations` — database migrations (apply in order)
- `figma-handoff/` — token snapshot + CSVs, kept in sync with `tokens.css` (`npm run check:figma`)
- `scripts/` — static contract tests (`npm test`) and Playwright QA
- `docs/` — design specs, production-readiness docs, roadmap

## Setup
```bash
cp .env.example .env.local   # fill in real values; never commit .env*
npm install
npm run dev
```

## Checks
```bash
npm run lint && npx tsc --noEmit && npm run build
npm test                         # static release contract
node --test scripts/*.test.mjs   # full static suite
npm run check:figma              # token snapshot sync
```
