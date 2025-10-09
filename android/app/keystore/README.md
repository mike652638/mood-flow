# Android Keystore 管理与使用指南

本目录用于统一管理 Android 应用签名相关配置与脚本。包含：

- `keystore.properties.example`：示例配置文件（不含敏感信息）。
- `keystore.properties`：实际配置文件（包含敏感信息，已被忽略，不入库）。
- `release.keystore`：签名证书（敏感文件，已被忽略，不入库）。
- `keystore.b64`：证书 Base64（敏感文件，已被忽略，不入库）。
- `regenerate-keystore.ps1`：在本地重新生成 keystore 与相关文件的脚本。

## keystore.properties 配置说明

路径：`android/app/keystore/keystore.properties`

示例（请参考 `keystore.properties.example`）：

```
storeFile=keystore/release.keystore
storePassword=<你的 Store 密码>
keyAlias=<你的别名>
keyPassword=<你的 Key 密码>
```

注意：

- `storeFile` 为相对 `android/app` 目录的路径，推荐固定为 `keystore/release.keystore`。
- `storePassword`、`keyAlias`、`keyPassword` 为敏感值，不要提交到仓库。

## 重新生成 keystore（PowerShell）

脚本：`regenerate-keystore.ps1`

用法（从仓库根目录或本目录运行 Powershell）：

```
android/app/keystore/regenerate-keystore.ps1 -KeyAlias "moodflow" -StorePassword "<STORE_PASS>" -KeyPassword "<KEY_PASS>" -DName "CN=moodflow.joyful.host, OU=Development, O=Joyful, L=Wuhan, S=Wuhan, C=CN"
```

脚本行为：

- 在 `android/app/keystore/release.keystore` 生成新的证书。
- 写入/更新本地 `keystore.properties`（不入库）。
- 生成 `keystore.b64`（用于 GitHub Secrets）。
  

你也可以不传参数，脚本会尝试读取同目录下的 `keystore.properties` 作为默认值。

### 无参数运行的行为说明（重要）

- 若检测到已有 `release.keystore`，脚本会先验证 `keystore.properties` 中的 `storePassword`、`keyAlias`、`keyPassword` 与现有 keystore 是否匹配。
- 验证失败时（例如仅修改了 `keystore.properties`，但未重建 keystore），脚本会给出明确错误并退出，不会破坏现有 keystore。
- 验证成功时，脚本会跳过重建，仅导出 Base64 并规范化写回 `keystore.properties`。
- 当你需要更换口令或别名时，使用 `-Force` 进行重建；脚本会在重建前自动备份旧的 `release.keystore` 为 `release.keystore.bak.<timestamp>`。

### 强制重建示例

```
android/app/keystore/regenerate-keystore.ps1 -Force
```

## 更新 GitHub Actions Secrets

需要在仓库设置的 `Actions Secrets` 中更新以下键：

- `ANDROID_KEYSTORE_BASE64`：`keystore.b64` 的全部内容（单行，无换行）。
- `ANDROID_KEYSTORE_PASSWORD`：与 `storePassword` 一致。
- `ANDROID_KEY_ALIAS`：与 `keyAlias` 一致。
- `ANDROID_KEY_PASSWORD`：与 `keyPassword` 一致。

生成 Base64 的方式：

- Windows PowerShell：

  ```powershell
  [Convert]::ToBase64String([IO.File]::ReadAllBytes('android/app/keystore/release.keystore')) | Set-Content -Encoding ascii android/app/keystore/keystore.b64
  ```

- macOS/Linux：

  ```bash
  base64 -w 0 android/app/keystore/release.keystore > android/app/keystore/keystore.b64
  ```

## CI 与 Gradle 路径约定

- Gradle 从 `android/app/keystore/keystore.properties` 加载签名配置。
- CI 在“Prepare signing keys”步骤会解码 `ANDROID_KEYSTORE_BASE64` 到 `android/app/keystore/release.keystore`，并写入同目录下的 `keystore.properties`。

## 安全与忽略规则

本目录中的以下文件已加入 `.gitignore`，不会提交到仓库：

- `keystore.properties`
- `release.keystore`
- `keystore.b64`

提交示例与脚本用于方便管理与复现，请勿将真实密钥与口令写入示例文件。
