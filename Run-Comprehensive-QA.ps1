param(
 [string]$BaseUrl = 'http://127.0.0.1:3000',
 [switch]$SkipStaticChecks
)
$ErrorActionPreference = 'Stop'
if (!(Test-Path '.\package.json') -or !(Test-Path '.\src\app')) { throw 'Run from RapidlyOn project root.' }
$branch = (& git branch --show-current).Trim()
Write-Host "RapidlyOn QA branch: $branch" -ForegroundColor Cyan
if (!$SkipStaticChecks) {
 foreach ($task in @(@('npx','tsc','--noEmit'),@('npm','run','lint'),@('npm','run','build'))) {
   $name = $task[0]; $args1 = @($task | Select-Object -Skip 1)
   Write-Host ("RUN: " + $name + ' ' + ($args1 -join ' ')) -ForegroundColor Cyan
   & $name @args1
   if ($LASTEXITCODE -ne 0) { throw "Static check failed: $name $($args1 -join ' ')" }
 }
}
try {
 $res=Invoke-WebRequest -Uri $BaseUrl -UseBasicParsing -TimeoutSec 10
 if ($res.StatusCode -ne 200) { throw "HTTP $($res.StatusCode)" }
} catch { throw "Local site unavailable at $BaseUrl. In another PowerShell terminal run: npm run dev -- --hostname 127.0.0.1 -p 3000" }
$env:QA_BASE_URL=$BaseUrl
& node '.\scripts\comprehensive-qa.mjs'
if ($LASTEXITCODE -ne 0) { Write-Warning 'QA detected issues. Inspect qa-artifacts/comprehensive/index.html'; exit 1 }
Write-Host 'QA checks passed. Inspect screenshots for human visual approval.' -ForegroundColor Green
