# 心流日记（项目总览）

本项目是使用 React + TypeScript + Vite 开发的跨平台应用，Android 端通过 Capacitor 集成原生能力并使用 Gradle 构建 APK/AAB。

## 目录索引

- Android 端入口与使用说明：README_ANDROID.md
- 图标生成与优化与脚本使用说明：README_ANDROID.md 的“图标生成与优化”章节
- Android 构建与发布指南：README_ANDROID.md
- 部署/发布（Web/PWA 等其它平台）：DEPLOYMENT.md

## 开发快速开始

```bash
npm install
npm run dev
```

如需打包 Android：请参考 README_ANDROID.md。
## 部署与运行时配置注入（重要）

为确保密钥安全，生产环境请通过服务器模板或中间层在入口 HTML 注入运行时配置，并避免将 `.env.local` 上传。

示例（在 `index.html` 的 `<head>` 中被占位脚本接收）：

```html
<script>
  window.__RUNTIME_CONFIG__ = {
    DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
    DEEPSEEK_API_KEY: '<server-injected-secret>',
    DEEPSEEK_MODEL: 'deepseek-chat'
  };
</script>
```

- 前端代码将优先读取 `window.__RUNTIME_CONFIG__`，仅在缺失时才回退到 `import.meta.env`。
- `.vercelignore` 已忽略 `.env.local`，如使用其他平台请自行配置忽略规则。
- 本地开发请在 `.env.local` 写入测试密钥；生产环境务必通过运行时注入，避免打包泄露。
