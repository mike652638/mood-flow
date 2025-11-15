
# 心流日记 Android APK/AAB 一键自动构建与安装 (混合脚本单文件版)
# 支持三种模式：debug | release | aab
# 用法（单文件）：
#   1) 默认安装到首个连接设备（Debug）：
#      ./build-android.cmd
#   2) 指定设备序列号安装（Debug/Release）：
#      ./build-android.cmd debug <deviceSerial>
#      ./build-android.cmd release <deviceSerial>
#   3) 导出 AAB：
#      ./build-android.cmd aab
#   4) 也支持显式标志：-Mode <debug|release|aab> -Device <serial>
#   5) 跳过安装（仅构建 Debug/Release）：添加 -NoInstall 标志

$ErrorActionPreference = 'Stop'

function Get-Timestamp { return (Get-Date -Format 'HH:mm:ss') }
function Write-Info($msg) { $ts = Get-Timestamp; Write-Host "[INFO $ts] $msg" -ForegroundColor Cyan }
function Write-Success($msg) { $ts = Get-Timestamp; Write-Host "[OK   $ts] $msg" -ForegroundColor Green }
function Write-Warn($msg) { $ts = Get-Timestamp; Write-Host "[WARN $ts] $msg" -ForegroundColor Yellow }
function Write-Err($msg) { $ts = Get-Timestamp; Write-Host "[ERR  $ts] $msg" -ForegroundColor Red }

# 根据模式选择分发标签（支持环境变量覆盖）
function Get-DistLabel {
  param([string]$Mode)
  $allowed = @('release','signed','sinternal','store')
  $envTag = $env:DIST_TAG
  if ($envTag -and ($allowed -contains $envTag.ToLower())) { return $envTag.ToLower() }
  $ksFile = 'android/keystore.properties'
  switch ($Mode.ToLower()) {
    'debug'   { return 'sinternal' }
    'release' { if (Test-Path $ksFile) { return 'signed' } else { return 'release' } }
    'aab'     { return 'store' }
    default   { return 'release' }
  }
}

# 复制构建产物并生成命名标签文件（使用 Node 脚本）
function Tag-BuildArtifacts {
  param([string]$Mode)
  $label = Get-DistLabel -Mode $Mode
  $scriptPath = Join-Path 'scripts' 'tag-artifacts.cjs'
  if (-not (Test-Path $scriptPath)) { Write-Warn "未找到 $scriptPath，跳过命名标签生成"; return }
  Write-Info "生成分发命名副本 (label=$label)"
  & node.exe $scriptPath --labels "$label" --product mood-flow
  if ($LASTEXITCODE -ne 0) { Write-Warn '命名标签生成脚本执行失败' } else { Write-Success '分发命名副本已生成' }
}

# 设备选择（支持优先模拟器）
function Choose-Device {
  param([string]$PreferredSerial, [bool]$PreferEmulator = $false)
  $adb = Resolve-AdbPath
  $list = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }
  if (-not $list) { throw '未检测到已连接设备或设备未授权 (adb devices)' }
  if ($PreferredSerial) {
    if ($list -contains $PreferredSerial) { return $PreferredSerial }
    Write-Warn "指定设备未找到，改用自动选择: $PreferredSerial"
  }
  $emuCandidates = @('127.0.0.1:7555') + ($list | Where-Object { $_ -like 'emulator-*' })
  $physCandidates = $list | Where-Object { $_ -notin $emuCandidates }
  if ($PreferEmulator) {
    $emu = $emuCandidates | Select-Object -First 1
    if ($emu) { return $emu }
    Write-Warn '未找到模拟器，改用物理设备'
  }
  $phys = $physCandidates | Select-Object -First 1
  if ($phys) { return $phys }
  return if ($list -is [array]) { $list[0] } else { $list }
}

# 冒烟测试：清理日志、启动应用、抓取致命崩溃
function Smoke-Test {
  param([string]$DeviceId, [string]$AppId)
  if (-not $DeviceId) { throw 'Smoke-Test 需要 DeviceId' }
  if (-not $AppId) { throw 'Smoke-Test 需要 AppId' }
  $adb = Resolve-AdbPath
  Write-Info "开始冒烟测试: 设备=$DeviceId, 包名=$AppId"
  & $adb -s $DeviceId logcat -c
  & $adb -s $DeviceId shell monkey -p $AppId -c android.intent.category.LAUNCHER 1 | Out-Null
  Start-Sleep -Seconds 3
  $logs = & $adb -s $DeviceId logcat -d
  # 仅在出现明确的致命异常时判定失败，避免因 AndroidRuntime 普通日志误报
  if ($logs -match 'FATAL\s+EXCEPTION') {
    Write-Err '检测到致命崩溃 (FATAL EXCEPTION)'
    $logs -split "`n" | Where-Object { $_ -match 'FATAL\s+EXCEPTION' } | Select-Object -First 20 | ForEach-Object { Write-Host $_ }
    throw 'SmokeTestFailed'
  }
  Write-Success '冒烟测试通过：无致命崩溃日志'
}

function Ensure-CwdRoot {
  if ($env:SCRIPT_SELF) { Set-Location (Split-Path -Parent $env:SCRIPT_SELF) }
  else { $root = Split-Path -Parent $MyInvocation.MyCommand.Path; Set-Location $root }
}

function Parse-Args {
  param([string[]]$argv)
  $mode = 'debug'
  if ($env:BUILD_MODE -match '^(debug|release|aab)$') { $mode = $env:BUILD_MODE }
  $device = if ($env:BUILD_DEVICE -and ($env:BUILD_DEVICE -notmatch '^-') -and ($env:BUILD_DEVICE -ne 'auto')) { $env:BUILD_DEVICE } else { $null }
  $noInstall = $false
  $preferEmulator = if ($env:PREFER_EMULATOR -match '^(1|true|yes)$') { $true } else { $false }
  $skipSmokeTest = if ($env:SKIP_SMOKE_TEST -match '^(1|true|yes)$') { $true } else { $false }
  if ($argv -and $argv.Count -gt 0) {
    # named flags
    for ($i=0; $i -lt $argv.Count; $i++) {
      switch -Regex ($argv[$i]) {
        '^-Mode$'   { if ($i+1 -lt $argv.Count) { $mode = $argv[$i+1] } }
        '^-Device$' {
          if ($i+1 -lt $argv.Count) {
            if ($argv[$i+1] -eq 'auto') { $device = $null }
            else { $device = $argv[$i+1] }
          }
        }
        '^-NoInstall$' { $noInstall = $true }
        '^-PreferEmulator$' { $preferEmulator = $true }
        '^-SkipSmokeTest$' { $skipSmokeTest = $true }
      }
    }
    # positional
    if ($argv[0] -match '^(debug|release|aab)$') { $mode = $argv[0] }
    if ($argv.Count -ge 2 -and ($argv[1] -notmatch '^-')) { $device = $argv[1] }
  }
  return @{ Mode = $mode; Device = $device; NoInstall = $noInstall; PreferEmulator = $preferEmulator; SkipSmokeTest = $skipSmokeTest }
}

function Bump-AndroidVersion {
  param([string]$GradlePath)
  if (-not (Test-Path $GradlePath)) { Write-Warn "未找到 $GradlePath，跳过版本号更新"; return $false }
  $content = Get-Content $GradlePath -Raw
  $vcMatch = [regex]::Match($content, 'versionCode\s+(\d+)')
  $vnMatch = [regex]::Match($content, 'versionName\s+"([^"]+)"')
  $currentVC = if ($vcMatch.Success) { [int]$vcMatch.Groups[1].Value } else { 0 }
  $currentVN = if ($vnMatch.Success) { $vnMatch.Groups[1].Value } else { '0.1.0' }

  # 语义化版本号：根据最近提交信息决定 bump 类型（major/minor/patch）
  $bump = 'patch'
  $text = ''
  try {
    $text = (& git log -n 30 --pretty=format:'%s%n%b' 2>$null) -join "`n"
  } catch {}
  if ($text) {
    $hasBreaking = ($text -match '(?im)^BREAKING CHANGE|\!')
    $hasFeat = ($text -match '(?im)^feat(\(|:)|\bfeat\b')
    $hasFixPerfRefactor = ($text -match '(?im)^(fix|perf|refactor)(\(|:)|\b(fix|perf|refactor)\b')
    if ($hasBreaking) { $bump = 'major' }
    elseif ($hasFeat) { $bump = 'minor' }
    elseif ($hasFixPerfRefactor) { $bump = 'patch' }
    else { $bump = 'patch' }
  }

  # 解析当前版本并按 bump 类型调整
  $m = [regex]::Match($currentVN, '^(\d+)\.(\d+)\.(\d+)')
  $major = 1; $minor = 0; $patch = 0
  if ($m.Success) {
    $major = [int]$m.Groups[1].Value
    $minor = [int]$m.Groups[2].Value
    $patch = [int]$m.Groups[3].Value
  }
  switch ($bump) {
    'major' { $major += 1; $minor = 0; $patch = 0 }
    'minor' { $minor += 1; $patch = 0 }
    default { $patch += 1 }
  }
  $newVC = $currentVC + 1
  $newVN = "$major.$minor.$patch"

  $new = $content -replace ('versionCode\s+\d+'), "versionCode $newVC"
  $new = $new -replace ('versionName\s+\"[^\"]+\"'), "versionName `"$newVN`""
  if ($new -ne $content) {
    Set-Content -Path $GradlePath -Value $new
    Write-Info "语义化版本 -> bump=$bump, versionCode=$newVC, versionName $currentVN => $newVN"
    return $true
  }
  return $false
}

function Resolve-AdbPath {
  $adb = 'adb'
  $local = Join-Path 'android' 'local.properties'
  if (Test-Path $local) {
    $props = Get-Content $local
    $sdkLine = $props | Where-Object { $_ -like 'sdk.dir=*' }
    if ($sdkLine) {
      $sdkDir = $sdkLine -replace 'sdk.dir=', ''
      $adbCandidate = Join-Path $sdkDir 'platform-tools/adb.exe'
      if (Test-Path $adbCandidate) { $adb = $adbCandidate }
    }
  }
  return $adb
}

function Get-ApplicationId {
  try {
    $gradle = Get-Content 'android/app/build.gradle' -Raw
    $m = [regex]::Match($gradle, 'applicationId\s+"([^"]+)"')
    if ($m.Success) { return $m.Groups[1].Value }
  } catch {}
  return $null
}

function Get-AndroidVersionInfo {
  try {
    $gradle = Get-Content 'android/app/build.gradle' -Raw
    $vn = [regex]::Match($gradle, 'versionName\s+"([^"]+)"')
    $vc = [regex]::Match($gradle, 'versionCode\s+(\d+)')
    $name = if ($vn.Success) { $vn.Groups[1].Value } else { '' }
    $code = if ($vc.Success) { $vc.Groups[1].Value } else { '' }
    return @{ versionName = $name; versionCode = $code }
  } catch {
    return @{ versionName = ''; versionCode = '' }
  }
}

function Install-APK {
  param([string]$ApkPath, [string]$DeviceId, [bool]$AllowTestInstall = $true)
  if (-not (Test-Path $ApkPath)) { throw "APK 不存在: $ApkPath" }
  $adb = Resolve-AdbPath
  Write-Info "使用 ADB: $adb"
  $list = & $adb devices | Select-String 'device$' | ForEach-Object { ($_ -split '\s+')[0] }
  if (-not $list) { throw '未检测到已连接设备或设备未授权 (adb devices)' }
  $target = if ($DeviceId) { $DeviceId } else { 
    if ($list -is [array]) { $list[0] } else { $list }
  }
  Write-Info "目标设备: $target"
  if ($AllowTestInstall) {
    & $adb -s $target install -r -t "$ApkPath"
  } else {
    & $adb -s $target install -r "$ApkPath"
  }
  if ($LASTEXITCODE -ne 0) {
    $appId = Get-ApplicationId
    if ($appId) {
      Write-Warn "覆盖安装失败，尝试卸载后重装：$appId"
      & $adb -s $target uninstall $appId
      if ($AllowTestInstall) {
        & $adb -s $target install -t "$ApkPath"
      } else {
        & $adb -s $target install "$ApkPath"
      }
    }
  }
  if ($LASTEXITCODE -ne 0) { throw 'ADB 安装失败 (签名冲突或设备拒绝安装)' }
  Write-Success 'ADB 安装完成'
}

function Validate-Config {
  try {
    $appId = Get-ApplicationId
    $capId = $null
    if (Test-Path 'capacitor.config.ts') {
      $cap = Get-Content 'capacitor.config.ts' -Raw
      $m = [regex]::Match($cap, "appId:\s*'([^']+)'")
      if ($m.Success) { $capId = $m.Groups[1].Value }
    }
    if ($appId -and $capId -and $appId -ne $capId) {
      throw "配置不一致: build.gradle applicationId=$appId, capacitor.config.ts appId=$capId"
    }
    Write-Info "配置一致性检查通过 (applicationId=$appId)"
  } catch {
    throw $_.Exception
  }
}

try {
  Ensure-CwdRoot
  $parsed = Parse-Args -argv $args
  $Mode = $parsed['Mode']
  $Device = $parsed['Device']
  $NoInstall = [bool]$parsed['NoInstall']
  $PreferEmulator = [bool]$parsed['PreferEmulator']
  $SkipSmokeTest = [bool]$parsed['SkipSmokeTest']
  Write-Info "开始一键自动构建 (模式: $Mode)"

  # 0) 配置一致性校验（applicationId 与 Capacitor appId）
  Validate-Config

  # 0.5) 发布模式预清理：备份并注释 server.url，以确保使用 dist 静态资源
  if ($Mode.ToLower() -in @('release','aab')) {
    Write-Info '发布前清理 server.url（备份并注释）'
    & node.exe scripts/prepare-release-clean-server-url.cjs --mode backup
    if ($LASTEXITCODE -ne 0) { throw '清理 server.url 失败' }
    Write-Success '已注释 server.url，保留 webDir="dist"（已创建备份）'
  }

  if ($Mode.ToLower() -in @('release','aab')) {
    $ksFile = 'android/keystore.properties'
    if (-not (Test-Path $ksFile)) { Write-Warn '未找到 android/keystore.properties，可能生成未签名产物或构建失败' }
  }

  # 1) 自动更新 Android 版本
  Bump-AndroidVersion -GradlePath 'android/app/build.gradle' | Out-Null

  # 2) 构建 Web 资源
  Write-Info 'npm run build'
  Write-Info '=== 步骤 2/4：构建 Web 资源 ==='
  $ver = Get-AndroidVersionInfo
  if ($ver['versionName']) {
    Write-Info "注入环境变量 VITE_APP_VERSION=$($ver['versionName'])"
    $env:VITE_APP_VERSION = $ver['versionName']
  }
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) { throw 'Web 构建失败' }
  Write-Success 'Web 构建完成'

  # 2.5) 生成 Android 启动图（多密度，使用 AC7AFD 背景）
  $gen = Join-Path 'scripts' 'generate-splash.cjs'
  if (Test-Path $gen) {
    Write-Info "node $gen --bg '#AC7AFD'"
    & node.exe $gen --bg '#AC7AFD'
    if ($LASTEXITCODE -ne 0) { throw '生成启动图失败 (generate-splash.cjs)'}
    Write-Success '启动图生成完成'
  } else {
    Write-Warn '未找到 scripts/generate-splash.cjs，跳过启动图生成'
  }

  # 3) 同步到 Android 项目
  Write-Info 'npx cap sync android'
  Write-Info '=== 步骤 3/4：同步到 Android 项目 ==='
  & npx.cmd cap sync android
  if ($LASTEXITCODE -ne 0) { throw 'Capacitor 同步失败' }
  Write-Success 'Android 项目同步完成'

  # 4) 根据模式执行构建/安装
  #   在进入 Gradle 构建前，显式设置代理到 127.0.0.1:20001，避免默认 10808 被引用
  $proxyHost = '127.0.0.1'
  $proxyPort = 20001
  $env:HTTP_PROXY = "http://${proxyHost}:${proxyPort}"
  $env:HTTPS_PROXY = "http://${proxyHost}:${proxyPort}"
  $env:ALL_PROXY = "socks5://${proxyHost}:${proxyPort}"
  $env:GRADLE_OPTS = "-Dhttp.proxyHost=$proxyHost -Dhttp.proxyPort=$proxyPort -Dhttps.proxyHost=$proxyHost -Dhttps.proxyPort=$proxyPort -DsocksProxyHost=$proxyHost -DsocksProxyPort=$proxyPort"
  $env:JAVA_TOOL_OPTIONS = "-Dhttp.proxyHost=$proxyHost -Dhttp.proxyPort=$proxyPort -Dhttps.proxyHost=$proxyHost -Dhttps.proxyPort=$proxyPort -DsocksProxyHost=$proxyHost -DsocksProxyPort=$proxyPort"
  switch ($Mode.ToLower()) {
    'debug' {
      Write-Info '=== 步骤 4/4：Gradle assembleDebug 并安装 ==='
      Write-Info 'Gradle assembleDebug'
      Push-Location 'android'
      & .\gradlew.bat --stop
      & .\gradlew.bat assembleDebug --no-daemon --init-script ..\android\proxy.init.gradle
      $gradleExit = $LASTEXITCODE
      Pop-Location
      if ($gradleExit -ne 0) { throw 'Gradle 构建失败 (Debug)' }
      Write-Success 'APK 构建完成 (Debug)'
      $apkPath = 'android/app/build/outputs/apk/debug/app-debug.apk'
      if (-not (Test-Path $apkPath)) { throw "未找到 APK: $apkPath" }
      Write-Info "APK: $apkPath"
      Tag-BuildArtifacts -Mode 'debug'
      if (-not $NoInstall) {
        Install-APK -ApkPath $apkPath -DeviceId $Device -AllowTestInstall $true
      } else {
        Write-Warn '跳过安装（NoInstall）'
      }
      Write-Success '全部完成 (Debug)'
    }
    'release' {
      Write-Info '=== 步骤 4/4：Gradle assembleRelease 并安装 ==='
      Write-Info 'Gradle assembleRelease'
      Push-Location 'android'
      & .\gradlew.bat --stop
      & .\gradlew.bat assembleRelease --no-daemon --init-script ..\android\proxy.init.gradle
      $gradleExit = $LASTEXITCODE
      Pop-Location
      if ($gradleExit -ne 0) { throw 'Gradle 构建失败 (Release)' }
      Write-Success 'APK 构建完成 (Release)'
      $apkPath = 'android/app/build/outputs/apk/release/app-release.apk'
      if (-not (Test-Path $apkPath)) { throw "未找到 APK: $apkPath" }
      $sizeMB = [math]::Round((Get-Item $apkPath).Length / 1MB, 2)
      Write-Info "APK: $apkPath (${sizeMB} MB)"
      Tag-BuildArtifacts -Mode 'release'
      $target = $Device
      if (-not $target) { $target = Choose-Device -PreferredSerial $Device -PreferEmulator $PreferEmulator }
      if ($target -eq 'auto') { $target = Choose-Device -PreferredSerial $null -PreferEmulator $PreferEmulator }
      Write-Info "最终目标设备: $target"
      if (-not $NoInstall) {
        Write-Info "开始安装到设备: $target"
        Install-APK -ApkPath $apkPath -DeviceId $target -AllowTestInstall $false
        if (-not $SkipSmokeTest) {
          $appId = Get-ApplicationId
          try { Smoke-Test -DeviceId $target -AppId $appId } catch { Write-Warn "冒烟测试失败: $($_.Exception.Message)"; throw }
        } else {
          Write-Warn '已跳过冒烟测试（SkipSmokeTest）'
        }
      } else {
        Write-Warn '跳过安装（NoInstall）'
      }
      Write-Success '全部完成 (Release)'
      # 构建结束后自动恢复开发配置
      Write-Info '恢复开发配置（server.url）'
      & node.exe scripts/prepare-release-clean-server-url.cjs --mode restore
      if ($LASTEXITCODE -ne 0) { Write-Warn '恢复失败，请手动检查备份：scripts/.backup/capacitor.config.ts.bak' } else { Write-Success '已恢复 server.url 至构建前状态' }
    }
    'aab' {
      Write-Info '=== 步骤 4/4：Gradle bundleRelease 并导出 AAB ==='
      Write-Info 'Gradle bundleRelease'
      Push-Location 'android'
      & .\gradlew.bat --stop
      & .\gradlew.bat bundleRelease --no-daemon --init-script ..\android\proxy.init.gradle
      $gradleExit = $LASTEXITCODE
      Pop-Location
      if ($gradleExit -ne 0) { throw 'Gradle 构建失败 (bundleRelease)' }
      Write-Success 'AAB 构建完成 (Release)'
      $aabPath = 'android/app/build/outputs/bundle/release/app-release.aab'
      if (-not (Test-Path $aabPath)) { throw "未找到 AAB: $aabPath" }
      $sizeMB = [math]::Round((Get-Item $aabPath).Length / 1MB, 2)
      Write-Info "AAB: $aabPath (${sizeMB} MB)"
      Tag-BuildArtifacts -Mode 'aab'
      Write-Info '你可以将该 AAB 上传到应用商店或使用 bundletool 进行本地生成与安装'
      Write-Info 'bundletool 参考：java -jar bundletool.jar build-apks --bundle app-release.aab --output app.apks --connected-device --mode default'
      Write-Success '全部完成 (AAB)'
      # 导出结束后自动恢复开发配置
      Write-Info '恢复开发配置（server.url）'
      & node.exe scripts/prepare-release-clean-server-url.cjs --mode restore
      if ($LASTEXITCODE -ne 0) { Write-Warn '恢复失败，请手动检查备份：scripts/.backup/capacitor.config.ts.bak' } else { Write-Success '已恢复 server.url 至构建前状态' }
    }
    default {
      throw "未知模式: $Mode"
    }
  }
}
catch {
  Write-Err $_.Exception.Message
  # 发生错误也尝试恢复
  if ($Mode.ToLower() -in @('release','aab')) {
    Write-Warn '构建失败，尝试恢复 server.url（备份）'
    & node.exe scripts/prepare-release-clean-server-url.cjs --mode restore
  }
  exit 1
}