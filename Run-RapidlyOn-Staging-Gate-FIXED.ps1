# RapidlyOn staging-only orchestrator. No migration push, no production writes.
param([switch]$RunBrowserTests)
$ErrorActionPreference = 'Stop'
$root = 'C:\Users\M.Zohaib\Desktop\rapidlyon'
if (-not (Test-Path (Join-Path $root 'package.json'))) { $root = (Get-Location).Path }
Set-Location $root
$expected = 'tfsdwfykhufmjtyvlgmn'
$refPath = 'supabase/.temp/project-ref'
if (-not (Test-Path $refPath)) { throw 'Missing linked Supabase project reference.' }
$actual = (Get-Content $refPath -Raw).Trim()
if ($actual -ne $expected) { throw "SAFETY STOP: linked Supabase project is $actual" }
$cli = Join-Path $root 'node_modules/.bin/supabase.cmd'
if (-not (Test-Path $cli)) { throw 'Local Supabase CLI missing. Run npm ci after reviewing dependencies.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$dir = Join-Path $root "qa-artifacts/staging-gate/$stamp"
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$results = New-Object System.Collections.Generic.List[object]
function Record([string]$Name,[string]$Status,[string]$Details) {
  $script:results.Add([pscustomobject]@{ Check=$Name; Status=$Status; Details=$Details })
  Write-Host "[$Status] $Name  -  $Details"
}
function Run-Captured([string]$Name,[string]$Exe,[string[]]$Arguments,[string]$Log) {
  try {
    $global:LASTEXITCODE = 0
    $output = & $Exe @Arguments 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    $output | Set-Content (Join-Path $dir $Log) -Encoding UTF8
    if ($exitCode -eq 0) { Record $Name 'PASS' "Exit 0; $Log" }
    else { Record $Name 'FAIL' "Exit $exitCode; $Log" }
  } catch {
    $_.ToString() | Set-Content (Join-Path $dir $Log) -Encoding UTF8
    Record $Name 'FAIL' "Exception; $Log"
  }
}
Record 'Staging project isolation' 'PASS' $actual
$migration = 'supabase/migrations/20261102000400_lock_staging_billing_function_fixes.sql'
$expectedHash = '01F5A981D14AF550E68A867AB5BBC518F829DFFB7CCD39FBB178CF72B342A9BB'
if (-not (Test-Path $migration)) { throw 'Migration lock file not found.' }
if ((Get-FileHash $migration -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Migration hash mismatch. STOP.' }
Record 'Migration integrity' 'PASS' $expectedHash
Run-Captured 'Migration history' $cli @('migration','list','--linked') 'migration-list.txt'
Run-Captured 'No pending migrations (dry-run)' $cli @('db','push','--linked','--dry-run') 'migration-dry-run.txt'
$dryText = Get-Content (Join-Path $dir 'migration-dry-run.txt') -Raw
if ($dryText -match 'Remote database is up to date') { Record 'Migration sync confirmed' 'PASS' 'Remote database is up to date' }
else { Record 'Migration sync confirmed' 'REVIEW' 'Review dry-run output for pending migrations' }
$billing = 'supabase/tests/20261102_staging_billing_regression_diagnostic.sql'
$rls = 'supabase/tests/20261102_staging_rls_diagnostic.sql'
foreach ($item in @(@('Billing SQL', $billing, '21'), @('RLS SQL', $rls, '22'))) {
  $name = $item[0]; $path = $item[1]; $plan = $item[2]
  if (-not (Test-Path $path)) { Record $name 'BLOCKED' 'Diagnostic file missing'; continue }
  $sql = Get-Content $path -Raw
  if ($sql -match "extensions\.plan\($plan\)" -and $sql -match '(?im)^\s*ROLLBACK\s*;') {
    Copy-Item $path (Join-Path $dir ([System.IO.Path]::GetFileName($path)))
    Record $name 'READY' "Copied into QA artifacts; requires authorized staging SQL execution and result capture"
  } else { Record $name 'FAIL' 'Plan or rollback guard missing' }
}
# No automatic SQL Editor role simulation via external DB connection; such a run requires explicit connection/auth review.
if (Test-Path 'node_modules/.bin/tsc.cmd') {
  Run-Captured 'TypeScript' (Join-Path $root 'node_modules/.bin/tsc.cmd') @('--noEmit') 'typescript.txt'
} else { Record 'TypeScript' 'BLOCKED' 'Dependencies unavailable' }
if (Test-Path 'package.json') {
  Run-Captured 'Lint' 'npm.cmd' @('run','lint') 'lint.txt'
  Run-Captured 'Build' 'npm.cmd' @('run','build') 'build.txt'
  if (Test-Path 'scripts/staging-commercial-e2e.mjs') {
    if ($RunBrowserTests) {
      Record 'Playwright authenticated E2E' 'REVIEW' 'Not launched automatically: ensure explicit staging test accounts, stable base URL and no production side effects'
    } else { Record 'Playwright authenticated E2E' 'BLOCKED' 'Requires authenticated staging identities and reviewed test configuration' }
  } else { Record 'Playwright authenticated E2E' 'BLOCKED' 'Test file not found' }
}
$identity = 'src/app/api/staging-qa/identity/route.ts'
if (Test-Path $identity) {
  Copy-Item $identity (Join-Path $dir 'identity-route-review.ts')
  Record 'Staging identity route audit' 'REVIEW' 'Source copied for security review; not certified'
} else { Record 'Staging identity route audit' 'REVIEW' 'No matching route; check application structure' }
Record 'Real Client A/B JWT isolation' 'BLOCKED' 'Requires two genuine staging-issued authenticated sessions and non-destructive API tests'
Record 'Object-owner storage policy' 'BLOCKED' 'Requires configured isolated test bucket and real authenticated identities'
Record 'Safepay sandbox' 'BLOCKED' 'Requires official sandbox contract, verified credentials and webhook verification'
Record 'Resend email delivery' 'BLOCKED' 'Requires validated sender/recipient and permission to send a test email'
Record 'Cron validation' 'BLOCKED' 'Rotate previously exposed secret; deployed invocation and endpoint checks needed'
Record 'Source control' 'REVIEW' 'Use existing trusted Git remote or initialize after review; do not auto-create Git history'
Record 'Production release' 'NO-GO' 'External services, authenticated E2E and release approvals outstanding'
$results | Export-Csv (Join-Path $dir 'results.csv') -NoTypeInformation -Encoding UTF8
$results | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $dir 'results.json') -Encoding UTF8
$lines = @('# RapidlyOn Staging Gate', '', "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')", "Staging ref: $expected", '', '| Check | Status | Details |', '|---|---|---|')
foreach ($r in $results) { $safe = $r.Details -replace '\|','/'; $lines += "| $($r.Check) | $($r.Status) | $safe |" }
$lines += '', '**Production release: NO-GO until all blocking checks are independently verified.**'
$lines | Set-Content (Join-Path $dir 'REPORT.md') -Encoding UTF8
Write-Host "`nREPORT: $(Join-Path $dir 'REPORT.md')" -ForegroundColor Cyan
$results | Format-Table -AutoSize
