$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\M.Zohaib\Desktop\rapidlyon-clean'
if (!(Test-Path 'package.json')) { throw 'STOP: Project not found.' }
if (!(Test-Path 'node_modules\playwright')) { throw 'STOP: Playwright missing. Run npm ci in the project.' }
$source = Join-Path $PSScriptRoot 'rapidlyon-live-admin-qa.mjs'
if (!(Test-Path $source)) { throw 'STOP: Live QA script missing next to PowerShell runner.' }
$target = Join-Path (Get-Location) 'scripts\rapidlyon-live-admin-qa.mjs'
Copy-Item -LiteralPath $source -Destination $target -Force
Write-Host 'Phase 7 READ-ONLY browser QA. Start npm run dev in another PowerShell window.' -ForegroundColor Cyan
Write-Host 'Login manually in the launched browser, then return to this terminal and press Enter.'
Write-Host 'If browser is missing, run: npx playwright install chromium' -ForegroundColor Yellow
node $target
if ($LASTEXITCODE -ne 0) { throw 'Browser QA failed or was interrupted. See output above.' }
