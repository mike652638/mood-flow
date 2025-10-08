import { Capacitor, registerPlugin } from '@capacitor/core';

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
};

const ApkUpdater = registerPlugin<ApkUpdaterPlugin>('ApkUpdater');

export async function preDownloadApk(url: string): Promise<ApkDownloadResult> {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, error: 'Not native platform' };
  }
  try {
    const res = await ApkUpdater.download({ url });
    return { ok: !!res.ok, path: res.path, error: res.error };
  } catch (err) {
    return { ok: false, error: err };
  }
}

// 代码框架：触发 APK 安装（需要 REQUEST_INSTALL_PACKAGES 权限与 FileProvider 配置）
export async function installDownloadedApk(path: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const res = await ApkUpdater.install({ path });
    if (res?.requiresPermission) {
      return false;
    }
    return !!res?.ok;
  } catch {
    return false;
  }
}