# Windows PowerShell: run from the unpacked RapidlyOn project directory.
$ErrorActionPreference = 'Stop'
if (!(Test-Path package.json)) { throw 'Run this script from RapidlyOn project root.' }
Write-Host 'Installing exact locked dependencies...' -ForegroundColor Cyan
npm ci
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
Write-Host 'Checking TypeScript...' -ForegroundColor Cyan
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript validation failed' }
Write-Host 'Building...' -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Production build failed' }
Write-Host 'Starting local development server...' -ForegroundColor Cyan
$server = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm run dev' -PassThru -WindowStyle Hidden
try {
  $ready = $false
  for ($i=0; $i -lt 45; $i++) {
    Start-Sleep -Seconds 2
    try { $r = Invoke-WebRequest 'http://localhost:3000' -UseBasicParsing -TimeoutSec 3; if ($r.StatusCode -eq 200) { $ready=$true; break } } catch {}
  }
  if (-not $ready) { throw 'Next.js did not become ready on http://localhost:3000. Check whether port 3000 is in use.' }
  npx playwright install chromium
  if ($LASTEXITCODE -ne 0) { throw 'Playwright Chromium installation failed' }
  npm run qa:senior-product
  if ($LASTEXITCODE -ne 0) { Write-Warning 'QA detected issues. Inspect qa-artifacts/senior-product/report.json' }
  Write-Host 'Open qa-artifacts/senior-product/index.html for real screenshots.' -ForegroundColor Green
} finally { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
