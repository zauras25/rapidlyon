param([string]$ProjectRoot = 'C:\Users\M.Zohaib\Desktop\rapidlyon-clean')
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $ProjectRoot
if (!(Test-Path 'package.json')) { throw 'STOP: package.json not found.' }
$dir = Join-Path (Get-Location).Path ('qa-results\final-lint-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $dir -Force | Out-Null
$results = @()
$jobs = @(
    @{Name='typescript';Args=@('tsc','--noEmit')},
    @{Name='lint';Args=@('eslint','.')},
    @{Name='build';Args=@('next','build')},
    @{Name='admin-locked-decisions';Args=@('node','--test','scripts/admin-locked-decisions.test.mjs')},
    @{Name='admin-runtime';Args=@('node','--test','scripts/admin-runtime.test.mjs')},
    @{Name='discovery-workflow';Args=@('node','--test','scripts/discovery-workflow.test.mjs')},
    @{Name='business-release';Args=@('node','--test','scripts/business-release.test.mjs')}
)
foreach ($job in $jobs) {
    $name = $job.Name
    Write-Host "`n=== $name ===" -ForegroundColor Cyan
    $file = Join-Path $dir "$name.log"
    if ($job.Args[0] -eq 'node') {
        $output = & node @($job.Args[1..($job.Args.Count-1)]) 2>&1
    } else {
        $output = & npx --no-install @($job.Args) 2>&1
    }
    $exit = $LASTEXITCODE
    $output | Out-File -LiteralPath $file -Encoding utf8
    $status = if ($exit -eq 0) { 'PASS' } else { 'FAIL' }
    Write-Host "$name : $status (exit $exit)" -ForegroundColor $(if ($exit -eq 0) {'Green'} else {'Red'})
    if ($exit -ne 0) { $output | Select-Object -Last 35 | ForEach-Object { Write-Host $_ } }
    $results += [PSCustomObject]@{Check=$name;Status=$status;ExitCode=$exit;Log=$file}
}
$results | Export-Csv -LiteralPath (Join-Path $dir 'summary.csv') -NoTypeInformation -Encoding utf8
$results | Format-Table -AutoSize
Write-Host "`nReports: $dir"
Write-Host 'Do not share .env files, tokens, cookies or passwords.'
