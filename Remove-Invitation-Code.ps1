$ErrorActionPreference = 'Stop'
$path = Join-Path (Get-Location) 'src\components\console\client-console.tsx'
if (!(Test-Path -LiteralPath $path)) { throw "STOP: Missing $path" }
$text = [System.IO.File]::ReadAllText($path)
$start = $text.IndexOf('function InvitationPage()')
$end = $text.IndexOf('function BillingList(', $start)
if ($start -lt 0 -or $end -le $start) { throw 'STOP: InvitationPage boundaries not found. No changes made.' }
$section = $text.Substring($start, $end - $start)
$statePattern = 'const\s*\[token\s*,\s*setToken\]\s*=\s*useState\(query\.get\(''token''\)\s*\|\|\s*''''\);?'
$inputPattern = '<label\s+className="form-field">\s*<span>Invitation code</span>\s*<input\s+value=\{token\}\s+onChange=\{e=>setToken\(e\.target\.value\)\}\s+required\s+minLength=\{32\}\s+placeholder="Your invitation code"\s*/>\s*</label>'
$stateMatch = [regex]::Matches($section, $statePattern)
$inputMatch = [regex]::Matches($section, $inputPattern)
if ($stateMatch.Count -ne 1 -or $inputMatch.Count -ne 1) {
  throw "STOP: Expected exactly one token state and one manual code field. Found state=$($stateMatch.Count), field=$($inputMatch.Count). No changes made."
}
if ($section -notmatch 'disabled=\{busy\}') { throw 'STOP: Accept button pattern changed. No changes made.' }
$section = [regex]::Replace($section, $statePattern, "const token=query.get('token')||'';", 1)
$section = [regex]::Replace($section, $inputPattern, '{!token&&<div className="form-result error" role="status">Open the secure invitation link sent to your email. No code entry is required.</div>}', 1)
$section = $section.Replace('disabled={busy}', 'disabled={busy||!token}')
if ($section -match 'setToken|<span>Invitation code</span>') { throw 'STOP: Manual input references remain. No changes made.' }
$updated = $text.Substring(0, $start) + $section + $text.Substring($end)
$backup = "$path.before-code-removal-$(Get-Date -Format 'yyyyMMdd-HHmmss').bak"
Copy-Item -LiteralPath $path -Destination $backup -ErrorAction Stop
[System.IO.File]::WriteAllText($path, $updated, [System.Text.UTF8Encoding]::new($false))
Write-Host "UPDATED: $path" -ForegroundColor Green
Write-Host "BACKUP: $backup"
Write-Host 'Manual invitation code field removed. Token is now read from email-link URL only.'
Write-Host 'Running ESLint and TypeScript checks...'
& npm run lint
if ($LASTEXITCODE -ne 0) { throw 'ESLint failed. Restore from the backup before continuing.' }
& npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript failed. Restore from the backup before continuing.' }
Write-Host 'VERIFIED: Lint and TypeScript passed.' -ForegroundColor Green
& git status --short
