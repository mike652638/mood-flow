#!/usr/bin/env node
/*
 * USB Android Dev Runner
 * - Starts Vite dev server (or reuses if already running)
 * - Updates capacitor.config.ts server.url -> localhost:port + cleartext
 * - adb reverse port mapping
 * - Syncs and runs on Android device
 */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const CONFIG_PATH = path.join(ROOT, 'capacitor.config.ts');
const DEFAULT_PORT = 5173;

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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function isServerUp(url, timeoutMs = 1000) {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res.ok || res.status >= 200;
  } catch (e) {
    return false;
  }
}

function updateCapacitorServerUrlLocal(port) {
  const targetUrl = `http://localhost:${port}`;
  const src = fs.readFileSync(CONFIG_PATH, 'utf8');
  const serverBlockMatch = src.match(/server:\s*{[\s\S]*?}/m);
  if (!serverBlockMatch) throw new Error('未找到 server 配置块，请检查 capacitor.config.ts');
  let block = serverBlockMatch[0];
  // url: replace or insert
  if (/url:\s*'[^']*'/.test(block)) {
    block = block.replace(/url:\s*'[^']*'/, `url: '${targetUrl}'`);
  } else {
    block = block.replace(/hostname:\s*'[^']*',?/, (m) => `${m}\n    url: '${targetUrl}',`);
  }
  // ensure cleartext: true
  if (!/cleartext:\s*true/.test(block)) {
    block = block.replace(/url:\s*'[^']*',?/, (m) => `${m}\n    cleartext: true,`);
  }
  const updated = src.replace(serverBlockMatch[0], block);
  fs.writeFileSync(CONFIG_PATH, updated, 'utf8');
  console.log(`✓ 已更新 server.url -> ${targetUrl} 且开启 cleartext`);
}

function run(cmd, args, opts = {}) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true, ...opts });
  if (res.status !== 0) throw new Error(`${cmd} 执行失败，code=${res.status}`);
}

(async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
      console.log(`
用法：node scripts/dev-android-usb.cjs [--port 5173] [--help]

参数：
  --port   指定开发端口（默认 5173，可被 DEV_PORT/PORT/npm_config_port 覆盖）
  --help   显示帮助
环境变量：
  DEV_PORT
`);
      process.exit(0);
    }
    const port = Number(args.port || process.env.DEV_PORT || process.env.PORT || process.env.npm_config_port || DEFAULT_PORT);
    const urlLocal = `http://localhost:${port}/`;
    if (!(await isServerUp(urlLocal))) {
      console.log('… 正在启动 Vite 开发服务器');
      const child = spawn('npm', ['run', 'dev', '--', '--port', String(port), '--host'], {
        cwd: ROOT,
        stdio: ['ignore', 'inherit', 'inherit'],
        shell: true,
        detached: true
      });
      child.unref();
      for (let i = 0; i < 40; i++) {
        if (await isServerUp(urlLocal)) break;
        await sleep(500);
      }
      if (!(await isServerUp(urlLocal))) throw new Error('开发服务器启动超时');
      console.log(`✓ 开发服务器已启动：${urlLocal}`);
    } else {
      console.log(`✓ 检测到开发服务器已运行：${urlLocal}`);
    }

    updateCapacitorServerUrlLocal(port);

    // adb reverse
    run('adb', ['devices']);
    run('adb', ['reverse', `tcp:${port}`, `tcp:${port}`]);
    console.log('✓ 已建立 USB 端口反向映射');

    run('npm', ['run', 'android:sync']);
    run('npm', ['run', 'android:run']);
    console.log('✓ 已通过 USB 直连方案安装并启动 APP，手机应加载开发服务器进行热更新');
    console.log(`提示：如无法连接，请确认开发者选项的 USB 调试（安全设置）与通过USB安装已开启`);
  } catch (err) {
    console.error('✗ USB 自动化运行失败：', err.message);
    console.error('修复建议：1) 检查设备连接；2) 端口映射失败时重插线；3) 端口占用或防火墙限制');
    process.exit(1);
  }
})();