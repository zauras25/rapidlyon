$ErrorActionPreference = 'Stop'

$authorizedRef = 'tfsdwfykhufmjtyvlgmn'
$projectRefPath = Join-Path $PWD 'supabase\.temp\project-ref'
$envFilePath = Join-Path $PWD '.env.local'
$billingTestPath = Join-Path $PWD 'supabase\tests\20261102_staging_billing_functional.test.sql'
$rlsTestPath = Join-Path $PWD 'supabase\tests\20261102_staging_rls_isolation.test.sql'
$localPassed = $true
$remoteExecuted = $false
$remoteBlocked = $false

function Import-LocalEnvironment {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) { return }
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*(?<name>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?<value>.*)\s*$') {
      $name = $Matches.name
      $value = $Matches.value.Trim()
      if ($value.Length -ge 2 -and
          (($value.StartsWith('"') -and $value.EndsWith('"')) -or
           ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      if ([string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($name, 'Process'))) {
        [Environment]::SetEnvironmentVariable($name, $value, 'Process')
      }
    }
  }
}

function Test-StagingSupabaseUrl {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) { return $false }
  try { $parsed = [Uri]$Value } catch { return $false }
  return $parsed.Scheme -ceq 'https' -and
    $parsed.Port -eq 443 -and
    $parsed.Host -ceq "$authorizedRef.supabase.co" -and
    $parsed.AbsolutePath -ceq '/' -and
    [string]::IsNullOrEmpty($parsed.UserInfo) -and
    [string]::IsNullOrEmpty($parsed.Query) -and
    [string]::IsNullOrEmpty($parsed.Fragment)
}

function Invoke-VerifiedPsql {
  param(
    [string]$ConnectionUrl,
    [string]$DatabaseUser,
    [string]$Password,
    [string]$SqlFile,
    [string]$SqlCommand
  )

  $previousPassword = $env:PGPASSWORD
  $previousSslMode = $env:PGSSLMODE
  try {
    $env:PGPASSWORD = $Password
    $env:PGSSLMODE = 'require'
    if ($SqlFile) {
      & psql -X --no-psqlrc --set ON_ERROR_STOP=1 --host $ConnectionUrl --port 5432 --username $DatabaseUser --dbname postgres --file $SqlFile
    } else {
      $result = & psql -X --no-psqlrc --set ON_ERROR_STOP=1 --no-align --tuples-only --host $ConnectionUrl --port 5432 --username $DatabaseUser --dbname postgres --command $SqlCommand
      if ($LASTEXITCODE -ne 0) { return $false }
      return (($result | Out-String).Trim() -ceq 'STAGING_VERIFIED')
    }
    return ($LASTEXITCODE -eq 0)
  } finally {
    $env:PGPASSWORD = $previousPassword
    $env:PGSSLMODE = $previousSslMode
  }
}

Import-LocalEnvironment -Path $envFilePath

Write-Host 'Running focused local staging-QA source checks.'
& node --test scripts/staging-integration.test.mjs
if ($LASTEXITCODE -ne 0) {
  Write-Host 'FAIL: focused local staging-QA source checks.' -ForegroundColor Red
  exit 1
}
& node --check scripts/staging-commercial-e2e.mjs
if ($LASTEXITCODE -ne 0) {
  Write-Host 'FAIL: Playwright E2E syntax check.' -ForegroundColor Red
  exit 1
}
Write-Host 'PASS: focused local staging-QA checks and E2E syntax check.' -ForegroundColor Green

$projectRef = ''
if (Test-Path -LiteralPath $projectRefPath) {
  $projectRef = (Get-Content -LiteralPath $projectRefPath -Raw).Trim()
}
if ($projectRef -cne $authorizedRef) {
  Write-Host 'BLOCKED: linked Supabase project ref is missing or does not exactly match the authorized staging ref.' -ForegroundColor Yellow
  exit 1
}

$supabaseUrls = @($env:SUPABASE_URL, $env:NEXT_PUBLIC_SUPABASE_URL)
if ($supabaseUrls.Count -lt 2 -or
    -not (Test-StagingSupabaseUrl -Value $env:SUPABASE_URL) -or
    -not (Test-StagingSupabaseUrl -Value $env:NEXT_PUBLIC_SUPABASE_URL)) {
  Write-Host 'BLOCKED: both server and public Supabase URLs must independently match the authorized staging host.' -ForegroundColor Yellow
  exit 1
}

foreach ($variable in Get-ChildItem Env:) {
  if ($variable.Name -match 'SUPABASE.*URL$' -and
      -not (Test-StagingSupabaseUrl -Value $variable.Value)) {
    Write-Host 'BLOCKED: an additional Supabase URL is missing, malformed, or points outside staging.' -ForegroundColor Yellow
    exit 1
  }
}

$sqlApproved = $env:RAPIDLYON_STAGING_QA_APPROVED -ceq 'true' -and
  $env:RAPIDLYON_STAGING_SQL_WRITE_APPROVED -ceq 'true'
$e2eApproved = $env:RAPIDLYON_STAGING_QA_APPROVED -ceq 'true' -and
  $env:RAPIDLYON_STAGING_E2E_APPROVED -ceq 'true'

if ($sqlApproved) {
  $databaseUrl = $env:SUPABASE_DB_URL
  $databaseUri = $null
  $databaseQuery = ''
  if (-not [string]::IsNullOrWhiteSpace($databaseUrl)) {
    try { $databaseUri = [Uri]$databaseUrl } catch { $databaseUri = $null }
  }
  if ($null -ne $databaseUri) { $databaseQuery = $databaseUri.Query.TrimStart('?') }
  if ($null -eq $databaseUri -or
      $databaseUri.Scheme -notin @('postgres', 'postgresql') -or
      $databaseUri.Host -cne "db.$authorizedRef.supabase.co" -or
      $databaseUri.AbsolutePath.Trim('/') -cne 'postgres' -or
      $databaseUri.Port -ne 5432 -or
      $databaseQuery -notmatch '(^|&)sslmode=require(&|$)' -or
      [string]::IsNullOrEmpty($databaseUri.UserInfo)) {
    Write-Host 'BLOCKED: SUPABASE_DB_URL must use the exact staging direct-DB host, postgres database, credentials, and sslmode=require.' -ForegroundColor Yellow
    $remoteBlocked = $true
  } elseif (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Host 'BLOCKED: psql is required for remote SQL tests and is not installed.' -ForegroundColor Yellow
    $remoteBlocked = $true
  } else {
    $userInfo = $databaseUri.UserInfo.Split(':', 2)
    if ($userInfo.Count -ne 2) {
      Write-Host 'BLOCKED: database URL does not contain a complete PostgreSQL username and password.' -ForegroundColor Yellow
      $remoteBlocked = $true
    } else {
      $databaseUser = [Uri]::UnescapeDataString($userInfo[0])
      $databasePassword = [Uri]::UnescapeDataString($userInfo[1])
      if ($databaseUser -cne 'postgres' -or [string]::IsNullOrWhiteSpace($databasePassword)) {
        Write-Host 'BLOCKED: direct database credentials are not in the expected staging postgres format.' -ForegroundColor Yellow
        $remoteBlocked = $true
      } else {
        $identityQuery = "SELECT CASE WHEN current_database() = 'postgres' AND current_user = 'postgres' AND to_regclass('supabase_migrations.schema_migrations') IS NOT NULL AND (SELECT count(*) FROM supabase_migrations.schema_migrations) = 33 THEN 'STAGING_VERIFIED' ELSE 'STAGING_MISMATCH' END"
        if (-not (Invoke-VerifiedPsql -ConnectionUrl $databaseUri.Host -DatabaseUser $databaseUser -Password $databasePassword -SqlCommand $identityQuery)) {
          Write-Host 'BLOCKED: PostgreSQL connection did not verify the exact staging identity and migration state; no SQL suites ran.' -ForegroundColor Yellow
          $remoteBlocked = $true
        } else {
          $remoteExecuted = $true
          Write-Host 'PASS: direct PostgreSQL connection authenticated on the exact staging host; 33 migrations are present.' -ForegroundColor Green
          foreach ($testPath in @($billingTestPath, $rlsTestPath)) {
            if (-not (Test-Path -LiteralPath $testPath)) {
              Write-Host 'FAIL: a required transactional SQL test file is missing.' -ForegroundColor Red
              $remoteBlocked = $true
              break
            }
            if (-not (Invoke-VerifiedPsql -ConnectionUrl $databaseUri.Host -DatabaseUser $databaseUser -Password $databasePassword -SqlFile $testPath)) {
              Write-Host "FAIL: transactional SQL test failed: $([IO.Path]::GetFileName($testPath))" -ForegroundColor Red
              $remoteBlocked = $true
              break
            }
            Write-Host "PASS: transactional SQL suite completed: $([IO.Path]::GetFileName($testPath))" -ForegroundColor Green
          }
        }
      }
    }
  }
} else {
  Write-Host 'BLOCKED: SQL suites perform transactional fixture writes and require both RAPIDLYON_STAGING_QA_APPROVED=true and RAPIDLYON_STAGING_SQL_WRITE_APPROVED=true.' -ForegroundColor Yellow
  $remoteBlocked = $true
}

if ($e2eApproved) {
  $remoteExecuted = $true
  & node scripts/staging-commercial-e2e.mjs
  if ($LASTEXITCODE -eq 2) {
    Write-Host 'BLOCKED: authenticated Playwright E2E did not complete because an execution prerequisite is unavailable.' -ForegroundColor Yellow
    $remoteBlocked = $true
  } elseif ($LASTEXITCODE -ne 0) {
    Write-Host 'FAIL: authenticated Playwright E2E assertions failed.' -ForegroundColor Red
    $remoteBlocked = $true
  }
} else {
  Write-Host 'BLOCKED: authenticated E2E requires RAPIDLYON_STAGING_QA_APPROVED=true and RAPIDLYON_STAGING_E2E_APPROVED=true.' -ForegroundColor Yellow
  $remoteBlocked = $true
}

if (-not $remoteExecuted -or $remoteBlocked) {
  Write-Host 'Staging QA is BLOCKED or failed; no migration, reset, seed, or destructive command was run.' -ForegroundColor Yellow
  exit 1
}

Write-Host 'PASS: all explicitly approved staging QA suites completed.' -ForegroundColor Green
exit 0
