# Run from project root in PowerShell: .\scripts\Launch-Preflight.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
function Run-Step([string]$Title, [string]$Program, [string[]]$Arguments) {
  Write-Host "`n>>> $Title" -ForegroundColor Cyan
  & $Program @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$Title FAILED (exit code $LASTEXITCODE). DO NOT DEPLOY." }
}
Run-Step 'Clean dependency install' 'npm' @('ci')
Run-Step 'Release and business workflow contracts' 'node' @('--test','scripts/release-static.test.mjs','scripts/business-release.test.mjs','scripts/roadmap-smoke.test.mjs','scripts/client-billing-access.test.mjs')
Run-Step 'Lint' 'npm' @('run','lint')
Run-Step 'TypeScript' 'npx' @('tsc','--noEmit')
Run-Step 'Configured source release check' 'npm' @('test')
Run-Step 'Production build' 'npm' @('run','build')
Write-Host "`nLocal code checks passed. Complete the live environment and end-to-end gates documented in docs\roadmap\IMPLEMENTATION_STATUS_2026-10-29.md before deployment." -ForegroundColor Green
