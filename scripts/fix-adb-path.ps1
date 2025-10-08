Write-Host "=== 修复 adb 未识别问题（临时会话修复） ==="

$androidHome = $env:ANDROID_HOME
if (-not $androidHome) {
  $candidates = @(
    Join-Path $env:USERPROFILE 'AppData\Local\Android\Sdk'),
    'C:\Android\sdk',
    ("C:\Users\$env:USERNAME\AppData\Local\Android\Sdk")
  foreach ($c in $candidates) {
    if (Test-Path $c) { $androidHome = $c; break }
  }
  if ($androidHome) { Write-Host "ANDROID_HOME 未设置，使用候选路径: $androidHome" }
}

if (-not $androidHome) {
  Write-Host '未找到 ANDROID_HOME，请安装 Android SDK 或手动设置 ANDROID_HOME'
  exit 1
}

$adbDir = Join-Path $androidHome 'platform-tools'
$adbExe = Join-Path $adbDir 'adb.exe'
Write-Host "预期 adb 路径: $adbExe"

if (-not (Test-Path $adbExe)) {
  Write-Host "未找到 adb.exe：$adbExe"
  Write-Host '请安装 Android SDK Platform-Tools'
  exit 1
}

# 将 platform-tools 加入当前会话 PATH（仅对本次终端会话生效）
if (-not (($env:PATH -split ';') -contains $adbDir)) {
  $env:PATH = "$adbDir;$env:PATH"
  Write-Host "已加入 PATH: $adbDir"
}

& $adbExe version
& $adbExe devices

# 提示语省略，避免在不同代码页下的引号解析问题