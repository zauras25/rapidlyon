# RapidlyOn Admin Discovery — UX redesign (source implementation)

## Goal
Replace the long, vertically stacked discovery detail page with one focused admin workflow that follows the client Guided Discovery V10 mental model without copying client-facing components into admin.

## Updated UI
The Discovery records table remains unchanged. Opening a record now displays one qualification journey with a persistent step navigator and one main work area:
1. **Client brief:** read-only contact information, services and original submission.
2. **Service fit:** existing persisted service suitability reviews and explanations.
3. **Ask questions:** existing suggested UX/UI, Next.js and SEO question banks, editable draft questions, private clarification invitations and question tracker.
4. **Conversation:** client-selected session planning, confirmation and findings.
5. **Decision:** existing readiness assessment with required justification.
6. **Scope & project:** existing guarded scope and project conversion actions.
7. **Follow-up & history:** existing activity log, record status, next action, team notes, follow-up date and archive controls.

### Interaction rules
- Sidebar step buttons and Back/Continue navigate; they DO NOT submit or save data.
- The clarification module remains mounted while switching steps, protecting unsent question and assessment drafts. The admin still needs to explicitly save or send.
- Existing API routes, Supabase schema and security checks remain in place.
- Archive is tucked behind a deliberate 'Record lifecycle' control.
- The design uses the existing RapidlyOn Brand component and shared styling plus scoped journey styles; responsive navigation becomes a horizontal scrollable step strip on narrower screens.
- Existing admin record list, inquiries, billing, and other console pages are intentionally left unchanged.

## Source files changed in this redesign
- `src/components/console/admin-console.tsx`
- `src/components/console/discovery-clarification-workflow.tsx`
- `src/styles/globals.css`

## QA performed
- Source inspection of current admin console and clarification workflow.
- TypeScript JSX syntax transpilation passed for both edited TSX modules.
- Structural checks: 7 visible stages, preserved admin API handlers, custom-question draft editing, protected record lifecycle and responsive CSS.

## Not yet verified
- Full TypeScript type check, ESLint, Next.js build or browser screenshots: the working environment's `node_modules` is incomplete.
- Authenticated end-to-end journey with a real staging database and email provider.
- Full redesign of every other Admin CMS section.

## Apply safely in Windows PowerShell
The **full-project ZIP** is the preferred deliverable for reviewing this version separately. Extract it into a NEW folder rather than overwriting production code:

```powershell
New-Item -ItemType Directory -Force .\rapidlyon-redesign-review | Out-Null
Expand-Archive -LiteralPath '.\RapidlyOn-Admin-Discovery-Redesigned.zip' -DestinationPath '.\rapidlyon-redesign-review' -Force
Set-Location .\rapidlyon-redesign-review
npm ci
npx tsc --noEmit
npm run lint
npm test
npm run build
npm run dev
```

If applying the **patch ZIP** to your existing repository, make a Git commit first. Extract at project root only after reviewing the 7 changed/new files. Do not run production Supabase migrations while testing the UI.
