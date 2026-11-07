$ErrorActionPreference = 'Stop'
$project = 'C:\Users\M.Zohaib\Desktop\rapidlyon-clean'
if (!(Test-Path -LiteralPath $project)) { throw "Project not found: $project" }
Set-Location -LiteralPath $project
$relative = 'src\components\console\client-console.tsx'
$path = Join-Path $project $relative
if (!(Test-Path -LiteralPath $path)) { throw "Missing $relative" }
$text = [IO.File]::ReadAllText($path)
$start = $text.IndexOf('function InvitationPage()')
$end = if ($start -ge 0) { $text.IndexOf('function BillingList(', $start) } else { -1 }
if ($start -lt 0 -or $end -le $start) { throw 'InvitationPage section not found. No changes made.' }
$section = $text.Substring($start, $end-$start)
if ($section.Contains('Invitation code')) {
  $state = 'const\s*\[token\s*,\s*setToken\]\s*=\s*useState\(query\.get\(''token''\)\s*\|\|\s*''''\);?'
  $field = '<label\s+className="form-field">\s*<span>Invitation code</span>\s*<input\b[^>]*\bvalue=\{token\}[^>]*\/>(?:\s*)<\/label>'
  if ([regex]::Matches($section,$state).Count -ne 1 -or [regex]::Matches($section,$field).Count -ne 1) {
    throw 'STOP: UI differs from expected structure. No changes made. Please share InvitationPage source.'
  }
  $section = [regex]::Replace($section,$state,"const token=query.get('token')||'';", [Text.RegularExpressions.RegexOptions]::None)
  $section = [regex]::Replace($section,$field,'{!token&&<div className="form-result error" role="status">Open the secure project invitation link from your email. No code is required.</div>}', [Text.RegularExpressions.RegexOptions]::None)
  if (!$section.Contains('disabled={busy}')) { throw 'STOP: Accept button structure differs. No changes made.' }
  $section = $section.Replace('disabled={busy}', 'disabled={busy||!token}')
  if ($section.Contains('setToken') -or $section.Contains('Invitation code')) { throw 'STOP: Manual token field still present. No changes made.' }
  $updated = $text.Substring(0,$start)+$section+$text.Substring($end)
  $backupDir = Join-Path $HOME ('RapidlyOn-Invitation-UI-Backup-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
  New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
  $backup = Join-Path $backupDir 'client-console.tsx'
  Copy-Item -LiteralPath $path -Destination $backup -ErrorAction Stop
  [IO.File]::WriteAllText($path,$updated,[Text.UTF8Encoding]::new($false))
  Write-Host "UPDATED: $relative" -ForegroundColor Green
  Write-Host "BACKUP: $backup"
} else {
  Write-Host 'No Invitation code label found in current InvitationPage. Checking for stale server/browser build.' -ForegroundColor Yellow
}
$newtext = [IO.File]::ReadAllText($path)
$secStart = $newtext.IndexOf('function InvitationPage()')
$secEnd = $newtext.IndexOf('function BillingList(', $secStart)
$sec = $newtext.Substring($secStart,$secEnd-$secStart)
if ($sec.Contains('Invitation code')) { throw 'Verification failed: code label still present.' }
if (!$sec.Contains("query.get('token')")) { throw 'Verification failed: token is not read from link.' }
Write-Host 'Verified: no manual code input; token read from URL.' -ForegroundColor Green
Write-Host 'Running lint and TypeScript...'
& npm run lint
if ($LASTEXITCODE -ne 0) { throw 'Lint failed. Restore from backup and inspect output.' }
& npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript failed. Restore from backup and inspect output.' }
Write-Host 'PASS: lint + TypeScript.' -ForegroundColor Green
& git status --short
Write-Host 'Restart Next.js dev server and hard refresh the client invitation page (Ctrl+Shift+R).' -ForegroundColor Cyan
