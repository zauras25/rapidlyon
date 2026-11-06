$ErrorActionPreference = 'Stop'
$root = 'C:\Users\M.Zohaib\Desktop\rapidlyon-clean'
Set-Location -LiteralPath $root
if ((git branch --show-current).Trim() -ne 'cleanup/rapidlyon-structure') { throw 'STOP: Wrong Git branch' }
if (((git rev-parse --show-toplevel).Trim().Replace('\','/')) -ne ($root.Replace('\','/'))) { throw 'STOP: Wrong repository' }
$workFile = 'src/app/work/page.tsx'
$headerFile = 'src/components/site/chrome.tsx'
$cssFile = 'src/app/globals.css'
foreach ($p in @($workFile,$headerFile,$cssFile)) { if (!(Test-Path -LiteralPath $p)) { throw "Missing $p" } }
$enc = New-Object System.Text.UTF8Encoding($false)
function WriteUtf8([string]$p,[string]$s) { [System.IO.File]::WriteAllText((Join-Path (Get-Location).Path $p),$s,$enc) }
# Remove a second full <main>/<h1> tree from the streamed Work route fallback.
$work = [System.IO.File]::ReadAllText((Join-Path $root $workFile))
$old = '<Suspense fallback={<WorkPage projects={[]} />}>'
$new = '<Suspense fallback={<div className="shell" role="status" aria-live="polite">Loading published work…</div>}>'
if ($work.Contains($old)) { WriteUtf8 $workFile ($work.Replace($old,$new)); Write-Host 'FIX /work: duplicate fallback landmark removed' -ForegroundColor Green }
elseif ($work.Contains($new)) { Write-Host 'Already fixed /work' }
else { throw 'STOP: unexpected /work markup; no partial patch applied' }
# Mobile menu trigger should return focus to trigger after Escape; already implemented.
# Improve accessibility of footer interactive links using dedicated CSS only; no global type scale changes.
$css = [System.IO.File]::ReadAllText((Join-Path $root $cssFile))
$marker = '/* RapidlyOn QA: footer and navigation minimum hit areas */'
$addition = @'

/* RapidlyOn QA: footer and navigation minimum hit areas */
.footer-social a,
.footer-legal a,
.footer-column a,
.mobile-menu a,
.nav-actions > a {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.footer-social a {
  min-width: 44px;
  justify-content: center;
}

'@
if (!$css.Contains($marker)) { WriteUtf8 $cssFile ($css + $addition); Write-Host 'FIX: minimum hit areas for navigation/footer controls' -ForegroundColor Green }
else { Write-Host 'Hit-area CSS already present' }
Write-Host '`n=== PATCH REVIEW ==='
git diff --stat
Write-Host '`n=== TESTS: TYPESCRIPT ==='
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) { throw 'TypeScript validation failed' }
Write-Host '`n=== TESTS: LINT ==='
npm run lint
if ($LASTEXITCODE -ne 0) { throw 'Lint validation failed' }
Write-Host '`n=== TESTS: PRODUCTION BUILD ==='
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Production build failed' }
Write-Host '`n=== TESTS: SOURCE INTEGRATION ==='
npm run test:staging
if ($LASTEXITCODE -ne 0) { throw 'Source integration tests failed' }
Write-Host '`n=== BROWSER AUDIT (requires server on localhost:3000) ==='
try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 4; $available=($r.StatusCode -eq 200) } catch { $available=$false }
if ($available) {
  node scripts/qa-fix-verification.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Browser QA detected findings: inspect qa-artifacts/qa-fixes/report.json' }
} else {
  Write-Warning 'Browser QA not run: start `npm run start -- -p 3000` in another terminal, then run `node scripts/qa-fix-verification.mjs`.'
}
Write-Host 'QA PATCH AND AVAILABLE TESTS COMPLETED — review results before commit' -ForegroundColor Green
