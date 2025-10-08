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

function getCurrentVersion(): string {
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
  const current = getCurrentVersion();
  const envObj = (import.meta as unknown as { env?: { VITE_APP_UPDATE_URL?: string } }).env;
  const envUrl = envObj?.VITE_APP_UPDATE_URL;
  const url = (customUrl ?? envUrl ?? '/updates.json') as string;
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Update source ${url} responded ${res.status}`);
    const info = (await res.json()) as UpdateInfo;
    const hasUpdate = compareVersions(info.latestVersion, current) > 0;
    return { currentVersion: current, info, hasUpdate, sourceUrl: url };
  } catch (err) {
    console.warn('Update check failed:', err);
    return { currentVersion: current, info: undefined, hasUpdate: false, sourceUrl: url };
  }
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
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
