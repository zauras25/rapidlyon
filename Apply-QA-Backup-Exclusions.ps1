param([string]$ProjectRoot = 'C:\Users\M.Zohaib\Desktop\rapidlyon-clean')
$ErrorActionPreference = 'Stop'
$ts = Join-Path $ProjectRoot 'tsconfig.json'
$eslint = Join-Path $ProjectRoot 'eslint.config.mjs'
if (!(Test-Path -LiteralPath $ts) -or !(Test-Path -LiteralPath $eslint)) { throw 'STOP: Missing tsconfig or ESLint config.' }
$originalTs = [IO.File]::ReadAllText($ts)
$originalEs = [IO.File]::ReadAllText($eslint)
if ($originalTs -notmatch '"exclude"\s*:\s*\[') { throw 'STOP: Unexpected tsconfig exclude shape. Nothing changed.' }
if ($originalEs -notmatch 'globalIgnores\(\[') { throw 'STOP: Unexpected ESLint config shape. Nothing changed.' }
$updatedTs = $originalTs
$updatedEs = $originalEs
if ($updatedTs -notmatch '"qa-results/\*\*"') {
  $updatedTs = [regex]::Replace($updatedTs, '("exclude"\s*:\s*\[)', '$1"qa-results/**", ', 1)
}
if ($updatedEs -notmatch '"qa-results/\*\*"') {
  $updatedEs = [regex]::Replace($updatedEs, '(globalIgnores\(\[)', '$1' + "`n    `"qa-results/**`",", 1)
}
if ($updatedTs -ceq $originalTs -and $updatedEs -ceq $originalEs) {
  Write-Host 'ALREADY APPLIED: QA backup exclusions.' -ForegroundColor Green
  exit 0
}
$backup = Join-Path $ProjectRoot ('qa-results\config-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
Copy-Item $ts (Join-Path $backup 'tsconfig.json')
Copy-Item $eslint (Join-Path $backup 'eslint.config.mjs')
$utf8 = [System.Text.UTF8Encoding]::new($false)
[IO.File]::WriteAllText($ts, $updatedTs, $utf8)
[IO.File]::WriteAllText($eslint, $updatedEs, $utf8)
Write-Host "SUCCESS: QA backup directories excluded from TypeScript + ESLint. Backup at: $backup" -ForegroundColor Green
Write-Host 'No application, test, secret, database, or payment code modified.'
