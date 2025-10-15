import { Capacitor, registerPlugin } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface ApkDownloadResult {
  ok: boolean;
  path?: string;
  error?: unknown;
}

// 代码框架：后台静默预下载 APK（需要原生端提供权限与实现）
// Web 端直接返回不支持；原生端可在此处对接自定义插件或原生模块
type ApkUpdaterPlugin = {
  download(options: { url: string; fileName?: string }): Promise<{ ok: boolean; path?: string; error?: unknown }>;
  install(options: { path: string }): Promise<{ ok: boolean; requiresPermission?: boolean; error?: unknown }>;
  addListener?: (eventName: string, listenerFunc: (data: unknown) => void) => { remove: () => void };
};

const ApkUpdater = registerPlugin<ApkUpdaterPlugin>('ApkUpdater');

export function isApkUpdaterAvailable(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('ApkUpdater');
  } catch {
    return false;
  }
}

async function downloadApkViaFilesystem(url: string): Promise<ApkDownloadResult> {
  try {
    if (!Capacitor.isNativePlatform()) return { ok: false, error: 'Not native platform' };
    const fileName = `mood-flow-update-${Date.now()}.apk`;
    // 使用缓存目录，避免存储权限问题（Android 10+ 走 Scoped Storage）
    await Filesystem.downloadFile({ url, path: fileName, directory: Directory.Cache });
    const uri = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
    return { ok: true, path: uri.uri };
  } catch (err) {
    console.warn('Filesystem download failed:', err);
    return { ok: false, error: err };
  }
}

export async function preDownloadApk(url: string): Promise<ApkDownloadResult> {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, error: 'Not native platform' };
  }
  try {
    if (isApkUpdaterAvailable()) {
      const res = await ApkUpdater.download({ url });
      if (res?.ok && res?.path) {
        return { ok: true, path: res.path };
      }
      // 原生下载启动失败，切换到回退方案
      return await downloadApkViaFilesystem(url);
    }
    // 回退：使用 Filesystem 下载到缓存目录，返回可用于分享/打开的 URI
    return await downloadApkViaFilesystem(url);
  } catch (err) {
    return { ok: false, error: err };
  }
}

// 代码框架：触发 APK 安装（需要 REQUEST_INSTALL_PACKAGES 权限与 FileProvider 配置）
export async function installDownloadedApk(path: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    if (isApkUpdaterAvailable()) {
      const res = await ApkUpdater.install({ path });
      if (res?.requiresPermission) {
        return false;
      }
      return !!res?.ok;
    }
    // 简化：在非插件路径下不主动弹分享，避免后台静默预下载时打断用户
    return false;
  } catch {
    return false;
  }
}

export type DownloadProgressEvent = { id?: number; downloaded?: number; total?: number };

export function subscribeDownloadProgress(handler: (e: DownloadProgressEvent) => void): { remove: () => void } {
  try {
    if (!Capacitor.isNativePlatform()) return { remove: () => {} };
    const sub = ApkUpdater.addListener?.('downloadProgress', handler);
    return {
      remove: () => {
        try {
          sub?.remove?.();
        } catch (error) {
          console.error('Failed to remove download progress subscription:', error);
        }
      }
    };
  } catch (error) {
    console.error('Failed to subscribe to download progress:', error);
    return { remove: () => {} };
  }
}

export type DownloadFailedEvent = {
  id?: number;
  error?: string;
  networkType?: 'wifi' | 'cellular' | 'none' | 'unknown';
};

export function subscribeDownloadFailed(handler: (e: DownloadFailedEvent) => void): { remove: () => void } {
  try {
    if (!Capacitor.isNativePlatform()) return { remove: () => {} };
    const sub = ApkUpdater.addListener?.('downloadFailed', handler);
    return {
      remove: () => {
        try {
          sub?.remove?.();
        } catch (error) {
          console.error('Failed to remove download failed subscription:', error);
        }
      }
    };
  } catch (error) {
    console.error('Failed to subscribe to download failed:', error);
    return { remove: () => {} };
  }
}

export function subscribeDownloadCompleted(handler: (e: { id?: number; path?: string }) => void): {
  remove: () => void;
} {
  try {
    if (!Capacitor.isNativePlatform()) return { remove: () => {} };
    const sub = ApkUpdater.addListener?.('downloadCompleted', handler);
    return {
      remove: () => {
        try {
          sub?.remove?.();
        } catch (error) {
          console.error('Failed to remove download completed subscription:', error);
        }
      }
    };
  } catch (error) {
    console.error('Failed to subscribe to download completed:', error);
    return { remove: () => {} };
  }
}

export async function installDownloadedApkDetailed(
  path: string
): Promise<{ ok: boolean; requiresPermission?: boolean; usedShareFallback?: boolean }> {
  if (!Capacitor.isNativePlatform()) return { ok: false };
  try {
    if (isApkUpdaterAvailable()) {
      const res = await ApkUpdater.install({ path });
      return { ok: !!res?.ok, requiresPermission: !!res?.requiresPermission };
    }
    // 回退：触发分享进行安装
    try {
      await Share.share({ title: '安装新版应用', text: '已下载最新版 APK，点击打开进行安装', url: path });
      return { ok: true, usedShareFallback: true };
    } catch (err) {
      console.error('Share fallback install failed:', err);
      return { ok: false };
    }
  } catch (err) {
    console.error('Failed to install downloaded APK:', err);
    return { ok: false };
  }
}
