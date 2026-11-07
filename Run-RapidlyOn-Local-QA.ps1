param(
    [string]$ProjectRoot = 'C:\Users\M.Zohaib\Desktop\rapidlyon-clean'
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path (Join-Path $ProjectRoot 'package.json'))) { throw 'STOP: package.json missing from target project' }
Set-Location $ProjectRoot
if (!(Test-Path 'node_modules\.bin\next.cmd')) { throw 'STOP: Dependencies missing; run npm ci first' }
$report = Join-Path $ProjectRoot ('qa-results\local-audit-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $report -Force | Out-Null
$results = @()
function Invoke-QACheck([string]$Name,[string]$Command) {
    Write-Host "`n=== $Name ===" -ForegroundColor Cyan
    $log = Join-Path $report ($Name + '.log')
    # Invoke through cmd to capture native process stdout/stderr without PowerShell native stderr termination.
    & cmd.exe /d /s /c "$Command 1> `"$log`" 2>&1"
    $exit = $LASTEXITCODE
    if ($null -eq $exit) { $exit = 1 }
    $script:results += [PSCustomObject]@{ Check=$Name; ExitCode=$exit; Status=$(if ($exit -eq 0) {'PASS'} else {'FAIL'}); Log=$log }
    Write-Host "$Name => $(if($exit -eq 0){'PASS'}else{'FAIL'}) (exit $exit)"
    if ($exit -ne 0) { Get-Content $log -Tail 20 }
}
Invoke-QACheck 'locked-decisions' 'node --test scripts/admin-locked-decisions.test.mjs'
Invoke-QACheck 'discovery-workflow' 'node --test scripts/discovery-workflow.test.mjs'
Invoke-QACheck 'admin-runtime' 'node --test scripts/admin-runtime.test.mjs'
Invoke-QACheck 'business-release' 'node --test scripts/business-release.test.mjs'
Invoke-QACheck 'notifications' 'node --test scripts/notifications.test.mjs'
Invoke-QACheck 'typescript' 'npx --no-install tsc --noEmit'
Invoke-QACheck 'lint' 'npm run lint'
Invoke-QACheck 'build' 'npm run build'
$csv = Join-Path $report 'summary.csv'
$results | Export-Csv -NoTypeInformation -Encoding UTF8 $csv
Write-Host "`nQA RESULTS: $csv" -ForegroundColor Green
$results | Format-Table Check,Status,ExitCode -AutoSize
Write-Host 'Do not share .env files or secrets; review logs before sharing.'
