param([string]$ProjectRoot = 'C:\Users\M.Zohaib\Desktop\rapidlyon-clean')
$ErrorActionPreference = 'Stop'
Set-Location $ProjectRoot
$report = Join-Path $ProjectRoot ('qa-results\lint-retest-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $report -Force | Out-Null
$results = @()
foreach ($check in @('typescript','lint','build')) {
 Write-Host "`n=== $check ===" -ForegroundColor Cyan
 $argsList = switch ($check) {
  'typescript' { @('tsc','--noEmit') }
  'lint' { @('eslint','.') }
  'build' { @('next','build') }
 }
 $log = Join-Path $report ($check + '.log')
 $exe = Join-Path $ProjectRoot ('node_modules\.bin\' + $argsList[0] + '.cmd')
 & $exe @($argsList | Select-Object -Skip 1) 2>&1 | Out-File -FilePath $log -Encoding utf8
 $code = $LASTEXITCODE
 $status = if($code -eq 0){'PASS'}else{'FAIL'}
 Write-Host "$check : $status (exit $code)"
 $results += [pscustomobject]@{Check=$check;Status=$status;ExitCode=$code;Log=$log}
 if($check -eq 'lint' -and $code -ne 0) {
   Write-Host '--- ESLint findings (first 100 lines) ---'
   Get-Content $log | Select-Object -First 100
 }
}
$results | Export-Csv (Join-Path $report 'summary.csv') -NoTypeInformation
$results | Format-Table -AutoSize
Write-Host "Reports: $report"
