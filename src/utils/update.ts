export interface UpdateInfo {
  latestVersion: string;
  androidApkUrl?: string;
  releaseNotes?: string;
  mandatory?: boolean;
  publishedAt?: string;
}

export interface UpdateCheckResult {
  currentVersion: string;
  info?: UpdateInfo;
  hasUpdate: boolean;
  sourceUrl: string;
}

const AUTO_CHECK_KEY = 'app.update.autoCheck';

async function getCurrentVersion(): Promise<string> {
  try {
    if (Capacitor.isNativePlatform()) {
      const mod = await import('@capacitor/app');
      const info = await mod.App.getInfo();
      if (info?.version) return info.version.trim();
    }
  } catch (err) {
    console.warn('Native getCurrentVersion failed:', err);
  }
  const injected = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : undefined;
  const envObj = (import.meta as unknown as { env?: { VITE_APP_VERSION?: string } }).env;
  const env = envObj?.VITE_APP_VERSION as string | undefined;
  return (injected || env || '1.0.0').trim();
}

// 简易语义版本比较：按主.次.修，忽略预发布标签
export function compareVersions(a: string, b: string): number {
  const toNums = (v: string) =>
    v
      .split('-')[0]
      .split('.')
      .map(n => parseInt(n || '0', 10));
  const [a1, a2, a3] = toNums(a);
  const [b1, b2, b3] = toNums(b);
  if (a1 !== b1) return a1 - b1;
  if (a2 !== b2) return a2 - b2;
  return (a3 || 0) - (b3 || 0);
}

export async function checkForUpdate(customUrl?: string): Promise<UpdateCheckResult> {
  const current = await getCurrentVersion();
  // 开发环境禁用在线更新检查，避免本地调试时的网络中断/Abort 报错
  if (import.meta.env && (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
    return { currentVersion: current, info: undefined, hasUpdate: false, sourceUrl: '/updates.json' };
  }
  const envObj = (import.meta as unknown as { env?: { VITE_APP_UPDATE_URL?: string; VITE_APP_UPDATES_BASE?: string } }).env;
  const envUrl = envObj?.VITE_APP_UPDATE_URL as string | undefined;
  const baseUrl = envObj?.VITE_APP_UPDATES_BASE as string | undefined;

  // 候选源：自定义 > 环境 URL > 环境 BASE > 从本地包推断的远程 BASE > 本地包
  const candidates: string[] = [];
  if (customUrl) candidates.push(customUrl);
  if (envUrl) candidates.push(envUrl);
  if (baseUrl) candidates.push(baseUrl.endsWith('/') ? `${baseUrl}updates.json` : `${baseUrl}/updates.json`);

  // 从本地包内的 /updates.json 推断远程路径（兼容旧版本未注入环境变量的情况）
  try {
    const localRes = await fetch('/updates.json', { cache: 'no-store' });
    if (localRes.ok) {
      const localInfo = (await localRes.json()) as UpdateInfo;
      const apk = localInfo?.androidApkUrl || '';
      const m = apk.match(/^(https?:\/\/[^\s"<>]+)\/releases\//);
      if (m && m[1]) {
        const base = `${m[1]}/releases/updates.json`;
        candidates.push(base);
      }
    }
  } catch {
    // 忽略本地包读取错误
  }

  // 本地包内作为最后兜底
  candidates.push('/updates.json');

  let bestInfo: UpdateInfo | undefined;
  let bestSource = '';
  for (const url of dedupe(candidates)) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) throw new Error(`Update source ${url} responded ${res.status}`);
      const info = (await res.json()) as UpdateInfo;
      if (!bestInfo || compareVersions(info.latestVersion, bestInfo.latestVersion) > 0) {
        bestInfo = info;
        bestSource = url;
      }
      // 如果该源已比当前版本新，提前返回
      if (compareVersions(info.latestVersion, current) > 0) {
        return { currentVersion: current, info, hasUpdate: true, sourceUrl: url };
      }
    } catch (err) {
      console.warn('Update check failed on source:', url, err);
    }
  }

  // 兜底：若远程源不可读（如 CORS），尝试 GitHub Releases 获取最新发布信息
  try {
    const gh = await fetchGithubReleaseFallback();
    if (gh && compareVersions(gh.latestVersion, current) > 0) {
      return { currentVersion: current, info: gh, hasUpdate: true, sourceUrl: gh.androidApkUrl || 'github:releases/latest' };
    }
    if (gh && (!bestInfo || compareVersions(gh.latestVersion, bestInfo.latestVersion) > 0)) {
      bestInfo = gh;
      bestSource = 'github:releases/latest';
    }
  } catch {
    // 忽略 GitHub 兜底错误
  }
  if (bestInfo) {
    const hasUpdate = compareVersions(bestInfo.latestVersion, current) > 0;
    return { currentVersion: current, info: bestInfo, hasUpdate, sourceUrl: bestSource };
  }
  // 所有源均失败
  const fallback = candidates[0] || '/updates.json';
  return { currentVersion: current, info: undefined, hasUpdate: false, sourceUrl: fallback };
}

function dedupe(arr: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

// 自动检查更新偏好（默认开启）
export function getAutoCheckEnabled(): boolean {
  try {
    const raw = localStorage.getItem(AUTO_CHECK_KEY);
    if (raw === null) return true; // 默认启用
    return raw === '1';
  } catch {
    return true;
  }
}

export function setAutoCheckEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_CHECK_KEY, enabled ? '1' : '0');
  } catch {
    // 忽略持久化错误
  }
}

// 原生端优化：优先使用 Capacitor Browser 打开更新链接；Web 端降级到 window.open
export async function openUpdateLink(url: string): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url });
      return;
    }
  } catch (err) {
    console.warn('Browser open failed:', err);
  }
  try {
    window.open(url, '_blank');
  } catch (err) {
    console.warn('Window open failed:', err);
  }
}
// GitHub Releases 兜底：解析最新发布版本与 APK 下载地址（公开仓库，无需鉴权）
async function fetchGithubReleaseFallback(): Promise<UpdateInfo | undefined> {
  try {
    const envObj = (import.meta as unknown as { env?: { VITE_GITHUB_REPO?: string } }).env;
    const repo = (envObj?.VITE_GITHUB_REPO as string | undefined) || 'mike652638/mood-flow';
    const url = `https://api.github.com/repos/${repo}/releases/latest`;
    const res = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return undefined;
    const j = await res.json();
    const tag = (j?.tag_name || '').trim();
    const ver = tag.replace(/^v/, '');
    if (!ver) return undefined;
    let apkUrl: string | undefined;
    const body: string = (j?.body || '') as string;
    const m = body.match(/R2_APK_URL:\s*(https?:\/\/[^\s]+)/);
    if (m && m[1]) apkUrl = m[1];
    if (!apkUrl && Array.isArray(j?.assets)) {
      const asset = j.assets.find((a: unknown) => {
        return typeof a === 'object' && a !== null && 
               'name' in a && typeof (a as { name?: unknown }).name === 'string' && 
               (a as { name: string }).name.endsWith('app-release.apk');
      });
      if (asset && typeof asset === 'object' && asset !== null && 'browser_download_url' in asset) {
        apkUrl = (asset as { browser_download_url?: string }).browser_download_url || '';
      }
    }
    const info: UpdateInfo = {
      latestVersion: ver,
      androidApkUrl: apkUrl,
      releaseNotes: typeof body === 'string' ? body : undefined,
      mandatory: false,
      publishedAt: j?.published_at || undefined
    };
    return info;
  } catch {
    return undefined;
  }
}
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
