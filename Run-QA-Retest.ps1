param([string]$ProjectRoot = 'C:\Users\M.Zohaib\Desktop\rapidlyon-clean')
$ErrorActionPreference='Stop'
if (!(Test-Path (Join-Path $ProjectRoot 'package.json'))) { throw 'STOP: Wrong folder.' }
Set-Location $ProjectRoot
$report=Join-Path $ProjectRoot ('qa-results\retest-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $report | Out-Null
$checks=@(
  @{Name='typescript';Command='npx --no-install tsc --noEmit'},
  @{Name='admin-runtime';Command='node --test scripts/admin-runtime.test.mjs'},
  @{Name='discovery-workflow';Command='node --test scripts/discovery-workflow.test.mjs'},
  @{Name='business-release';Command='node --test scripts/business-release.test.mjs'},
  @{Name='lint';Command='npm run lint'},
  @{Name='build';Command='npm run build'}
)
$results=@()
foreach($check in $checks){
  $log=Join-Path $report ($check.Name+'.log')
  Write-Host "`n=== $($check.Name) ===" -ForegroundColor Cyan
  & cmd.exe /d /s /c "$($check.Command) 1> `"$log`" 2>&1"
  $code=$LASTEXITCODE
  $results += [pscustomobject]@{Check=$check.Name;Status=$(if($code -eq 0){'PASS'}else{'FAIL'});ExitCode=$code;Log=$log}
  Write-Host "$($check.Name): $(if($code -eq 0){'PASS'}else{'FAIL'})"
  if($code -ne 0){ Get-Content $log -Tail 12 }
}
$results|Export-Csv -NoTypeInformation -Encoding UTF8 (Join-Path $report 'summary.csv')
$results|Format-Table -AutoSize
Write-Host "`nReports: $report" -ForegroundColor Green
Write-Host 'Do not share private credentials, .env files, cookies or session values.'
