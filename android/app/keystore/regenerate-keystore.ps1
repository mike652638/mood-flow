Param(
  [string]$StorePassword,
  [string]$KeyPassword,
  [string]$KeyAlias,
  [string]$DName = 'CN=moodflow.joyful.host, OU=Development, O=Joyful, L=Wuhan, S=Wuhan, C=CN',
  [switch]$Force
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
    $kv = $_.Split('=', 2)
    if ($kv.Length -eq 2) { $props[$kv[0].Trim()] = $kv[1].Trim() }
  }
  if (-not $StorePassword -and $props.ContainsKey('storePassword')) { $StorePassword = $props['storePassword'] }
  if (-not $KeyPassword   -and $props.ContainsKey('keyPassword'))   { $KeyPassword   = $props['keyPassword'] }
  if (-not $KeyAlias      -and $props.ContainsKey('keyAlias'))      { $KeyAlias      = $props['keyAlias'] }
  if (-not $StorePassword -or -not $KeyPassword -or -not $KeyAlias) {
    Write-Error "Missing required values: storePassword/keyPassword/keyAlias"
  }
}

function Test-KeytoolCommand {
  param([string[]]$KeytoolArgs)
  $quoted = @()
  foreach ($a in $KeytoolArgs) {
    if ($null -eq $a) { continue }
    $s = [string]$a
    if ($s -match '\s') { $quoted += '"' + $s + '"' } else { $quoted += $s }
  }
  $argString = ($quoted -join ' ')
  $p = Start-Process -FilePath 'keytool' -ArgumentList $argString -NoNewWindow -PassThru -Wait -RedirectStandardOutput 'NUL'
  if ($p.ExitCode -eq 0) { return $true } else { return $false }
}

# If keystore exists and not forcing, validate instead of regenerating
if ((Test-Path $keystorePath) -and (-not $Force)) {
  Write-Host "Keystore exists: $keystorePath"
  Write-Host "Validating store password, alias and key password..."

  $storeOk = Test-KeytoolCommand -KeytoolArgs @('-list','-storetype','PKCS12','-keystore',$keystorePath,'-storepass',$StorePassword)
  if (-not $storeOk) { Write-Error "Store password invalid. Fix storePassword or run with -Force to regenerate." }
  Write-Host "OK: Store password"

  $aliasOk = Test-KeytoolCommand -KeytoolArgs @('-list','-storetype','PKCS12','-keystore',$keystorePath,'-storepass',$StorePassword,'-alias',$KeyAlias)
  if (-not $aliasOk) { Write-Error "Alias '$KeyAlias' not found. Fix keyAlias or run with -Force to regenerate." }
  Write-Host "OK: Alias"

  $keyOk = Test-KeytoolCommand -KeytoolArgs @('-exportcert','-storetype','PKCS12','-alias',$KeyAlias,'-keystore',$keystorePath,'-storepass',$StorePassword,'-keypass',$KeyPassword,'-rfc')
  if (-not $keyOk) { Write-Error "Key password invalid for alias '$KeyAlias'. Fix keyPassword or run with -Force to regenerate." }
  Write-Host "OK: Key password"

  Write-Host "Validation succeeded. Skipping regeneration. Use -Force to rebuild with new values."
} else {
  # Optionally backup existing keystore when forcing
  if ((Test-Path $keystorePath) -and ($Force)) {
    $ts = Get-Date -Format 'yyyyMMdd_HHmmss'
    $bak = Join-Path $keystoreDir "release.keystore.bak.$ts"
    Copy-Item $keystorePath $bak -Force
    Write-Host "Backed up existing keystore to: $bak"
    Remove-Item $keystorePath -Force
  }

  # Generate keystore
  $args = @(
    '-genkeypair','-v',
    '-storetype','PKCS12',
    '-keystore',$keystorePath,
    '-storepass',$StorePassword,
    '-keypass',$KeyPassword,
    '-alias',$KeyAlias,
    '-keyalg','RSA','-keysize','2048','-validity','3650',
    '-dname',$DName
  )
  & keytool @args
  if ($LASTEXITCODE -ne 0) { Write-Error "keytool genkeypair failed (exit code $LASTEXITCODE)." }
}

# Export base64
[Convert]::ToBase64String([IO.File]::ReadAllBytes($keystorePath)) | Set-Content -Encoding ascii $b64Path

# Ensure keystore.properties has correct storeFile path and values
if (Test-Path $propsPath) {
  $content = @(
    'storeFile=keystore/release.keystore',
    "storePassword=$StorePassword",
    "keyAlias=$KeyAlias",
    "keyPassword=$KeyPassword"
  ) -join "`n"
  Set-Content -Encoding ascii $propsPath $content
}

Write-Host "Keystore:  $keystorePath"
Write-Host "Base64:    $b64Path"
Write-Host "Alias:     $KeyAlias"
Write-Host "Secrets to update: ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD"