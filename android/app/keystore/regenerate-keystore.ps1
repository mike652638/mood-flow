Param(
  [string]$StorePassword,
  [string]$KeyPassword,
  [string]$KeyAlias,
  [string]$DName = 'CN=MoodFlow, OU=Engineering, O=MoodFlow, L=Shanghai, S=Shanghai, C=CN'
)

$ErrorActionPreference = 'Stop'

# Resolve paths
$keystoreDir = $PSScriptRoot
$keystorePath = Join-Path $keystoreDir 'release.keystore'
$propsPath = Join-Path $keystoreDir 'keystore.properties'
$b64Path = Join-Path $keystoreDir 'keystore.b64'

# Load properties if not passed as parameters
if (-not $StorePassword -or -not $KeyPassword -or -not $KeyAlias) {
  if (-not (Test-Path $propsPath)) {
    Write-Error "keystore.properties not found. Copy keystore.properties.example to keystore.properties and fill values."
  }
  $props = @{}
  Get-Content $propsPath | ForEach-Object {
    if ($_ -match '^\s*#') { return }
    if ($_ -match '^\s*$') { return }
    $kv = $_.Split('=',2)
    if ($kv.Length -eq 2) { $props[$kv[0].Trim()] = $kv[1].Trim() }
  }
  if (-not $StorePassword) { $StorePassword = $props['storePassword'] }
  if (-not $KeyPassword)   { $KeyPassword   = $props['keyPassword'] }
  if (-not $KeyAlias)      { $KeyAlias      = $props['keyAlias'] }
  if (-not $StorePassword -or -not $KeyPassword -or -not $KeyAlias) {
    Write-Error "Missing required values: storePassword/keyPassword/keyAlias"
  }
}

# Generate keystore
$args = @(
  '-genkeypair','-v',
  '-keystore', $keystorePath,
  '-storepass', $StorePassword,
  '-keypass', $KeyPassword,
  '-alias', $KeyAlias,
  '-keyalg','RSA','-keysize','2048','-validity','3650',
  '-dname', $DName
)
& keytool @args

# Export base64
[Convert]::ToBase64String([IO.File]::ReadAllBytes($keystorePath)) | Set-Content -Encoding ascii $b64Path

# Ensure keystore.properties has correct storeFile path
if (Test-Path $propsPath) {
  $lines = Get-Content $propsPath
  $updated = $false
  $lines = $lines | ForEach-Object {
    if ($_ -match '^storeFile=') { $updated = $true; 'storeFile=keystore/release.keystore' } else { $_ }
  }
  if (-not $updated) { $lines += 'storeFile=keystore/release.keystore' }
  $lines | Set-Content -Encoding ascii $propsPath
}

Write-Host "Generated: $keystorePath"
Write-Host "Base64:    $b64Path"
Write-Host "Alias:     $KeyAlias"
Write-Host "Update GitHub Secrets: ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD"