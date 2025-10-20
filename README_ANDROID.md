# 🤖 心流日记 Android 版

> 专为小米 13 Ultra (Android 15, HyperOS 2) 优化的原生 Android 应用

## 🚀 快速开始

### 一键构建/安装 与 导出

```bash
# 批处理入口（Windows）：
# 默认 debug 构建并安装到首个设备
./build-android.cmd

# 指定模式与设备序列号（支持显式标志）
./build-android.cmd debug <deviceSerial>
./build-android.cmd release <deviceSerial>
./build-android.cmd aab
# 或：./build-android.cmd -Mode release -Device <serial>

# PowerShell 入口（统一脚本）
# 默认 debug 模式
powershell -NoProfile -ExecutionPolicy Bypass -File ./build-android-auto.ps1
# 指定模式与设备
powershell -NoProfile -ExecutionPolicy Bypass -File ./build-android-auto.ps1 -Mode release -Device <serial>
+ build-android.cmd release <serial>
powershell -NoProfile -ExecutionPolicy Bypass -File ./build-android-auto.ps1 -Mode aab
+ build-android.cmd aab

# npm 脚本入口（统一指向 build-android.cmd）
npm run android:debug:auto
npm run android:release:auto
npm run android:aab:auto

# 常用参数与环境变量
# -Device <serial|auto>        指定设备或自动选择（auto）
# -PreferEmulator              优先选择模拟器（如 127.0.0.1:7555）
# -NoInstall                   仅构建不安装到设备
# -SkipSmokeTest               跳过冒烟测试（仅安装后可用）
# 环境变量：
#   PREFER_EMULATOR=true|false  与 -PreferEmulator 等效
#   SKIP_SMOKE_TEST=true|false  与 -SkipSmokeTest 等效
```

说明：
- 所有一键命令均使用统一脚本 `build-android.cmd`，通过 `debug | release | aab` 或显式 `-Mode/-Device` 参数选择模式与设备。
- release/aab 模式会检测 `android/keystore.properties`，未配置时可能生成未签名产物或构建失败。
- 安装到设备时，debug 包使用 `adb install -r -t`；release 包使用 `adb install -r`。若覆盖安装失败，脚本会尝试自动卸载后重装。

### 手动构建步骤

```bash
npm install
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

## 🌐 开发热更新（Wi‑Fi / USB）自动化命令

项目已提供一键化开发命令，自动更新 `capacitor.config.ts` 的 `server.url` 并启动（或复用）开发服务器，然后同步并运行到设备。发布前可一键移除该字段，使用打包静态资源。

### 常用命令

```bash
# Wi‑Fi 开发（自动检测局域网 IP 并写入 server.url）
npm run android:dev:wifi:auto

# USB 直连开发（设置 server.url=localhost 并进行端口反向）
npm run android:dev:usb:auto

# 发布前清理（移除 server.url，改用 dist 静态资源）
npm run android:release:prepare
```

### Wi‑Fi 开发热更新
- 自动复用或启动本地开发服务器（默认 `http://<本机IP>:5173`）。
- 写入 `capacitor.config.ts` 的 `server.url` 与 `server.cleartext=true`。
- 同步并运行到连接的 Android 设备（`npx cap sync android && npx cap run android`）。
- 验证建议：
  - 手机与电脑在同一 Wi‑Fi 网段，能访问 `http://<本机IP>:5173/`。
  - 首次运行如加载失败，检查防火墙是否放行 5173 端口。
  - 修改前端代码后，手机端会即时热更新刷新。

### USB 直连开发热更新
- 将 `server.url` 设置为 `http://localhost:5173`，并开启 `cleartext`。
- 执行 `adb reverse tcp:5173 tcp:5173` 完成端口反向。
- 同步并运行到设备，适合在 Wi‑Fi 不稳定或受限环境下开发。
- 验证建议：
  - 电脑端本地访问 `http://localhost:5173/` 正常。
  - Android 开发者选项中已开启 USB 调试并授权。

### 发布前清理 server.url
- 执行 `npm run android:release:prepare` 会“备份并注释” `server.url`（不移除），确保发布使用 `dist` 静态资源。
- 一键构建（`android:release:auto`、`android:aab:auto`）在构建前自动执行“备份并注释”，构建结束后自动“还原备份”，便于继续开发。
- 通用构建命令 `android:build` 也会在构建前执行清理并在构建后自动还原。
- 如构建失败，脚本会尝试还原；若还原失败，可手动执行：`node scripts/prepare-release-clean-server-url.cjs --mode restore`。

### 脚本位置与行为摘要
- Wi‑Fi：`scripts/dev-android-wifi.cjs`
- USB：`scripts/dev-android-usb.cjs`
- 发布前清理：`scripts/prepare-release-clean-server-url.cjs`
- 行为要点：
  - 自动检测/复用开发服务器，必要时启动。
  - 更新 `capacitor.config.ts` 并输出诊断信息与修复指引。
  - `native-run` 失败时提供修复建议；设备离线时提示检查 `adb devices`。
  - 发布清理脚本支持“备份与注释/还原”：
    - 备份文件位置：`scripts/.backup/capacitor.config.ts.bak`
    - 手动备份并注释：`npm run android:release:prepare` 或 `node scripts/prepare-release-clean-server-url.cjs --mode backup`
    - 手动还原：`node scripts/prepare-release-clean-server-url.cjs --mode restore`

### 常见问题（自动化命令）
- 未检测到设备：授权 USB 调试并确保 `adb devices` 显示 `device` 状态。
- Wi‑Fi 无法访问开发服务器：检查电脑防火墙允许 5173 端口，确认同网段连接。
- 端口占用：关闭占用 5173 的进程或修改本地开发端口后重新运行命令。
- 首次运行没有刷新：尝试结束 App 后重新打开，或重新执行上述命令。

### 可配置项（端口与 IP 探测）
- 默认端口：`5173`。
  - 覆盖方式：
    - 命令行参数：`--port <number>`（示例见下文）。
    - 环境变量：`DEV_PORT`、`PORT`、`npm_config_port`（优先级依次降低）。
- 局域网 IP 探测（Wi‑Fi 模式）：
  - 探测顺序：优先选择 `192.168.*`，其后 `10.*`，其后 `172.16–31.*`，最后回退到首个非内网回环的 IPv4。
  - 覆盖方式：
    - 命令行参数：`--ip <LAN_IP>` 显式指定 IP。
    - 环境变量：`DEV_IP` 或 `DEV_HOST`。
    - 网卡优先：`--preferAdapter "<regex>"` 或环境变量 `DEV_ADAPTER`（按网卡名称正则优先匹配，如 `"WLAN|Wi-Fi|Ethernet"`）。
- npm 传参用法（示例）：
  ```bash
  # Wi‑Fi：自定义端口与 IP（并优先匹配 WLAN）
  npm run android:dev:wifi:auto -- --port 5180 --ip 192.168.1.8 --preferAdapter "WLAN|Wi-Fi"

  # USB：自定义端口（自动 localhost + adb reverse）
  npm run android:dev:usb:auto -- --port 5180
  ```
  - 两种模式都会以 `--host` 启动或复用 Vite 开发服务器，确保手机端可访问。

## 📦 产物与路径

- Debug APK：`android/app/build/outputs/apk/debug/app-debug.apk`
- Release APK：`android/app/build/outputs/apk/release/app-release.apk`
- Release AAB：`android/app/build/outputs/bundle/release/app-release.aab`

可选：使用 `scripts/tag-artifacts.cjs` 生成带标签命名的副本（例如 `mood-flow-<version>-release-<date>.apk|.aab`）。

### 统一命名与标签路径策略（CI 与本地一致）

- 文件命名：`mood-flow-<versionName>-<label(release|signed|store|sinternal)>-<yyyyMMddHHmm>-r<run>-g<sha>.apk|.aab`
- 标签与构建 flavor 的关系：
  - `release` 构建只生成：`release`、`signed`、`store` 三类标签文件
  - `debug` 构建只生成：`sinternal` 标签文件
- 标签路径（Cloudflare R2）：
  - `sinternal` → 上传到 `internal/` 路径（内部渠道），不更新对外 `updates.json`
  - `release`/`signed`/`store` → 上传到 `releases/` 路径（对外渠道），并在正式发布时更新远端 `updates.json`
- 本地/CI 一致的生成命令示例：
  ```bash
  # 本地（默认读取 android/app/build.gradle 的 versionName）
  node scripts/tag-artifacts.cjs --labels "release,signed,store,sinternal" --product mood-flow

  # CI 中已集成上述命名与标签策略，并只对对应 flavor 生成合适标签
  ```

## CI 构建与下载简述
- 推送到 main 分支将触发工作流：`.github/workflows/build-android.yml`
- 在 Actions 的 Artifacts 中下载：`android-apk-release-tagged`、`android-aab-release-tagged`、`android-aab-store-only`、`meta-sbom-and-manifest`
- 本地生成标签副本：`node scripts/tag-artifacts.cjs --labels "sinternal,store" --product mood-flow`

### 一键推送/打标签并监控 CI 运行

- 新增脚本：`npm run ci:push`
  - 功能：自动提交未保存更改、推送到当前分支、生成/更新标签（默认 `v{versionName}-ci{N}`）、推送标签触发 CI，并轮询对应的 Actions 运行，输出运行链接与结论。
  - 用法（基础）：
    ```bash
    npm run ci:push
    ```
  - 用法（带参数）：
    ```bash
    # 传入 commit 信息与指定标签（通过 -- 传递 PowerShell 参数）
    npm run ci:push -- -CommitMessage "chore(ci): trigger build" -Tag v1.1.96-ci8 -WaitSeconds 300
    # 指定分支（默认为当前分支或 main）
    npm run ci:push -- -Branch main
    ```
  - 运行结果摘要保存：`scripts/.ci-last-run.json`
  - 环境要求：
    - 读取 GitHub Actions 状态需要令牌：设置环境变量 `GITHUB_TOKEN`（需具备 `repo` 与 `actions:read` 权限），或已登录 `gh` CLI。
    - 未配置令牌时，脚本仍会完成推送/打标签，并提供通用的 Actions 列表页链接。

### Cloudflare R2 自动发布（APK 更新源）

- 构建完成后，工作流会自动选择 `mood-flow-*-store-*.apk`（若无则回退到 `*-release-*`）上传至 Cloudflare R2。
- 上传成功将生成公开下载地址，并写入 `public/updates.json` 的 `androidApkUrl` 字段，同时更新 `publishedAt` 为当天日期。
- 该链接用于 App 内置的 `ApkUpdater` 插件后台下载与安装。

配置步骤（一次性）：
- 在 Cloudflare R2 创建 Bucket（建议：`moodflow`），并开启 Public Access；记录 `Account ID`。
- 新建 API Token 或 Access Key（S3 兼容），记录 `Access Key ID` 与 `Secret Access Key`。
-（可选）为 Bucket 绑定自定义域名，得到公共前缀（例如 `https://updates.example.com`）。

在 GitHub 仓库 Secrets 中添加以下项：
- `R2_ACCOUNT_ID`：Cloudflare R2 的 Account ID，例如 `abcd1234efgh5678`。
- `R2_ACCESS_KEY_ID`：S3 兼容 Access Key ID。
- `R2_SECRET_ACCESS_KEY`：S3 兼容 Secret Access Key。
- `R2_BUCKET`：Bucket 名称，例如 `moodflow`。
- `R2_PUBLIC_BASE`：公开访问前缀；若留空，默认使用 `https://<bucket>.r2.dev`。

注意事项：
- 仅在存在签名配置（Release 构建）且 R2 Secrets 完整时执行对外上传与 `updates.json` 更新。
- Debug 构建会上传到 `internal/` 路径（标签含 `sinternal`），不会更新对外 `updates.json`，避免干扰用户更新源。
- 在 `pull_request` 事件下不会推送对 `updates.json` 的更改；`push/tag` 执行时会直接提交到触发分支。
- 对外下载路径为 `${R2_PUBLIC_BASE||https://<bucket>.r2.dev}/releases/<apk-name>`；内部渠道为 `${R2_PUBLIC_BASE||https://<bucket>.r2.dev}/internal/<apk-name>`。
- 若需强制更新或自定义发布说明，建议通过 CI 输入控制（见下文），由工作流自动写入 `public/updates.json` 的 `mandatory` 与 `releaseNotes`。

### CI 输入校验与回退（mandatory/notes）

- `mandatory`：在 CI 中统一规范为字符串 `true`/`false`；支持 `true/false/1/0/yes/no` 等输入，非法或空值自动回退为 `false`。
- `notes`：优先使用 `scripts/summarize-release-notes.cjs` 对传入的 `release_notes_path`（为空时回退到 `dist/meta/release-notes.md`）提炼摘要；若生成为空或文件不存在，使用默认模板：
  `Release <VERSION_NAME> generated by CI. See GitHub Release for details.`
- 更新 `updates.json` 时会携带上述 `mandatory` 与 `notes` 值，对外渠道（`releases/`）有效；内部渠道（`internal/`）不更新 `updates.json`。

### 可选：CI 冒烟测试开关
- 手动触发支持输入：`smoke_test`（是否运行冒烟测试，需要连接设备与 Windows Runner）与 `prefer_emulator`（设备选择偏好）。
- 工作流会设置环境变量 `SKIP_SMOKE_TEST` 与 `PREFER_EMULATOR`，当使用统一脚本时自动生效。
- 默认 CI 不进行设备安装与冒烟测试，仅进行构建与产物标记。

## 🔐 签名与 keystore

- 配置文件：`android/keystore.properties`
- 示例（路径相对 app 模块，斜杠 `/`）：
  ```properties
  storeFile=keystore/release.keystore
  storePassword=***
  keyAlias=***
  keyPassword=***
  ```
- CI 环境请使用加密的 secrets 注入，勿提交 keystore 与密码至版本库。

## 🧰 AAB 与 bundletool

- 导出 AAB：使用上文的一键命令或 `cd android && ./gradlew bundleRelease`
- 本地生成并安装 APKS（示例）：
  ```bash
  java -jar bundletool.jar build-apks \
    --bundle android/app/build/outputs/bundle/release/app-release.aab \
    --output app.apks \
    --connected-device \
    --mode default
  ```

## 🛠️ 故障排除（常见）

- 未检测到设备：检查 `adb devices` 是否为 `device` 状态且授权完成。
- 构建失败（签名）：确认 `android/keystore.properties` 路径与密码。
- 找不到 adb：脚本会尝试从 `android/local.properties` 的 `sdk.dir` 定位 `platform-tools/adb.exe`。

## 📚 相关文档

- 构建与发布指南（AAB/APK、R8、命名与输出路径）：已整合于本文件
- 项目总览与开发说明：README.md

### 核心功能

1. **📝 记录情绪**

   - 选择情绪类型（开心、难过、愤怒等）
   - 设置情绪强度（1-10 级）
   - 添加文字描述
   - 拍照记录瞬间

2. **📊 查看分析**

   - 情绪历史记录
   - 趋势分析图表
   - 情绪模式识别
   - 周期性统计

3. **💾 数据管理**
   - 导出情绪数据
   - 分享到社交平台
   - 备份和恢复
   - 隐私设置

### 移动端手势

- **👆 点击** - 选择和确认
- **👈 滑动** - 切换页面
- **👆 长按** - 快捷操作
- **🤏 捏合** - 缩放图表

## 🔧 故障排除

### 构建问题

```bash
# 问题：Android SDK 未找到
# 解决：配置 ANDROID_HOME 环境变量
export ANDROID_HOME=/path/to/android/sdk

# 问题：Gradle 构建失败
# 解决：清理并重新构建
cd android
./gradlew clean
./gradlew assembleDebug
```

### 运行时问题

```bash
# 问题：应用崩溃
# 解决：查看日志
adb logcat | grep "Capacitor"

# 问题：权限被拒绝
# 解决：手动授予权限
# 设置 → 应用管理 → 心流日记 权限管理
```

## 📈 性能优化

### 小米 13 Ultra 优化

1. **电池优化**

   ```
   设置 → 电池 → 应用电池管理 → 心流日记 无限制
   ```

2. **内存管理**

   ```
   设置 → 应用管理 → 心流日记 存储 → 清理缓存
   ```

3. **网络优化**
   - 使用 WiFi 进行数据同步
   - 启用数据压缩
   - 定期清理缓存

## 🔄 更新流程

```bash
# 1. 获取最新代码
git pull origin main

# 2. 安装新依赖
npm install

# 3. 重新构建
npm run android:build

# 4. 安装更新
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### 自动更新源（Cloudflare R2）联动
- CI 会在 Release 构建后自动更新 `public/updates.json` 的 `androidApkUrl` 与 `publishedAt`。
- App 在启动或检查更新时读取 `public/updates.json`，通过 `ApkUpdater` 插件后台下载并安装该 APK。
- 若遇到未知来源安装限制，插件会引导用户开启“安装未知应用”权限。

## 📚 相关文档

- 🔧 构建与发布指南（AAB/APK、R8、命名标签、标准输出路径）：本文件
- 📖 项目总览与开发说明入口：[README.md](./README.md)
- ℹ️ 注：原 ANDROID_GUIDE.md、AUTHENTICATION_FIX.md、DEPLOYMENT.md、USER_GUIDE.md 的内容已合并至上述两份文档，且这几份独立文档已从主分支移除，仅保留在 Git 历史中
- 🐛 [问题反馈](https://github.com/your-repo/issues)

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE) 文件

---

## 🎉 开始体验

现在就开始使用心流日记 Android 版，记录您的每一个情绪瞬间！

**下载 APK → 安装应用 → 开始记录 → 分析情绪 → 改善心情** 💚

---

_专为小米 13 Ultra (Android 15, HyperOS 2) 优化_  
_支持所有 Android 7.0+ 设备_

## 📚 文档索引（Android 入口）

- 构建与发布指南：本文件（README_ANDROID.md）
- 项目总览与入口：[README.md](./README.md)

> 本文件作为 Android 端文档的入口，包含最新的构建与发布流程。

## 📦 构建产物路径说明（标准目录）

- APK Release：`android/app/build/outputs/apk/release/`
- APK Debug：`android/app/build/outputs/apk/debug/`
- AAB Release：`android/app/build/outputs/bundle/release/`
- AAB Debug：`android/app/build/outputs/bundle/debug/`

## 🏷️ 分发命名标签

构建分发文件命名规则：`mood-flow-{versionName}-{标识(release|signed|sinternal|store)}-{yyyyMMddHHmm}`

- `release`：标准发布构建
- `signed`：强调已签名（线下分发/第三方平台可用）
- `sinternal`：内部测试或受限渠道标识
- `store`：用于应用商店提交/商店渠道

## 🔒 R8 混淆与 ProGuard 关键说明

- 已启用 `minifyEnabled true` 与 `shrinkResources true`
- 使用优化规则：`proguard-android-optimize.txt`
- 关键保留规则位于：`android/app/proguard-rules.pro`
  - `-keep class com.getcapacitor.** { *; }`
  - `-keep class * extends com.getcapacitor.Plugin { *; }`
  - 保留 WebView JS 接口：`-keepclassmembers class * { @android.webkit.JavascriptInterface <methods>; }`
  - 保留注解属性：`-keepattributes *Annotation*`（确保 `@JavascriptInterface` 在运行时可用）

## 📲 ADB 安装示例

- 安装命令：
  - `adb install -r "android/app/build/outputs/apk/release/mood-flow-<version>-<tag>-<date>.apk"`
- 如果本机未配置 PATH：从 `android/local.properties` 的 `sdk.dir` 定位 `platform-tools/adb.exe` 后执行。

## 🧩 图标生成与优化

为统一团队使用方式，项目提供了标准化的图标生成与优化脚本入口（npm scripts）。

### 依赖与输入资源
- 依赖：Node.js 18+，依赖库 sharp 已在 devDependencies 中声明并安装
- 输入：
  - 前景矢量图：public/icon-512-convert2.svg（用于生成 Android 前景图标 drawable-*）
  - 大尺寸位图源：public/icon-2160.png（用于生成 512/192、favicon 以及 Android 各密度 mipmap）

### 常用命令
```bash
# 1) 前景图标（标准模式）：按 Android 各密度生成 app_icon_foreground.png
npm run icons:foreground

# 2) 前景图标（紧凑模式）：在同目录生成 app_icon_foreground.compact.png，内置透明留白
npm run icons:foreground:compact

# 3) 优化位图源并生成多尺寸输出（512/192、favicon、Android 各密度 mipmap）
npm run icons:optimize
```

### 输出位置说明
- 前景图标（foreground）：android/app/src/main/res/drawable-*/app_icon_foreground(.compact).png
- Android 启动图标（mipmap）：android/app/src/main/res/mipmap-*/ic_launcher(.round).png
- Web/PWA 资源：public/icon-512.png、public/icon-192.png、public/favicon.png

### 推荐工作流
1. 使用矢量前景（SVG）生成 Android 前景各密度，确保透明背景与适配性
2. 使用位图源（2160px）优化生成 512/192 与 favicon，满足 Web/PWA 与 Android mipmap 输出
3. 如需更紧凑的前景（留白更大），使用 compact 模式生成 .compact.png 文件进行对比与选型

### 维护建议
- 当更新 icon 源素材时，优先更新 SVG 矢量（public/icon-512-convert2.svg）
- 位图源（public/icon-2160.png）体积较大，建议定期检查 Git 历史，避免无谓膨胀
- 如需探索完全矢量管线，可结合脚本：scripts/png_to_svg.py 将现有 PNG 近似转换为路径 SVG，再进入矢量工作流

#### 使用 png_to_svg.py 示例
```bash
python scripts/png_to_svg.py \
  --input public/icon-512.png \
  --output public/icon-512-vector.svg \
  --colors 8 \
  --tolerance 1.5 \
  --area-threshold 32
```

> 注意：该转换为近似向量化，复杂渐变与阴影将被简化为多色平面路径。适用于探索矢量工作流，不保证与原 PNG 完全一致。
