param([string]$ProjectRoot = 'C:\Users\M.Zohaib\Desktop\rapidlyon-clean')
$ErrorActionPreference = 'Stop'
if (!(Test-Path (Join-Path $ProjectRoot 'package.json'))) { throw 'STOP: package.json not found.' }
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupRoot = Join-Path $ProjectRoot "qa-results\patch-backup-$stamp"
$fixes = @(
  @{ Path='src\components\console\admin-workspaces.tsx'; Old='const combined=useMemo(()=>'; New='const combined=useMemo<Array<RecordRow & {_kind:string;_route:string}>>(()=>'; Name='Global search typed records' },
  @{ Path='scripts\admin-runtime.test.mjs'; Old='const signed = expiry => `${expiry}.${crypto.createHmac'; New='const signed = expiry => `mfa-${expiry}.${crypto.createHmac'; Name='Admin session test token prefix' },
  @{ Path='scripts\admin-runtime.test.mjs'; Old='.update(String(expiry)).digest'; New='.update(`mfa-${expiry}`).digest'; Name='Admin session test signed payload' },
  @{ Path='scripts\admin-runtime.test.mjs'; Old="token = '200.invalid-signature';"; New="token = 'mfa-200.invalid-signature';"; Name='Admin session invalid signature test' },
  @{ Path='scripts\business-release.test.mjs'; Old='assert.match(discoveryForm, /not a quote or commitment/i);'; New='assert.match(discoveryForm, /No commitment required/i);'; Name='Inquiry current disclaimer assertion' },
  @{ Path='scripts\discovery-workflow.test.mjs'; Old="\['session','Session',session\?1:0\]"; New="\['session','Conversation',session\?1:0\]"; Name='Discovery session label' },
  @{ Path='scripts\discovery-workflow.test.mjs'; Old='Service suitability'; New='Service fit'; Name='Discovery service review label' },
  @{ Path='scripts\discovery-workflow.test.mjs'; Old='Scope readiness'; New='Ready for scope'; Name='Discovery readiness label' }
)
# Prepare a complete in-memory patch before modifying any file.
$changes = @{}
foreach ($fix in $fixes) {
  $path = Join-Path $ProjectRoot $fix.Path
  if (!(Test-Path -LiteralPath $path)) { throw "STOP: Missing file $($fix.Path)" }
  if (!$changes.ContainsKey($fix.Path)) { $changes[$fix.Path] = [System.IO.File]::ReadAllText($path) }
  $content = $changes[$fix.Path]
  if ($content.Contains($fix.Old)) {
    $changes[$fix.Path] = $content.Replace($fix.Old, $fix.New)
    Write-Host "PATCH: $($fix.Name)" -ForegroundColor Cyan
  } elseif ($content.Contains($fix.New)) {
    Write-Host "ALREADY APPLIED: $($fix.Name)" -ForegroundColor DarkGray
  } else {
    throw "STOP: Unexpected source for $($fix.Name). No files changed."
  }
}
$encoding = [System.Text.UTF8Encoding]::new($false)
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
foreach ($relative in $changes.Keys) {
  $path = Join-Path $ProjectRoot $relative
  $previous = [System.IO.File]::ReadAllText($path)
  $updated = $changes[$relative]
  if ($updated -cne $previous) {
    $backup = Join-Path $backupRoot $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $backup) -Force | Out-Null
    Copy-Item -LiteralPath $path -Destination $backup
    [System.IO.File]::WriteAllText($path, $updated, $encoding)
  }
}
Write-Host "`nApplied targeted source/test fixes; backups: $backupRoot" -ForegroundColor Green
Write-Host 'No .env files, Supabase data, authentication logic, or payment logic modified.'
