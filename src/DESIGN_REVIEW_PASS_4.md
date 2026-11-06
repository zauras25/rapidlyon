# RapidlyOn — Senior UX Pass 4: browser QA automation

## Added
- `scripts/senior-product-qa.mjs`: 8 public routes × 3 viewports (390, 768, 1440).
- Real screenshots + gallery (`qa-artifacts/senior-product/index.html`), structured `report.json`.
- Automated checks for HTTP failure, viewport horizontal overflow, H1 and main landmarks, visible unlabeled controls, image alt attributes, and client-side JS errors.
- `Run-Senior-Product-QA.ps1`: Windows install, TypeScript check, build, local server startup, and Playwright capture workflow.
- `npm run qa:senior-product` command.

## Verification status
- Source structure and release contract checks pass.
- Full browser QA was NOT run here: local Node dependencies are incomplete and `npm install` timed out. Browser screenshots must not be assumed clean.
- Admin/client protected flows need separate authenticated testing; do not upload their session state or screenshots publicly.

## Windows execution
From the extracted project root in PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\Run-Senior-Product-QA.ps1
```
