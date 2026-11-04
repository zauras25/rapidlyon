# RapidlyOn — Windows clean setup and error recovery

## Why the earlier run failed

- `EPERM unlink ... next-swc.win32-x64-msvc.node` means a Windows process or security tool prevented `npm ci` from replacing the SWC native binary. The install did **not** complete.
- `src/src` release failure means the folder still contains stale legacy files. The corrected release ZIP does **not** contain this directory. Extract into an **empty** folder rather than copying over an old version.
- The earlier roadmap test used a hardcoded Linux global TypeScript path. It now uses the project-local `typescript` dependency, resolved through `require('typescript')`.
- `eslint`, `tsc` and `next` were missing because dependencies were not installed successfully. Their errors should only be re-evaluated after a successful `npm ci`.

## Safest recovery

1. Close the Next.js dev server, Node-powered terminals, and apps that may be scanning or accessing the old project's `node_modules`. If you intend to terminate Node processes, ensure you do not interrupt unrelated work.
2. Download the corrected ZIP; use Windows **Extract All** into a **new empty** folder, for example `Desktop\rapidlyon-roadmap-fixed`.
3. Open PowerShell in the new folder. Confirm `package.json`, `package-lock.json`, `src`, and `scripts` are at that level, without an extra nested folder.
4. Run `powershell -ExecutionPolicy Bypass -File .\Windows-Verify.ps1` (or run commands individually below). This helper fails fast and never kills processes or deletes user data.
5. If `npm ci` encounters the SWC lock in that new folder, fully close the active Next/Node processes. Only if appropriate, restart Windows and retry. Check antivirus quarantine/permissions; do **not** disable security protection as a default workaround.

### Individual commands (stop immediately on first failure)

```powershell
npm ci
npm test
npm run test:roadmap
npm run lint
npx --no-install tsc --noEmit
npm run build
```

If `.env.local` is missing, copy `.env.example` to `.env.local` and configure only your own real development/staging values before launching integration-dependent routes. Never publish production secrets in support logs.

### Quick legacy check

```powershell
Test-Path .\src\src
```

Expected output: `False`. If `True`, you are not testing the clean release folder; do not delete files blindly or merge with the old extraction. Open the fresh folder instead.

### Release scope

Passing local commands is required but does not prove real Supabase migrations, email delivery, access-control rules, authorized client login, billing reconciliation, or production-ready deployment. See `IMPLEMENTATION_STATUS_2026-10-29.md` for integration verification gates. Online payment stays disabled until verified configuration is approved.
