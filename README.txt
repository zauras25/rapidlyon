RapidlyOn Phase 7 — Browser QA (read-only)

1. Extract both files to C:\Users\M.Zohaib\Desktop\rapidlyon-clean\ (same directory).
2. In a separate terminal run: npm run dev
3. In project terminal run: powershell -NoProfile -ExecutionPolicy Bypass -File .\Run-RapidlyOn-Live-QA.ps1
4. Browser opens. Manually sign into Admin with existing MFA and press Enter in the runner terminal.
5. The runner scans 14 Admin routes x 3 viewports, captures screenshots, collects console error counts and failed API status codes. It NEVER submits forms, sends emails, changes database or saves cookies/session files.
6. Reports are saved under qa-results/live-admin-.../summary.csv and results.json. Share the summary.csv only after reviewing it. DO NOT share screenshots containing client data.
7. If Chromium not installed: npx playwright install chromium
8. If server is at a different port, in runner terminal set $env:QA_BASE_URL='http://localhost:3001' before executing.

PASS means basic route loaded and no significant horizontal overflow; not a business-workflow or security PASS. REVIEW indicates errors requiring inspection. Live tests do not certify production readiness.
