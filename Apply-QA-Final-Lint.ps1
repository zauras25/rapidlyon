param([string]$ProjectRoot = 'C:\Users\M.Zohaib\Desktop\rapidlyon-clean')
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $ProjectRoot -ErrorAction Stop).Path
if (!(Test-Path (Join-Path $root 'package.json'))) { throw 'STOP: package.json missing.' }
$utf8 = [System.Text.UTF8Encoding]::new($false)
$targets = @(
    'scripts/admin-locked-decisions.test.mjs',
    'src/components/console/admin-console.tsx',
    'src/components/console/admin-workspaces.tsx'
)
$original = @{}
$updated = @{}
foreach ($rel in $targets) {
    $path = Join-Path $root ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
    if (!(Test-Path -LiteralPath $path)) { throw "STOP: Missing $rel. No files changed." }
    $original[$rel] = [IO.File]::ReadAllText($path)
    $updated[$rel] = $original[$rel]
}
function Replace-Checked([string]$rel, [string]$from, [string]$to, [int]$expected = 1) {
    $content = $script:updated[$rel]
    $count = ([regex]::Matches($content, [regex]::Escape($from))).Count
    if ($count -ne $expected) { throw "STOP: Unexpected source version in $rel. Anchor count $count (expected $expected). No files changed." }
    $script:updated[$rel] = $content.Replace($from, $to)
}
$test = 'scripts/admin-locked-decisions.test.mjs'
Replace-Checked $test "for(const module of ['Operations Inbox'" "for(const navItem of ['Operations Inbox'"
Replace-Checked $test 'app.includes(module),`Missing navigation item: ${module}`' 'app.includes(navItem),`Missing navigation item: ${navItem}`'
Replace-Checked $test "for(const module of ['DeliveryProjects'" "for(const componentName of ['DeliveryProjects'"
Replace-Checked $test 'app.includes(`<${module}/>`)' 'app.includes(`<${componentName}/>`)'
$console = 'src/components/console/admin-console.tsx'
Replace-Checked $console '},[section,archived]);' '},[section,archived,segment]);'
$workspaces = 'src/components/console/admin-workspaces.tsx'
Replace-Checked $workspaces 'ArrowRight,CheckCircle2,ClipboardCheck' 'ArrowRight,ClipboardCheck'
Replace-Checked $workspaces 'LoaderCircle,Search,ShieldCheck' 'LoaderCircle,ShieldCheck'
# Files are backed up outside the TS source tree, and originals are never deleted.
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $root "qa-results\final-lint-backup-$stamp"
foreach ($rel in $targets) {
    $dest = Join-Path $backup ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
    New-Item -ItemType Directory -Force -Path (Split-Path $dest -Parent) | Out-Null
    [IO.File]::WriteAllText($dest, $original[$rel], $utf8)
}
foreach ($rel in $targets) {
    $path = Join-Path $root ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
    [IO.File]::WriteAllText($path, $updated[$rel], $utf8)
}
Write-Host 'SUCCESS: 5 targeted lint findings fixed in 3 files.' -ForegroundColor Green
Write-Host "Backups: $backup"
Write-Host 'No authentication, payment, database, or environment files changed.'
