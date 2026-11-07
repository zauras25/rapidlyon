$ErrorActionPreference = 'Stop'
$root = 'C:\Users\M.Zohaib\Desktop\rapidlyon-clean'
if (!(Test-Path (Join-Path $root 'package.json'))) { throw 'STOP: RapidlyOn project not found.' }
$files = @(
  @{ Rel = 'src\app\api\admin\pipeline-counts\route.ts';
     ImportOld = 'import { getSupabaseServerConfig } from "@/lib/supabase-server";';
     ImportNew = 'import { getSupabaseServerConfig, supabaseServerHeaders } from "@/lib/supabase-server";';
     Old = @'
headers: {
        apikey: config!.serviceRoleKey, Authorization: `Bearer ${config!.serviceRoleKey}`,
        Prefer: "count=exact", "Range-Unit": "items", Range: "0-0",
      },
'@;
     New = @'
headers: supabaseServerHeaders(config!, {
        Prefer: "count=exact", "Range-Unit": "items", Range: "0-0",
      }),
'@
  },
  @{ Rel = 'src\app\api\admin\inquiries\route.ts';
     ImportOld = 'import { getSupabaseServerConfig } from "@/lib/supabase-server";';
     ImportNew = 'import { getSupabaseServerConfig, supabaseServerHeaders } from "@/lib/supabase-server";';
     Old = 'headers:{apikey:config.serviceRoleKey,Authorization:`Bearer ${config.serviceRoleKey}`}';
     New = 'headers:supabaseServerHeaders(config)'
  }
)
# Verify all targets BEFORE touching files.
foreach ($f in $files) {
  $path = Join-Path $root $f.Rel
  if (!(Test-Path $path)) { throw "STOP: Missing $($f.Rel)" }
  $content = [IO.File]::ReadAllText($path).Replace("`r`n", "`n")
  if (!$content.Contains($f.ImportOld) -or !$content.Contains($f.Old)) {
    throw "STOP: Unexpected source version for $($f.Rel). No files changed."
  }
  if ($content.Contains('supabaseServerHeaders')) { throw "STOP: Already patched $($f.Rel)" }
}
$backup = Join-Path $root ('qa-results\api-header-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
foreach ($f in $files) {
  $path = Join-Path $root $f.Rel
  $destination = Join-Path $backup $f.Rel
  New-Item -ItemType Directory -Force -Path (Split-Path $destination) | Out-Null
  Copy-Item -LiteralPath $path -Destination $destination
  $content = [IO.File]::ReadAllText($path).Replace("`r`n", "`n")
  $content = $content.Replace($f.ImportOld, $f.ImportNew).Replace($f.Old, $f.New)
  [IO.File]::WriteAllText($path, $content, [Text.UTF8Encoding]::new($false))
  Write-Host "PATCHED: $($f.Rel)" -ForegroundColor Green
}
Write-Host "BACKUP: $backup"
Write-Host 'No database queries or migrations executed.' -ForegroundColor Cyan
