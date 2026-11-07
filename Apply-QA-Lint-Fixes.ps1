param([string]$ProjectRoot = 'C:\Users\M.Zohaib\Desktop\rapidlyon-clean')
$ErrorActionPreference = 'Stop'
if (!(Test-Path (Join-Path $ProjectRoot 'package.json'))) { throw 'STOP: Invalid project path' }
$utf8 = [System.Text.UTF8Encoding]::new($false)
function Unpack([string]$encoded) { return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded)) }
$changes = @()

$changes += [pscustomobject]@{ File = 'src/components/console/admin-workspaces.tsx'; Old = (Unpack 'dXNlRWZmZWN0KCgpPT57dm9pZCByZWxvYWQoKX0sW3JlbG9hZF0pO3JldHVybiB7ZGF0YSxsb2FkaW5nLGVycm9yLHJlbG9hZH07'); New = (Unpack 'dXNlRWZmZWN0KCgpPT57Y29uc3QgdGltZXI9d2luZG93LnNldFRpbWVvdXQoKCk9Pnt2b2lkIHJlbG9hZCgpfSwwKTtyZXR1cm4gKCk9PndpbmRvdy5jbGVhclRpbWVvdXQodGltZXIpfSxbcmVsb2FkXSk7cmV0dXJuIHtkYXRhLGxvYWRpbmcsZXJyb3IscmVsb2FkfTs=') }
$changes += [pscustomobject]@{ File = 'src/components/console/admin-workspaces.tsx'; Old = (Unpack 'IHVzZUVmZmVjdCgoKT0+e2lmKGRhdGEuc2V0dGluZ3MmJnR5cGVvZiBkYXRhLnNldHRpbmdzPT09J29iamVjdCcmJiFkaXJ0eSl7Y29uc3Qgcz1kYXRhLnNldHRpbmdzIGFzIFJlY29yZFJvdztzZXRGb3JtKHtidXNpbmVzc19uYW1lOnN0cihzLmJ1c2luZXNzX25hbWUpLGNvbnRhY3RfZW1haWw6dHlwZW9mIHMuY29udGFjdF9lbWFpbD09PSdzdHJpbmcnP3MuY29udGFjdF9lbWFpbDonJyxwdWJsaWNfd2Vic2l0ZTp0eXBlb2Ygcy5wdWJsaWNfd2Vic2l0ZT09PSdzdHJpbmcnP3MucHVibGljX3dlYnNpdGU6JycsZGlzcGxheV9jdXJyZW5jeTpzdHIocy5kaXNwbGF5X2N1cnJlbmN5KSxkaWdlc3RfZnJlcXVlbmN5OnN0cihzLmRpZ2VzdF9mcmVxdWVuY3kpLHJvdXRpbmVfZW1haWxfYWxlcnRzOnMucm91dGluZV9lbWFpbF9hbGVydHM9PT10cnVlfSk7c2V0SW5pdGlhbGl6ZWQodHJ1ZSl9fSxbZGF0YSxkaXJ0eV0pOw=='); New = (Unpack 'IHVzZUVmZmVjdCgoKT0+e2NvbnN0IHRpbWVyPXdpbmRvdy5zZXRUaW1lb3V0KCgpPT57aWYoZGF0YS5zZXR0aW5ncyYmdHlwZW9mIGRhdGEuc2V0dGluZ3M9PT0nb2JqZWN0JyYmIWRpcnR5KXtjb25zdCBzPWRhdGEuc2V0dGluZ3MgYXMgUmVjb3JkUm93O3NldEZvcm0oe2J1c2luZXNzX25hbWU6c3RyKHMuYnVzaW5lc3NfbmFtZSksY29udGFjdF9lbWFpbDp0eXBlb2Ygcy5jb250YWN0X2VtYWlsPT09J3N0cmluZyc/cy5jb250YWN0X2VtYWlsOicnLHB1YmxpY193ZWJzaXRlOnR5cGVvZiBzLnB1YmxpY193ZWJzaXRlPT09J3N0cmluZyc/cy5wdWJsaWNfd2Vic2l0ZTonJyxkaXNwbGF5X2N1cnJlbmN5OnN0cihzLmRpc3BsYXlfY3VycmVuY3kpLGRpZ2VzdF9mcmVxdWVuY3k6c3RyKHMuZGlnZXN0X2ZyZXF1ZW5jeSkscm91dGluZV9lbWFpbF9hbGVydHM6cy5yb3V0aW5lX2VtYWlsX2FsZXJ0cz09PXRydWV9KTtzZXRJbml0aWFsaXplZCh0cnVlKX19LDApO3JldHVybiAoKT0+d2luZG93LmNsZWFyVGltZW91dCh0aW1lcil9LFtkYXRhLGRpcnR5XSk7') }
$changes += [pscustomobject]@{ File = 'src/components/forms/public-forms.tsx'; Old = (Unpack 'ICB1c2VFZmZlY3QoKCkgPT4gewogICAgbGV0IG1vdW50ZWQgPSB0cnVlOwogICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh3aW5kb3cubG9jYXRpb24uc2VhcmNoKTs='); New = (Unpack 'ICB1c2VFZmZlY3QoKCkgPT4gewogICAgbGV0IG1vdW50ZWQgPSB0cnVlOwogICAgY29uc3QgdGltZXIgPSB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7CiAgICBpZiAoIW1vdW50ZWQpIHJldHVybjsKICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMod2luZG93LmxvY2F0aW9uLnNlYXJjaCk7') }
$changes += [pscustomobject]@{ File = 'src/components/forms/public-forms.tsx'; Old = (Unpack 'ICAgIHJldHVybiAoKSA9PiB7IG1vdW50ZWQgPSBmYWxzZTsgfTsKICB9LCBbXSk7'); New = (Unpack 'ICAgIH0sIDApOwogICAgcmV0dXJuICgpID0+IHsgbW91bnRlZCA9IGZhbHNlOyB3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVyKTsgfTsKICB9LCBbXSk7') }
$changes += [pscustomobject]@{ File = 'src/components/forms/public-forms.tsx'; Old = (Unpack 'aW1wb3J0IHsgZ2V0RW5nYWdlbWVudE9wdGlvbiB9IGZyb20gJ0AvZGF0YS9lbmdhZ2VtZW50LW9wdGlvbnMnOw=='); New = (Unpack 'aW1wb3J0IHsgZ2V0RW5nYWdlbWVudE9wdGlvbiB9IGZyb20gJ0AvZGF0YS9lbmdhZ2VtZW50LW9wdGlvbnMnOwppbXBvcnQgeyB1c2VSb3V0ZXIgfSBmcm9tICduZXh0L25hdmlnYXRpb24nOw==') }
$changes += [pscustomobject]@{ File = 'src/components/forms/public-forms.tsx'; Old = (Unpack 'ZXhwb3J0IGZ1bmN0aW9uIElucXVpcnlGb3JtKCkgew=='); New = (Unpack 'ZXhwb3J0IGZ1bmN0aW9uIElucXVpcnlGb3JtKCkgewogIGNvbnN0IHJvdXRlciA9IHVzZVJvdXRlcigpOw==') }
$changes += [pscustomobject]@{ File = 'src/components/forms/public-forms.tsx'; Old = (Unpack 'd2luZG93LmxvY2F0aW9uLmhyZWYgPSAnL2Rpc2NvdmVyeSc7'); New = (Unpack 'cm91dGVyLnB1c2goJy9kaXNjb3ZlcnknKTs=') }
$changes += [pscustomobject]@{ File = 'src/components/console/agreement-acceptance.tsx'; Old = (Unpack 'PlNpZ25lcidzIHJvbGUgLyBhdXRob3JpdHkgKjw='); New = (Unpack 'PlNpZ25lciZhcG9zO3Mgcm9sZSAvIGF1dGhvcml0eSAqPA==') }

$files = @{}
foreach ($change in $changes) {
  $full = Join-Path $ProjectRoot ($change.File -replace '/', [IO.Path]::DirectorySeparatorChar)
  if (!$files.ContainsKey($full)) { $files[$full] = [IO.File]::ReadAllText($full) }
  $current = $files[$full]
  $occurrences = ([regex]::Matches($current, [regex]::Escape($change.Old))).Count
  if ($occurrences -ne 1) {
    if ($current.Contains($change.New)) { throw "STOP: Partially applied patch or already applied: $($change.File). Do not apply twice." }
    throw "STOP: Source has changed, expected exact anchor in $($change.File) (found $occurrences). No files modified."
  }
  $files[$full] = $current.Replace($change.Old, $change.New)
}
$backup = Join-Path $ProjectRoot ('qa-results\lint-backup-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $backup -Force | Out-Null
foreach ($path in $files.Keys) {
  $rel = $path.Substring($ProjectRoot.TrimEnd('\').Length).TrimStart('\')
  $target = Join-Path $backup $rel
  New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
  Copy-Item -LiteralPath $path -Destination $target
}
foreach ($path in $files.Keys) { [IO.File]::WriteAllText($path, $files[$path], $utf8) }
Write-Host 'SUCCESS: Four targeted source changes applied to three files.' -ForegroundColor Green
Write-Host "Backups: $backup"
Write-Host 'No secrets, auth, Supabase, migrations, or payment code modified.'
