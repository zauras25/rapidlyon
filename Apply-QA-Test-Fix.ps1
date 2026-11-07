param(
    [string]$ProjectRoot = 'C:\Users\M.Zohaib\Desktop\rapidlyon-clean'
)
$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'discovery-workflow.test.mjs'
$target = Join-Path $ProjectRoot 'scripts\discovery-workflow.test.mjs'
if (!(Test-Path $source)) { throw 'STOP: Patch file not found' }
if (!(Test-Path $target)) { throw 'STOP: Discovery test not found in project' }
$old = Get-Content $target -Raw
if ($old -notmatch "\['session','Session',session\?1:0\]" -or $old -notmatch 'Service suitability' -or $old -notmatch 'Scope readiness') {
    throw 'STOP: Unexpected test version. No files changed.'
}
$patch = Get-Content $source -Raw
$backup = "$target.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"
Copy-Item $target $backup
[System.IO.File]::WriteAllText($target,$patch,[System.Text.UTF8Encoding]::new($false))
Write-Host "Test expectations updated. Backup: $backup" -ForegroundColor Green
Write-Host 'Only the automated test changed; no app logic or database changed.'
