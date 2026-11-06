# Run from project root in PowerShell: .\scripts\Launch-Preflight.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
function Run-Step([string]$Title, [string]$Program, [string[]]$Arguments) {
  Write-Host "`n>>> $Title" -ForegroundColor Cyan
  & $Program @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Title FAILED (exit code $LASTEXITCODE). DO NOT DEPLOY." }
}
Run-Step 'Clean dependency install' 'npm' @('ci')
Run-Step 'Release source contracts' 'node' @('--test','scripts/release-static.test.mjs')
Run-Step 'Lint' 'npm' @('run','lint')
Run-Step 'TypeScript' 'npx' @('tsc','--noEmit')
Run-Step 'Full automated tests' 'npm' @('test')
Run-Step 'Production build' 'npm' @('run','build')
Write-Host "`nLocal code checks passed. Still verify all live environment and E2E gates in LAUNCH_TODAY.md." -ForegroundColor Green
