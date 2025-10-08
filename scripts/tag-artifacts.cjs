#!/usr/bin/env node
/**
 * Tag Android build artifacts with labels (release/signed/sinternal/store) and versionName.
 * Works locally and in CI.
 *
 * Usage examples:
 *  - node scripts/tag-artifacts.js --labels "sinternal,store" --product mood-flow
 *  - node scripts/tag-artifacts.js --labels release,signed,sinternal,store
 *  Environment variable alternative: TAG_LABELS="sinternal,store"
 */

const fs = require('fs');
const path = require('path');

function log(msg) {
  console.log(msg);
}
function warn(msg) {
  console.warn(msg);
}
function err(msg) {
  console.error(msg);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq > -1) {
        const key = a.slice(2, eq);
        const val = a.slice(eq + 1);
        params[key] = val;
      } else {
        const key = a.slice(2);
        const next = args[i + 1];
        if (next && !next.startsWith('--')) {
          params[key] = next;
          i++;
        } else {
          params[key] = true;
        }
      }
    }
  }
  return params;
}

function readVersionName() {
  const gradlePath = path.join('android', 'app', 'build.gradle');
  try {
    const txt = fs.readFileSync(gradlePath, 'utf8');
    const m = txt.match(/versionName\s+"([^"]+)"/);
    if (m) return m[1];
    warn('versionName not found in android/app/build.gradle, defaulting to 0.0.0');
    return '0.0.0';
  } catch (e) {
    warn('Cannot read android/app/build.gradle, defaulting versionName to 0.0.0');
    return '0.0.0';
  }
}

function formatDate(ts = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return (
    ts.getFullYear().toString() + pad(ts.getMonth() + 1) + pad(ts.getDate()) + pad(ts.getHours()) + pad(ts.getMinutes())
  );
}

function getCiStamp(args = {}) {
  // Prefer explicit args, fall back to GitHub Actions env
  const run = args.run || process.env.GITHUB_RUN_NUMBER;
  const shaFull = args.sha || process.env.GITHUB_SHA || '';
  const sha = shaFull ? String(shaFull).slice(0, 7) : '';
  const parts = [];
  if (run) parts.push(`r${run}`);
  if (sha) parts.push(`g${sha}`);
  return parts.length ? `-${parts.join('-')}` : '';
}

function ensureArray(str, def = []) {
  if (!str) return def;
  if (Array.isArray(str)) return str;
  return String(str)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

(function main() {
  const args = parseArgs();
  const labels = ensureArray(args.labels || process.env.TAG_LABELS || 'sinternal,store');
  const overwrite = !!args.overwrite;
  const dryRun = !!args['dry-run'];
  const product = args.product || args.name || 'mood-flow';
  const versionName = args.version || readVersionName();
  const dateStamp = args.date || formatDate();
  const ciSuffix = getCiStamp(args);

  const sources = [
    {
      kind: 'apk',
      flavor: 'release',
      file: path.join('android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
    },
    {
      kind: 'aab',
      flavor: 'release',
      file: path.join('android', 'app', 'build', 'outputs', 'bundle', 'release', 'app-release.aab')
    },
    {
      kind: 'apk',
      flavor: 'debug',
      file: path.join('android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
    },
    {
      kind: 'aab',
      flavor: 'debug',
      file: path.join('android', 'app', 'build', 'outputs', 'bundle', 'debug', 'app-debug.aab')
    }
  ];

  log(
    `Tagging artifacts with labels: ${labels.join(
      ', '
    )} (product=${product}, version=${versionName}, date=${dateStamp})`
  );

  let found = 0;
  let copied = 0;

  for (const src of sources) {
    if (!fs.existsSync(src.file)) {
      continue;
    }
    found++;
    const dir = path.dirname(src.file);
    const ext = src.kind === 'apk' ? '.apk' : '.aab';

    for (const label of labels) {
      const targetName = `${product}-${versionName}-${label}-${dateStamp}${ciSuffix}${ext}`;
      const targetPath = path.join(dir, targetName);

      if (fs.existsSync(targetPath) && !overwrite) {
        log(`Skip existing: ${path.relative(process.cwd(), targetPath)}`);
        continue;
      }

      if (dryRun) {
        log(`[dry-run] COPY ${src.file} -> ${targetPath}`);
      } else {
        fs.copyFileSync(src.file, targetPath);
        copied++;
        log(`Copied: ${path.relative(process.cwd(), targetPath)}`);
      }
    }
  }

  if (found === 0) {
    warn('No source artifacts found. Expected build outputs under android/app/build/outputs/.');
    process.exitCode = 0; // do not fail CI
    return;
  }

  log(`Done. Sources found: ${found}, files copied: ${copied}.`);
})();
