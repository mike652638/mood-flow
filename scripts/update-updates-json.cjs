#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--apk-url') out.apkUrl = args[++i];
    else if (a === '--version') out.version = args[++i];
    else if (a === '--mandatory') out.mandatory = (args[++i] || '').toLowerCase() === 'true';
    else if (a === '--publishedAt') out.publishedAt = args[++i];
    else if (a === '--notes') out.notes = args[++i];
  }
  return out;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function updateJson(opts) {
  const file = path.join(process.cwd(), 'public', 'updates.json');
  // Read as UTF-8 and strip BOM defensively, then parse
  const raw = fs.readFileSync(file, 'utf8');
  const rawNoBom = raw.replace(/^\uFEFF/, '');
  const json = JSON.parse(rawNoBom);

  if (opts.apkUrl) json.androidApkUrl = opts.apkUrl;
  if (opts.version) json.latestVersion = opts.version;
  if (typeof opts.mandatory === 'boolean') json.mandatory = opts.mandatory;
  json.publishedAt = opts.publishedAt || todayISO();
  if (opts.notes) {
    json.releaseNotes = opts.notes;
    // 补充结构化变更日志，便于客户端更友好地展示更新内容
    // 规则：若存在 notes，则将其作为 highlights 的第一项；保留已存在的 changelog 结构
    const initChangelog = () => ({ highlights: [], items: [] });
    if (!json.changelog || typeof json.changelog !== 'object') {
      json.changelog = initChangelog();
    } else {
      // 确保字段存在且类型正确
      if (!Array.isArray(json.changelog.highlights)) json.changelog.highlights = [];
      if (!Array.isArray(json.changelog.items)) json.changelog.items = [];
    }
    const note = String(opts.notes).trim();
    if (note && !json.changelog.highlights.includes(note)) {
      json.changelog.highlights.unshift(note);
    }
  }

  const out = JSON.stringify(json, null, 2) + '\n';
  fs.writeFileSync(file, out, 'utf8');
  console.log('Updated public/updates.json');
}

const opts = parseArgs();
if (!opts.apkUrl) {
  console.error('Usage: node scripts/update-updates-json.cjs --apk-url <URL> [--version <ver>] [--mandatory true|false] [--publishedAt YYYY-MM-DD] [--notes "text"]');
  process.exit(1);
}
updateJson(opts);