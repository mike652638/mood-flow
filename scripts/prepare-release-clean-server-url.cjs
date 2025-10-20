#!/usr/bin/env node
/*
 * Release Prep: Backup & Comment/Restore server.url in capacitor.config.ts
 * - backup: 备份当前配置并将 server.url 注释掉，确保打包使用 dist 静态资源
 * - restore: 从备份恢复，便于构建结束后继续开发
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'capacitor.config.ts');
const BACKUP_DIR = path.join(ROOT, 'scripts', '.backup');
const BACKUP_PATH = path.join(BACKUP_DIR, 'capacitor.config.ts.bak');

function parseArgs(argv = []) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
      args[key] = val;
    }
  }
  return args;
}

function ensureWebDirDist(src) {
  if (!/webDir:\s*'dist'/.test(src)) {
    console.warn('! 警告：未检测到 webDir:"dist"，当前脚本不强制修改该字段');
  }
}

function commentOutServerUrl(src) {
  const serverBlockMatch = src.match(/server:\s*{[\s\S]*?}/m);
  if (!serverBlockMatch) throw new Error('未找到 server 配置块，请检查 capacitor.config.ts');
  let block = serverBlockMatch[0];
  // 将 url: '...' 或带逗号的行注释掉，保留缩进与文本
  if (/url:\s*'[^']*'/.test(block)) {
    block = block.replace(/\n(\s*)url:\s*'[^']*',?/g, (m, indent) => `\n${indent}// ${m.trim()}`);
  }
  return src.replace(serverBlockMatch[0], block);
}

function backupAndComment() {
  const src = fs.readFileSync(CONFIG_PATH, 'utf8');
  ensureWebDirDist(src);
  // 备份目录与文件
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(BACKUP_PATH, src, 'utf8');
  const updated = commentOutServerUrl(src);
  fs.writeFileSync(CONFIG_PATH, updated, 'utf8');
  console.log(`✓ 已创建备份并注释 server.url → ${path.relative(ROOT, BACKUP_PATH)}`);
}

function restoreBackup() {
  if (!fs.existsSync(BACKUP_PATH)) {
    console.warn('! 未找到备份文件，跳过恢复');
    return;
  }
  const bak = fs.readFileSync(BACKUP_PATH, 'utf8');
  fs.writeFileSync(CONFIG_PATH, bak, 'utf8');
  try { fs.unlinkSync(BACKUP_PATH); } catch {}
  console.log('✓ 已从备份恢复 server.url 至构建前状态');
}

try {
  const args = parseArgs(process.argv.slice(2));
  const mode = (args.mode || 'backup').toLowerCase();
  if (mode === 'backup') {
    backupAndComment();
  } else if (mode === 'restore') {
    restoreBackup();
  } else if (mode === 'clean') {
    // 兼容旧行为：移除 url（不推荐）
    const src = fs.readFileSync(CONFIG_PATH, 'utf8');
    const serverBlockMatch = src.match(/server:\s*{[\s\S]*?}/m);
    if (!serverBlockMatch) throw new Error('未找到 server 配置块，请检查 capacitor.config.ts');
    let block = serverBlockMatch[0];
    if (/url:\s*'[^']*'/.test(block)) {
      block = block.replace(/\n\s*url:\s*'[^']*',?/g, '\n');
    }
    const updated = src.replace(serverBlockMatch[0], block);
    fs.writeFileSync(CONFIG_PATH, updated, 'utf8');
    console.log('✓ 已移除 server.url（clean 模式），发布使用 dist 静态资源');
  } else {
    throw new Error(`未知模式: ${mode}，可用模式：backup | restore | clean`);
  }
} catch (err) {
  console.error('✗ 发布准备脚本失败：', err.message);
  process.exit(1);
}