Write-Host "=== Configure ANDROID_HOME and system PATH (Machine) ==="

function Find-SdkDir {
  $candidates = @()
  if ($env:ANDROID_HOME) { $candidates += $env:ANDROID_HOME }
  $candidates += (Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk')
  $candidates += 'C:\Android\sdk'
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { return $c }
  }
  return $null
}

function Ensure-EndsWithPathSep($s) { if ($s -and $s[-1] -ne ';') { return ($s + ';') } else { return $s } }

$sdkDir = Find-SdkDir
if (-not $sdkDir) { Write-Error 'Android SDK not found. Please install Android SDK Platform-Tools.'; exit 1 }
Write-Host ("SDK Dir: " + $sdkDir)

$platformTools = Join-Path $sdkDir 'platform-tools'
$adbExe = Join-Path $platformTools 'adb.exe'
if (-not (Test-Path $adbExe)) { Write-Error ("adb.exe not found: " + $adbExe); exit 1 }

# Try set ANDROID_HOME (Machine)
$androidHomeSet = $false
try {
  [Environment]::SetEnvironmentVariable('ANDROID_HOME', $sdkDir, 'Machine')
  $androidHomeSet = $true
  Write-Host ("Set ANDROID_HOME (Machine): " + $sdkDir)
} catch {
  Write-Warning ("Failed to set ANDROID_HOME (Machine): " + $_.Exception.Message)
}

# Update Machine PATH to include platform-tools
$machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
if (-not $machinePath) { $machinePath = '' }
if ($machinePath -notmatch [regex]::Escape($platformTools)) {
  $newMachinePath = (Ensure-EndsWithPathSep $machinePath) + $platformTools
  try {
    [Environment]::SetEnvironmentVariable('Path', $newMachinePath, 'Machine')
    Write-Host ("Updated system PATH with: " + $platformTools)
  } catch {
    Write-Warning ("Failed to update system PATH: " + $_.Exception.Message)
  }
} else {
  Write-Host 'platform-tools already present in system PATH.'
}

# Also patch current session PATH so adb works immediately
if (-not (($env:PATH -split ';') -contains $platformTools)) {
  $env:PATH = $platformTools + ';' + $env:PATH
  Write-Host ("Patched current session PATH: " + $platformTools)
}

# Verify adb availability
& $adbExe version
& $adbExe devices

Write-Host 'Done. If system PATH change does not reflect, restart terminal or log off/on.'