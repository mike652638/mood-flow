#!/usr/bin/env node
/*
 * Wi‑Fi Android Dev Runner
 * - Starts Vite dev server (or reuses if already running)
 * - Detects local LAN IP and effective port
 * - Updates capacitor.config.ts server.url + cleartext
 * - Syncs and runs on Android device
 * - Prints helpful diagnostics and guidance
 */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
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

function pickLanIp(adapterRegex) {
  const ifaces = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      if (info.family === 'IPv4' && !info.internal) {
        candidates.push({ ip: info.address, name });
      }
    }
  }
  // 优先匹配指定网卡名称
  let list = candidates.map(c => c.ip);
  if (adapterRegex) {
    const preferred = candidates.filter(c => adapterRegex.test(c.name)).map(c => c.ip);
    // 去重合并（首选在前）
    const set = new Set();
    list = [...preferred, ...list].filter(ip => (set.has(ip) ? false : (set.add(ip), true)));
  }
  const pick = (prefix) => list.find(ip => ip.startsWith(prefix));
  return pick('192.168.') || pick('10.') || (list.find(ip => ip.match(/^172\.(1[6-9]|2\d|3[0-1])\./)) || list[0]);
}

function updateCapacitorServerUrl(ip, port) {
  const targetUrl = `http://${ip}:${port}`;
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

async function ensureDevServer(port) {
  const urlLocal = `http://localhost:${port}/`;
  if (await isServerUp(urlLocal)) {
    console.log(`✓ 检测到开发服务器已运行：${urlLocal}`);
    return;
  }
  console.log('… 正在启动 Vite 开发服务器');
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(port), '--host'], {
    cwd: ROOT,
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: true,
    detached: true
  });
  child.unref();
  for (let i = 0; i < 40; i++) { // 等待最多 ~20s
    if (await isServerUp(urlLocal)) {
      console.log(`✓ 开发服务器已启动：${urlLocal}`);
      return;
    }
    await sleep(500);
  }
  throw new Error('开发服务器启动超时，请检查端口占用或防火墙设置');
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
用法：node scripts/dev-android-wifi.cjs [--port 5173] [--ip 192.168.x.x] [--preferAdapter "WLAN|Wi-Fi|Ethernet"]

参数：
  --port            指定开发端口（默认 5173，可被 DEV_PORT/PORT/npm_config_port 覆盖）
  --ip              指定局域网 IP（默认按 192.168→10→172.16-31 顺序自动探测，可被 DEV_IP/DEV_HOST 覆盖）
  --preferAdapter   指定优先匹配的网卡名称正则（如 "WLAN|Wi-Fi"）
  --help            显示帮助
环境变量：
  DEV_PORT, DEV_IP/DEV_HOST, DEV_ADAPTER
`);
      process.exit(0);
    }
    const port = Number(args.port || process.env.DEV_PORT || process.env.PORT || process.env.npm_config_port || DEFAULT_PORT);
    await ensureDevServer(port);
    const adapterRegex = (args.preferAdapter || process.env.DEV_ADAPTER) ? new RegExp(args.preferAdapter || process.env.DEV_ADAPTER, 'i') : null;
    const ip = (args.ip || process.env.DEV_IP || process.env.DEV_HOST || pickLanIp(adapterRegex));
    if (!ip) throw new Error('未检测到有效局域网 IP，请确认网络已连接');
    if (args.ip || process.env.DEV_IP || process.env.DEV_HOST) {
      console.log(`✓ 使用指定 IP：${ip}`);
    } else if (adapterRegex) {
      console.log(`✓ 选择的局域网 IP（优先网卡匹配 ${adapterRegex}）：${ip}`);
    } else {
      console.log(`✓ 选择的局域网 IP：${ip}`);
    }
    updateCapacitorServerUrl(ip, port);
    run('npm', ['run', 'android:sync']);
    run('npm', ['run', 'android:run']);
    console.log('✓ 已通过 Wi‑Fi 方案安装并启动 APP，手机应加载开发服务器进行热更新');
    console.log(`提示：如手机无法访问，请在浏览器打开 http://${ip}:${port}/ 并检查防火墙入站规则`);
  } catch (err) {
    console.error('✗ Wi‑Fi 自动化运行失败：', err.message);
    console.error('修复建议：1) 确认同一 Wi‑Fi；2) 关闭或放行防火墙；3) 端口未被占用；4) 重新运行本命令');
    process.exit(1);
  }
})();