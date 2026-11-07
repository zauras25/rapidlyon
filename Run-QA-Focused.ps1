param([string]$ProjectRoot = 'C:\Users\M.Zohaib\Desktop\rapidlyon-clean')
$ErrorActionPreference = 'Stop'
if (!(Test-Path (Join-Path $ProjectRoot 'package.json'))) { throw 'STOP: Project not found.' }
Set-Location $ProjectRoot
$results = Join-Path $ProjectRoot ('qa-results\focused-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force -Path $results | Out-Null
$summary = @()
$checks = @(
  @{name='typescript'; executable='npx.cmd'; args=@('--no-install','tsc','--noEmit')},
  @{name='lint'; executable='npx.cmd'; args=@('--no-install','eslint','src','scripts')},
  @{name='build'; executable='npm.cmd'; args=@('run','build')}
)
foreach ($check in $checks) {
  $log = Join-Path $results ($check.name + '.log')
  Write-Host "`n=== $($check.name) ===" -ForegroundColor Cyan
  & $check.executable @($check.args) *>&1 | Out-File -FilePath $log -Encoding utf8
  $code = $LASTEXITCODE
  $summary += [PSCustomObject]@{Check=$check.name;Status=$(if($code -eq 0){'PASS'}else{'FAIL'});ExitCode=$code;Log=$log}
  Write-Host "$($check.name): $(if($code -eq 0){'PASS'}else{'FAIL'}) (exit $code)"
  if ($code -ne 0) { Get-Content $log | Select-Object -Last 45 }
}
$summary | Export-Csv -NoTypeInformation -Encoding utf8 -Path (Join-Path $results 'summary.csv')
$summary | Format-Table -AutoSize
Write-Host "Reports: $results"
