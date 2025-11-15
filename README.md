# 心流日记（MoodFlow）

<div align="center">

📱 一个跨平台的情绪日记应用，帮助你记录、追踪和理解自己的情绪变化

[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.3-purple.svg)](https://vitejs.dev/)
[![Capacitor](https://img.shields.io/badge/Capacitor-6.2-green.svg)](https://capacitorjs.com/)

</div>

## 📱 项目概述

**心流日记**是一个跨平台情绪日记应用，旨在帮助用户记录和追踪日常情绪变化，通过可视化分析了解自己的心理状态，并提供 AI 心理陪伴功能。本项目使用 React + TypeScript + Vite 开发，Android 端通过 Capacitor 集成原生能力并使用 Gradle 构建 APK/AAB。

### ✨ 核心特色

- 🎯 **12 种情绪类型** - 从开心到抑郁，全面覆盖情绪谱系
- 📊 **可视化分析** - 情绪趋势图、词云分析，直观了解自己
- 🤖 **AI 心理陪伴** - 基于 DeepSeek AI 的对话疏导和自助练习
- 🔒 **隐私优先** - Supabase 行级安全策略，数据完全隔离
- 🌓 **精美设计** - 深色/浅色主题，玻璃态卡片，流畅动画
- 📱 **跨平台** - Web、PWA、Android 原生，一套代码多端运行

## 🚀 快速开始

### 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

### 构建部署

```bash
# Web 构建
npm run build

# 部署到 Vercel
npm run web:deploy

# Android 构建（详见 README_ANDROID.md）
npm run android:release:auto
```

## 📖 文档索引

- **Android 开发** - [README_ANDROID.md](./README_ANDROID.md)
- **图标优化** - README_ANDROID.md 的"图标生成与优化"章节
- **部署指南** - DEPLOYMENT.md（Web/PWA 等平台）

## 🛠️ 技术栈

### 前端框架

- **React 18** - 现代化组件开发
- **TypeScript** - 类型安全
- **Vite 6** - 快速构建工具
- **React Router 7** - 路由管理
- **Zustand** - 轻量级状态管理

### UI 设计

- **Tailwind CSS** - 实用优先的 CSS 框架
- **Lucide React** - 现代图标库
- **Sonner** - Toast 通知组件
- **Recharts + Visx** - 数据可视化（情绪趋势图、词云图）

### 跨平台能力

- **Capacitor 6** - Web 转原生应用
- 集成功能：相机、文件系统、本地通知、语音录制、分享等

### 后端服务

- **Supabase** - 认证、数据库、存储、实时订阅
- **PostgreSQL** - 关系型数据库
- **DeepSeek AI** - 心理陪伴对话模型

## 🎯 核心功能

### 1. 情绪记录

- ✅ 12 种情绪类型（开心、兴奋、感动、充实、自信、平静、难过、愤怒、焦虑、压力、恐慌、抑郁）
- ✅ 10 级情绪强度评分
- ✅ 文字日记与标签分类
- ✅ 图片和音频附件支持

### 2. 数据分析

- ✅ 今日情绪概览（记录次数、平均强度、主要情绪、连续天数）
- ✅ 情绪趋势图表
- ✅ 词云可视化
- ✅ 历史记录查看

### 3. AI 心理陪伴

- ✅ 智能对话疏导
- ✅ 自助练习指导
- ✅ 基于上下文的个性化回复

### 4. 个性化设置

- ✅ 深色/浅色主题切换
- ✅ 沉浸式模式（移动端）
- ✅ 自动更新检查
- ✅ 提醒通知管理

### 5. 用户系统

- ✅ 邮箱注册/登录
- ✅ 密码找回
- ✅ 个人资料管理
- ✅ 数据安全隔离

## 📂 项目结构

```
moodflow/
├── src/
│   ├── pages/              # 页面组件
│   │   ├── Home.tsx            # 首页（今日概览 + 快速记录）
│   │   ├── Record.tsx          # 详细记录页
│   │   ├── Analytics.tsx       # 趋势分析页
│   │   ├── Mentor.tsx          # AI 伴侣页
│   │   ├── Settings.tsx        # 设置页
│   │   └── Login/Register...   # 认证页面
│   ├── components/         # 通用组件
│   │   ├── Button.tsx          # 按钮组件
│   │   ├── Card.tsx            # 卡片组件
│   │   ├── Header.tsx          # 页头组件
│   │   ├── Modal.tsx           # 模态框组件
│   │   └── ...
│   ├── hooks/              # 自定义 Hooks
│   │   ├── useImmersiveMode.ts # 沉浸式模式
│   │   ├── useMobile.ts        # 移动端检测
│   │   └── useTheme.ts         # 主题管理
│   ├── store/              # Zustand 状态管理
│   │   └── index.ts            # 全局状态
│   ├── lib/                # 工具库
│   │   ├── supabase.ts         # Supabase 客户端
│   │   ├── llm.ts              # AI 模型集成
│   │   └── utils.ts            # 通用工具
│   ├── types/              # TypeScript 类型
│   │   ├── database.ts         # 数据库类型
│   │   ├── mood.ts             # 情绪相关类型
│   │   └── index.ts            # 通用类型
│   ├── constants/          # 常量配置
│   │   ├── moods.ts            # 情绪选项
│   │   └── presets.ts          # 预设数据
│   └── utils/              # 工具函数
│       ├── capacitor.ts        # Capacitor 工具
│       ├── permissions.ts      # 权限管理
│       ├── reminders.ts        # 提醒功能
│       └── update.ts           # 更新检查
├── supabase/               # 数据库
│   └── migrations/             # 数据库迁移脚本
│       └── 001_initial_schema.sql
├── android/                # Android 原生代码
├── scripts/                # 构建和部署脚本
│   ├── build-android.cmd       # Android 构建脚本
│   ├── optimize-icons.cjs      # 图标优化
│   └── ...
├── public/                 # 静态资源
├── capacitor.config.ts     # Capacitor 配置
├── vite.config.ts          # Vite 配置
└── package.json            # 项目依赖
```

## 🗄️ 数据库设计

### 核心表结构

#### users - 用户表

- `id` - 用户 UUID
- `email` - 邮箱（唯一）
- `name` - 用户名
- `avatar_url` - 头像 URL
- `created_at` / `updated_at` - 时间戳

#### mood_records - 情绪记录表

- `id` - 记录 UUID
- `user_id` - 用户 ID（外键）
- `mood_type` - 情绪类型（枚举）
- `mood_intensity` - 情绪强度（1-10）
- `diary_content` - 日记内容
- `tags` - 标签数组
- `created_at` / `updated_at` - 时间戳

#### media_files - 媒体文件表

- `id` - 文件 UUID
- `user_id` - 用户 ID
- `mood_record_id` - 关联记录 ID（可选）
- `file_name` / `file_path` / `file_type` / `file_size` - 文件信息
- `public_url` - 公开访问 URL

### 安全特性

- ✅ **行级安全策略（RLS）** - 用户只能访问自己的数据
- ✅ **自动更新触发器** - 自动更新 `updated_at` 字段
- ✅ **存储桶策略** - 文件访问权限控制
- ✅ **索引优化** - 提升查询性能

## 🔒 安全配置

### 运行时配置注入（重要）

为确保 API 密钥安全，生产环境请通过服务器模板或中间层在入口 HTML 注入运行时配置。

**示例配置**（在 `index.html` 的 `<head>` 中）：

```html
<script>
  window.__RUNTIME_CONFIG__ = {
    DEEPSEEK_BASE_URL: 'https://api.deepseek.com',
    DEEPSEEK_API_KEY: '<server-injected-secret>',
    DEEPSEEK_MODEL: 'deepseek-chat'
  };
</script>
```

**配置说明**：

- ✅ 前端代码优先读取 `window.__RUNTIME_CONFIG__`
- ✅ 缺失时回退到 `import.meta.env`
- ✅ `.vercelignore` 已忽略 `.env.local`
- ⚠️ 本地开发在 `.env.local` 写入测试密钥
- ⚠️ 生产环境务必通过运行时注入，避免打包泄露

## 🎨 设计亮点

### 心理学专业性

- 📚 首页展示心理学大师名言（维克多·弗兰克尔、卡尔·罗杰斯等）
- 🧠 基于心理学理论的情绪分类体系
- 💡 专业的情绪疏导建议

### 视觉设计

- 🎨 精美的渐变和玻璃态效果
- 🌈 直观的情绪表情符号系统
- 📱 完全响应式布局，适配所有屏幕
- 🌙 护眼的深色模式

### 用户体验

- ⚡ 快速记录 - 3 步完成情绪打卡
- 📊 可视化分析 - 一目了然的趋势图表
- 🔔 智能提醒 - 培养记录习惯
- 🚀 流畅动画 - 愉悦的交互体验

## 📱 平台支持

### Web / PWA

- ✅ 现代浏览器（Chrome、Firefox、Safari、Edge）
- ✅ 响应式设计（手机、平板、桌面）
- ✅ 可安装为 PWA

### Android 原生

- ✅ Android 7.0+（API 24+）
- ✅ APK 和 AAB 打包
- ✅ 原生功能集成（相机、通知、文件等）
- ✅ Google Play 发布准备

### 未来计划

- 🔜 iOS 版本
- 🔜 桌面应用（Electron）
- 🔜 微信小程序

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 开源协议

本项目采用 MIT 协议开源。

## 🙏 致谢

感谢以下开源项目和服务：

- [React](https://reactjs.org/)
- [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Capacitor](https://capacitorjs.com/)
- [Supabase](https://supabase.com/)
- [DeepSeek AI](https://www.deepseek.com/)

---

<div align="center">

用 ❤️ 打造 | 愿每个人都能理解和关爱自己的情绪

</div>
