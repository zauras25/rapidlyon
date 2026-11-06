# RapidlyOn — Premium UI Redesign Starter

## What is included

This is a **visual implementation starter**, based on all 120 images in `full-site.zip` and the site QA metadata. It does **not** modify your live Next.js app, database, authentication, project submissions, payment calculations, or existing content. It is **not** an editable Figma file. It provides an interface design language, a clickable concept preview, and reusable React/CSS implementation primitives.

- `preview/index.html` — navigable, responsive prototype of 40 distinct routes, grouped as Public (20), Admin (14), and Client (6).
- `src/styles/rapidlyon-design-system.css` — scoped design tokens, typography, header/hero, sections, forms, cards, tables, admin shell, states, and responsive styles.
- `src/components/ui/rapidlyon-kit.tsx` — small typed React component layer (RoCard, RoButton, RoField, RoInput, RoTextarea, RoBadge, RoPageHeader, RoContainer, RoEyebrow).
- `design-tokens.json` — token reference for the design language.
- `SCREEN_AUDIT.md` — actual findings and route-specific conversion guidance.
- `screenshots-manifest.csv` — 120 audited screenshot records with statuses and reasons.

## Design direction

A calm, premium, welcoming service-studio aesthetic: **warm ivory + forest green + sage surfaces + thoughtful editorial type**. Inspired by the warm, spacious approach discussed for the Summit Family Dental Care VIP Program; not a claim of a pixel-perfect extraction of that site's CSS.

- **Accessibility:** dark text on light surfaces; explicit white-on-forest hero text (current home screenshot uses dark-on-dark text on part of the hero); visible focus treatment; reduced-motion support.
- **Typography:** Manrope for headings, DM Sans for body. Display, page title, H2, H3, paragraph, metadata styles follow a consistent scale.
- **Layout:** desktop max width 1180px, generous section padding, 8px-friendly spacing primitives, tighter small-screen gutters.
- **Components:** primary/secondary buttons, status pills, cards, text fields, forms, responsive tables, auth cards, sidebar, KPIs, empty/loading/error patterns.
- **Motion:** small 220ms transform/shadow hover effects. No forced scroll animations.
- **Responsive:** phone <=760px; tablet <=1000px; large-screen fluid. Responsive preview is navigable in any modern browser.

## Open the preview

Extract the starter ZIP, then open `preview/index.html` in Chrome or Edge. At the top, use the page selector to visit every route. **Forms and admin actions in this prototype are not connected to the backend.** Admin and client values marked as examples are placeholders, not actual customer or project records.

There is also a separate, single-file `rapidlyon-redesign-preview.html` you can open directly without extracting assets.

## Safe Next.js integration

1. Back up and commit the actual RapidlyOn source first.
2. Copy `src/styles/rapidlyon-design-system.css` to the Next.js project, keeping the existing `globals.css`, font setup, Tailwind configuration, and auth APIs intact.
3. Import the stylesheet once in the relevant App Router layout, for example `import '@/styles/rapidlyon-design-system.css'`.
4. Apply `className="ro-ui"` to a suitable public site layout wrapper, then convert one route at a time. Do **not** wrap the entire app without checking the current admin/client selectors and CSS behavior.
5. Copy the React kit to `src/components/ui/rapidlyon-kit.tsx`, then replace markup carefully with design-system components **without replacing business logic**.
6. Implement routes in this sequence: `Home → Services → Pricing → Discovery → Contact → Work → About / Process → Insights / Legal → Client auth / Workspace → Admin (authenticated)`.
7. Retest forms, session boundaries, proposal/invoice workflows, dynamic page states, and full responsive behavior after each route.

Example use in a Next.js page:

```tsx
import { RoCard, RoButton, RoEyebrow } from '@/components/ui/rapidlyon-kit';
export default function Example() {
  return (
    <div className="ro-ui">
      <main className="ro-shell ro-section">
        <RoCard><RoEyebrow>Start a project</RoEyebrow><h2>Tell us your idea.</h2><RoButton>Continue</RoButton></RoCard>
      </main>
    </div>
  );
}
```

## Commands — Windows PowerShell

Run these **from the actual Next.js project directory**, after copying the starter files into matching `src/` locations:

```powershell
npm run lint
npx tsc --noEmit
npm run build
```

The design starter intentionally does not modify `next.config`, `package.json`, `.env`, Supabase migrations, API routes, or admin permissions. See `SCREEN_AUDIT.md` for what remains blocked by auth redirects / incomplete screenshots.

## Scope and limitations

- The provided ZIP includes **screenshots and browser metrics, not application source code**. The preview shows the proposed look, not changes on the user's localhost website.
- Admin pages are largely login redirects or loading states, so authentic data tables, notification menus, and workflows were not visible. Admin previews are a *design proposal* only.
- Client dashboard is a skeleton state, and client billing/invitation are access/error states, not authenticated workflows. Preview examples avoid claiming otherwise.
- Pricing calculator, discovery form, login, payments, notifications, and CRUD actions **must preserve real production behavior** when integrated; they are not implemented by this standalone visual concept.
- Fonts use Google Fonts when network access is available; the CSS provides system font fallbacks.
