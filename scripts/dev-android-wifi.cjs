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

// --- 依据设备 Wi‑Fi 子网选择本机 IP ---
function cidrToMask(bits) {
  const b = parseInt(bits, 10);
  const mask = (0xffffffff << (32 - b)) >>> 0;
  return [(mask >>> 24) & 255, (mask >>> 16) & 255, (mask >>> 8) & 255, mask & 255].join('.');
}
function ipToInt(ip) {
  return ip.split('.').reduce((acc, v) => (acc << 8) + parseInt(v, 10), 0) >>> 0;
}
function inSameSubnet(ip1, mask1, ip2) {
  const m = ipToInt(mask1);
  return (ipToInt(ip1) & m) === (ipToInt(ip2) & m);
}
function getDeviceWifiIp() {
  try {
    const out1 = spawnSync('adb', ['shell', 'ip', '-o', '-4', 'addr', 'show', 'wlan0'], { cwd: ROOT, encoding: 'utf8', shell: true }).stdout || '';
    const m1 = out1.match(/inet\s+(\d+\.\d+\.\d+\.\d+)\/(\d+)/);
    if (m1) return { ip: m1[1], netmask: cidrToMask(m1[2]) };
    const out2 = spawnSync('adb', ['shell', 'ifconfig', 'wlan0'], { cwd: ROOT, encoding: 'utf8', shell: true }).stdout || '';
    const m2 = out2.match(/inet\s(?:addr:)?(\d+\.\d+\.\d+\.\d+)/);
    if (m2) return { ip: m2[1], netmask: '255.255.255.0' };
    const out3 = spawnSync('adb', ['shell', 'ip', 'route'], { cwd: ROOT, encoding: 'utf8', shell: true }).stdout || '';
    const m3 = out3.match(/src\s(\d+\.\d+\.\d+\.\d+)/);
    if (m3) return { ip: m3[1], netmask: '255.255.255.0' };
  } catch (_) {}
  return null;
}
function pickLanIpSmart(adapterRegex) {
  const dev = getDeviceWifiIp();
  const ifaces = os.networkInterfaces();
  const candidates = [];
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      if (info.family === 'IPv4' && !info.internal) {
        candidates.push({ ip: info.address, name, netmask: info.netmask || '255.255.255.0' });
      }
    }
  }
  let list = candidates;
  if (adapterRegex) {
    const preferred = candidates.filter(c => adapterRegex.test(c.name));
    const set = new Set();
    list = [...preferred, ...candidates].filter(c => (set.has(c.ip) ? false : (set.add(c.ip), true)));
  }
  if (dev) {
    const match = list.find(c => inSameSubnet(c.ip, c.netmask, dev.ip));
    if (match) {
      console.log(`✓ 依据设备 Wi‑Fi 子网选择 IP：${match.ip}（网卡 ${match.name}）`);
      return match.ip;
    } else {
      console.log('⚠ 未与设备 Wi‑Fi 子网匹配，将按优先级选择');
    }
  }
  const simple = pickLanIp(adapterRegex);
  console.log(`⚠ 退回简单规则选择 IP：${simple}`);
  return simple;
}

// --- 新增：ADB 设备检测与友好提示 ---
function parseAdbDevices() {
  try { spawnSync('adb', ['start-server'], { cwd: ROOT, encoding: 'utf8', shell: true }); } catch (_) {}
  const out = (spawnSync('adb', ['devices'], { cwd: ROOT, encoding: 'utf8', shell: true }).stdout || '').trim();
  const lines = out.split(/\r?\n/).filter(l => l && !l.startsWith('List of devices') && !l.startsWith('*'));
  return lines.map(l => { const [id, state] = l.split(/\s+/); return { id, state }; });
}
function ensureAdbDeviceOnline() {
  const list = parseAdbDevices();
  if (!list.length) {
    console.error('✗ 未检测到 ADB 在线设备。\n请先用 USB 连接手机，开启“USB 调试”，并在手机弹窗点击允许电脑的指纹（建议选择始终允许）。');
    console.error('可选无线调试步骤：1) adb tcpip 5555  2) adb connect <手机IP>:5555  3) 重试：npm run android:dev:wifi:auto');
    throw new Error('ADB 无设备');
  }
  if (list.some(d => d.state === 'unauthorized')) {
    console.error('✗ 检测到设备未授权。请在手机弹窗点击“允许此电脑的指纹”，或开发者选项→已调试设备中移除后重插。');
    throw new Error('ADB 设备未授权');
  }
  const online = list.find(d => d.state === 'device') || list[0];
  if (!online || online.state !== 'device') {
    console.error('✗ 检测到设备状态非 device（可能为 offline）。请重插 USB，或执行：adb kill-server && adb start-server');
    throw new Error('ADB 设备非在线');
  }
  console.log(`✓ 检测到 ADB 设备：${online.id}`);
  return online;
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
  if (res.status !== 0) throw new Error(`npm 执行失败，code=${res.status}`);
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
提示：在运行本命令前，建议先通过 USB 完成一次 ADB 授权（手机弹窗点允许电脑的指纹）。
`);
      process.exit(0);
    }
    const port = Number(args.port || process.env.DEV_PORT || process.env.PORT || process.env.npm_config_port || DEFAULT_PORT);
    await ensureDevServer(port);
    // 在选择 IP 前，先确保有 ADB 在线设备（避免后续 native-run 失败）
    ensureAdbDeviceOnline();

    const adapterRegex = (args.preferAdapter || process.env.DEV_ADAPTER) ? new RegExp(args.preferAdapter || process.env.DEV_ADAPTER, 'i') : null;
    const ip = (args.ip || process.env.DEV_IP || process.env.DEV_HOST || pickLanIpSmart(adapterRegex));
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
    console.error('修复建议：1) 先用 USB 完成 ADB 授权；2) 同一 Wi‑Fi；3) 防火墙放行 5173；4) 端口未被占用；5) 重试本命令');
    process.exit(1);
  }
})();