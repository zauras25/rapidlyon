$ErrorActionPreference = 'Stop'

$authorizedRef = 'tfsdwfykhufmjtyvlgmn'
$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root '.env.local'
$gitignorePath = Join-Path $root '.gitignore'
$projectRefPath = Join-Path $root 'supabase\.temp\project-ref'

function Read-EnvFile {
  param([string]$Path)

  $values = @{}
  $duplicates = New-Object 'System.Collections.Generic.HashSet[string]'
  if (-not (Test-Path $Path)) {
    return [pscustomobject]@{ Values = $values; Duplicates = $duplicates }
  }

  foreach ($line in Get-Content -Path $Path) {
    $trimmed = $line.Trim()
    if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) {
      continue
    }

    $parts = $trimmed.Split('=', 2)
    if ($parts.Length -ne 2) {
      continue
    }

    $name = $parts[0].Trim()
    if ($values.ContainsKey($name)) {
      [void]$duplicates.Add($name)
    }
    $values[$name] = $parts[1].Trim()
  }

  return [pscustomobject]@{ Values = $values; Duplicates = $duplicates }
}

function Get-UrlStatus {
  param(
    [string]$Value,
    [string]$ExpectedRef
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return @{ Valid = 'INVALID'; Staging = 'MISMATCH' }
  }

  try {
    $uri = [System.Uri]$Value
    $hostname = $uri.Host.ToLowerInvariant()
    $isStageHost = $hostname -eq "$ExpectedRef.supabase.co"
    $isHttps = $uri.Scheme -eq 'https' -and
      $uri.Port -eq 443 -and
      -not $uri.UserInfo -and
      $uri.AbsolutePath -eq '/' -and
      -not $uri.Query -and
      -not $uri.Fragment
    return @{
      Valid = if ($isHttps -and $isStageHost) { 'VALID' } else { 'INVALID' }
      Staging = if ($isStageHost) { 'STAGING MATCH' } else { 'MISMATCH' }
    }
  } catch {
    return @{ Valid = 'INVALID'; Staging = 'MISMATCH' }
  }
}

function Get-DatabaseUrlStatus {
  param([string]$Value, [string]$ExpectedRef)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return @{ Valid = 'INVALID'; Staging = 'MISMATCH' }
  }
  try {
    $uri = [System.Uri]$Value
    $query = $uri.Query.TrimStart('?')
    $credentials = $uri.UserInfo.Split(':', 2)
    $username = if ($credentials.Count -gt 0) { [System.Uri]::UnescapeDataString($credentials[0]) } else { '' }
    $passwordPresent = $credentials.Count -eq 2 -and
      -not [string]::IsNullOrWhiteSpace([System.Uri]::UnescapeDataString($credentials[1]))
    $matchesStage = $uri.Host -ceq "db.$ExpectedRef.supabase.co"
    $valid = $matchesStage -and
      $uri.Scheme -in @('postgres', 'postgresql') -and
      $uri.AbsolutePath.Trim('/') -ceq 'postgres' -and
      $uri.Port -eq 5432 -and
      $query -match '(^|&)sslmode=require(&|$)' -and
      $username -ceq 'postgres' -and
      $passwordPresent -and
      -not $uri.Fragment
    return @{
      Valid = if ($valid) { 'VALID' } else { 'INVALID' }
      Staging = if ($matchesStage) { 'STAGING MATCH' } else { 'MISMATCH' }
    }
  } catch {
    return @{ Valid = 'INVALID'; Staging = 'MISMATCH' }
  }
}

function Get-SiteUrlStatus {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return @{ Valid = 'INVALID'; Staging = 'MISMATCH' }
  }
  try {
    $uri = [System.Uri]$Value
    $local = $uri.Host -in @('localhost', '127.0.0.1')
    $stageHost = $local -or $uri.Host -match '(^|[.-])staging([.-]|$)'
    $valid = $stageHost -and
      ($uri.Scheme -eq 'https' -or ($local -and $uri.Scheme -eq 'http')) -and
      -not $uri.UserInfo
    return @{
      Valid = if ($valid) { 'VALID' } else { 'INVALID' }
      Staging = if ($stageHost) { 'STAGING MATCH' } else { 'MISMATCH' }
    }
  } catch {
    return @{ Valid = 'INVALID'; Staging = 'MISMATCH' }
  }
}

function Test-SupabaseKey {
  param(
    [string]$Key,
    [string]$Url,
    [ValidateSet('service', 'publishable')]
    [string]$KeyType
  )

  if ([string]::IsNullOrWhiteSpace($Key) -or [string]::IsNullOrWhiteSpace($Url)) {
    return @{ Authenticity = 'UNVERIFIED'; Status = $null }
  }

  Add-Type -AssemblyName System.Net.Http
  $client = New-Object System.Net.Http.HttpClient
  $client.Timeout = [TimeSpan]::FromSeconds(15)
  $lastStatus = $null

  try {
    if ($KeyType -eq 'service' -and $Key.StartsWith('sb_secret_')) {
      $authModes = @('apikey-only')
    } elseif ($KeyType -eq 'service') {
      $authModes = @('bearer-and-apikey', 'apikey-only')
    } else {
      $authModes = @('apikey-only')
    }

    foreach ($authMode in $authModes) {
      $request = New-Object System.Net.Http.HttpRequestMessage(
        [System.Net.Http.HttpMethod]::Get,
        "$Url/auth/v1/settings"
      )
      [void]$request.Headers.TryAddWithoutValidation('apikey', $Key)
      if ($authMode -eq 'bearer-and-apikey') {
        [void]$request.Headers.TryAddWithoutValidation('Authorization', "Bearer $Key")
      }

      try {
        $response = $client.SendAsync($request).GetAwaiter().GetResult()
        $lastStatus = [int]$response.StatusCode
        $response.Dispose()
        if ($lastStatus -ge 200 -and $lastStatus -lt 300) {
          return @{ Authenticity = 'VERIFIED'; Status = $lastStatus }
        }
      } catch {
        continue
      } finally {
        $request.Dispose()
      }
    }
  } finally {
    $client.Dispose()
  }

  return @{ Authenticity = 'UNVERIFIED'; Status = $lastStatus }
}

$envFile = Read-EnvFile -Path $envPath
$envValues = $envFile.Values
$projectRef = if (Test-Path $projectRefPath) { (Get-Content -Path $projectRefPath -Raw).Trim() } else { '' }
$gitignoreText = if (Test-Path $gitignorePath) { Get-Content -Path $gitignorePath -Raw } else { '' }
$serviceUrlStatus = Get-UrlStatus -Value $envValues['SUPABASE_URL'] -ExpectedRef $authorizedRef
$publicUrlStatus = Get-UrlStatus -Value $envValues['NEXT_PUBLIC_SUPABASE_URL'] -ExpectedRef $authorizedRef
$databaseUrlStatus = Get-DatabaseUrlStatus -Value $envValues['SUPABASE_DB_URL'] -ExpectedRef $authorizedRef
$siteUrlStatus = Get-SiteUrlStatus -Value $envValues['STAGING_SITE_URL']
$linkedRefMatches = $projectRef -eq $authorizedRef
$additionalUrlNames = @($envValues.Keys | Where-Object {
  $_ -match 'SUPABASE.*URL$' -and $_ -notin @('SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_DB_URL')
})
$additionalUrlsMatch = @($additionalUrlNames | Where-Object {
  (Get-UrlStatus -Value $envValues[$_] -ExpectedRef $authorizedRef).Staging -ne 'STAGING MATCH'
}).Count -eq 0

$serviceVerification = @{ Authenticity = 'UNVERIFIED'; Status = $null }
$publishableVerification = @{ Authenticity = 'UNVERIFIED'; Status = $null }
if ($linkedRefMatches -and $serviceUrlStatus.Staging -eq 'STAGING MATCH' -and $publicUrlStatus.Staging -eq 'STAGING MATCH') {
  $serviceVerification = Test-SupabaseKey -Key $envValues['SUPABASE_SERVICE_ROLE_KEY'] -Url $envValues['SUPABASE_URL'] -KeyType 'service'
  $publishableVerification = Test-SupabaseKey -Key $envValues['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] -Url $envValues['NEXT_PUBLIC_SUPABASE_URL'] -KeyType 'publishable'
}

$serviceIsVerified = $serviceVerification.Authenticity -eq 'VERIFIED'
$publishableIsVerified = $publishableVerification.Authenticity -eq 'VERIFIED'
$gitignoreValid = $gitignoreText -match '\.env\*' -and $gitignoreText -match '\.env\.local\.backup\*|\.env\.local\.\*'
$cronSecret = $envValues['CRON_SECRET']
$resendKey = $envValues['RESEND_API_KEY']
$duplicateCount = $envFile.Duplicates.Count

$rows = @(
  [pscustomobject]@{
    Name = 'supabase/.temp/project-ref'
    Present = if ($projectRef) { 'PRESENT' } else { 'EMPTY' }
    Valid = if ($linkedRefMatches) { 'VALID' } else { 'INVALID' }
    Staging = if ($linkedRefMatches) { 'STAGING MATCH' } else { 'MISMATCH' }
    Authenticity = 'UNVERIFIED'
    Action = if ($linkedRefMatches) { 'Linked ref matches staging; API keys are verified separately.' } else { 'Link the repo only to the authorized staging ref.' }
  },
  [pscustomobject]@{
    Name = 'SUPABASE_URL'
    Present = if (-not [string]::IsNullOrWhiteSpace($envValues['SUPABASE_URL'])) { 'PRESENT' } else { 'EMPTY' }
    Valid = $serviceUrlStatus.Valid
    Staging = $serviceUrlStatus.Staging
    Authenticity = 'UNVERIFIED'
    Action = if ($serviceUrlStatus.Staging -eq 'STAGING MATCH') { 'Keep the exact authorized staging URL.' } else { 'Set the exact authorized staging URL.' }
  },
  [pscustomobject]@{
    Name = 'NEXT_PUBLIC_SUPABASE_URL'
    Present = if (-not [string]::IsNullOrWhiteSpace($envValues['NEXT_PUBLIC_SUPABASE_URL'])) { 'PRESENT' } else { 'EMPTY' }
    Valid = $publicUrlStatus.Valid
    Staging = $publicUrlStatus.Staging
    Authenticity = 'UNVERIFIED'
    Action = if ($publicUrlStatus.Staging -eq 'STAGING MATCH') { 'Keep the exact authorized staging URL.' } else { 'Set the exact authorized staging URL.' }
  },
  [pscustomobject]@{
    Name = 'SUPABASE_DB_URL'
    Present = if (-not [string]::IsNullOrWhiteSpace($envValues['SUPABASE_DB_URL'])) { 'PRESENT' } else { 'EMPTY' }
    Valid = $databaseUrlStatus.Valid
    Staging = $databaseUrlStatus.Staging
    Authenticity = 'UNVERIFIED'
    Action = if ($databaseUrlStatus.Valid -eq 'VALID') { 'A direct connection still requires explicit approval and a successful PostgreSQL identity check.' } else { 'Obtain a direct PostgreSQL connection string for the exact staging host; do not use API keys as DB credentials.' }
  },
  [pscustomobject]@{
    Name = 'STAGING_SITE_URL'
    Present = if (-not [string]::IsNullOrWhiteSpace($envValues['STAGING_SITE_URL'])) { 'PRESENT' } else { 'EMPTY' }
    Valid = $siteUrlStatus.Valid
    Staging = $siteUrlStatus.Staging
    Authenticity = 'UNVERIFIED'
    Action = if ($siteUrlStatus.Valid -eq 'VALID') { 'Confirm this is the intended staging deployment before approved browser tests.' } else { 'Configure a staging-only HTTPS deployment URL or localhost with staging Supabase URLs.' }
  },
  [pscustomobject]@{
    Name = 'ADDITIONAL_SUPABASE_URLS'
    Present = if ($additionalUrlNames.Count -eq 0) { 'EMPTY' } else { 'PRESENT' }
    Valid = if ($additionalUrlsMatch) { 'VALID' } else { 'INVALID' }
    Staging = if ($additionalUrlsMatch) { 'STAGING MATCH' } else { 'MISMATCH' }
    Authenticity = 'UNVERIFIED'
    Action = if ($additionalUrlsMatch) { 'All additional configured Supabase API URLs match the authorized staging ref.' } else { 'Correct or remove additional Supabase URLs that do not match staging.' }
  },
  [pscustomobject]@{
    Name = 'SUPABASE_SERVICE_ROLE_KEY'
    Present = if (-not [string]::IsNullOrWhiteSpace($envValues['SUPABASE_SERVICE_ROLE_KEY'])) { 'PRESENT' } else { 'EMPTY' }
    Valid = if ($serviceIsVerified) { 'VALID' } else { 'INVALID' }
    Staging = if ($serviceIsVerified) { 'STAGING MATCH' } else { 'MISMATCH' }
    Authenticity = $serviceVerification.Authenticity
    Action = if ($serviceIsVerified) { 'Keep this key server-only.' } elseif ($serviceVerification.Status) { "Staging Auth settings probe returned HTTP $($serviceVerification.Status); obtain the legacy service_role JWT from staging Dashboard > Settings > API Keys." } else { 'Obtain and verify the legacy service_role JWT from staging Dashboard > Settings > API Keys.' }
  },
  [pscustomobject]@{
    Name = 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
    Present = if (-not [string]::IsNullOrWhiteSpace($envValues['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'])) { 'PRESENT' } else { 'EMPTY' }
    Valid = if ($publishableIsVerified) { 'VALID' } else { 'INVALID' }
    Staging = if ($publishableIsVerified) { 'STAGING MATCH' } else { 'MISMATCH' }
    Authenticity = $publishableVerification.Authenticity
    Action = if ($publishableIsVerified) { 'Keep this public staging key for browser clients.' } elseif ($publishableVerification.Status) { "Staging Auth settings probe returned HTTP $($publishableVerification.Status); obtain the publishable key from staging Dashboard Connect or Settings > API Keys." } else { 'Obtain and verify the staging publishable key from the Dashboard.' }
  },
  [pscustomobject]@{
    Name = 'RESEND_API_KEY'
    Present = if (-not [string]::IsNullOrWhiteSpace($resendKey)) { 'PRESENT' } else { 'EMPTY' }
    Valid = 'INVALID'
    Staging = 'N/A'
    Authenticity = 'UNVERIFIED'
    Action = if ([string]::IsNullOrWhiteSpace($resendKey)) { 'Keep real email delivery blocked until a verified Resend key and sender are configured.' } else { 'Credential is present but unverified; verify key and sender with the Resend account owner before delivery.' }
  },
  [pscustomobject]@{
    Name = 'CRON_SECRET'
    Present = if (-not [string]::IsNullOrWhiteSpace($cronSecret)) { 'PRESENT' } else { 'EMPTY' }
    Valid = if ($cronSecret.Length -ge 32) { 'VALID' } else { 'INVALID' }
    Staging = 'N/A'
    Authenticity = 'UNVERIFIED'
    Action = if ([string]::IsNullOrWhiteSpace($cronSecret)) { 'Cron remains blocked until a random local-only 32+ character secret is configured.' } elseif ($cronSecret.Length -lt 32) { 'Replace with a random local-only secret of at least 32 characters.' } else { 'Keep this secret local-only and configure a trusted staging scheduler.' }
  },
  [pscustomobject]@{
    Name = '.gitignore'
    Present = if ($gitignoreValid) { 'PRESENT' } else { 'EMPTY' }
    Valid = if ($gitignoreValid) { 'VALID' } else { 'INVALID' }
    Staging = 'N/A'
    Authenticity = 'UNVERIFIED'
    Action = if ($gitignoreValid) { 'Local environment files and timestamped backups are ignored.' } else { 'Add explicit ignore rules for local environment files and backups.' }
  },
  [pscustomobject]@{
    Name = 'ENV_DUPLICATE_VARIABLES'
    Present = if ($duplicateCount -eq 0) { 'EMPTY' } else { 'PRESENT' }
    Valid = if ($duplicateCount -eq 0) { 'VALID' } else { 'INVALID' }
    Staging = 'N/A'
    Authenticity = 'UNVERIFIED'
    Action = if ($duplicateCount -eq 0) { 'No duplicate environment variable names found.' } else { "Resolve $duplicateCount duplicate variable name(s) in .env.local." }
  }
)

Write-Output 'Variable Name | PRESENT / EMPTY | VALID / INVALID | STAGING MATCH / MISMATCH | Credential authenticity | Required action'
foreach ($row in $rows) {
  Write-Output ("{0} | {1} | {2} | {3} | {4} | {5}" -f $row.Name, $row.Present, $row.Valid, $row.Staging, $row.Authenticity, $row.Action)
}
