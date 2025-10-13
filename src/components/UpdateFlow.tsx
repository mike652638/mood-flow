import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getNetworkStatus, isNative } from '../utils/capacitor';
import {
  preDownloadApk,
  installDownloadedApkDetailed,
  subscribeDownloadProgress,
  subscribeDownloadFailed
} from '../utils/nativeUpdate';
import { openUpdateLink } from '../utils/update';

interface UpdateFlowProps {
  url: string;
  onInstalled?: () => void;
  className?: string;
}

export default function UpdateFlow({ url, onInstalled, className }: UpdateFlowProps) {
  const [downloading, setDownloading] = useState(false);
  const [percent, setPercent] = useState(0);
  const [failed, setFailed] = useState(false);
  const [permissionRequired, setPermissionRequired] = useState(false);
  const [netType, setNetType] = useState<string | undefined>(undefined);
  const subs = useRef<{ remove?: () => void }[]>([]);

  // 清理订阅
  useEffect(() => {
    return () => {
      subs.current.forEach(s => {
        try {
          s.remove?.();
        } catch (error) {
          // 忽略清理订阅时的错误
          console.error('Failed to remove subscription:', error);
        }
      });
      subs.current = [];
    };
  }, []);

  const startUpdate = useCallback(async () => {
    try {
      const net = await getNetworkStatus();
      setNetType(net?.connectionType);
      if (!net?.connected) {
        toast.warning('当前无网络连接，请连接网络后重试');
        setFailed(true);
        return;
      }

      if (!isNative()) {
        await openUpdateLink(url);
        return;
      }

      setPermissionRequired(false);
      setFailed(false);
      setPercent(0);
      setDownloading(true);

      const p = subscribeDownloadProgress(e => {
        const total = Math.max(1, e.total ?? 0);
        const downloaded = Math.max(0, e.downloaded ?? 0);
        const pct = Math.min(100, Math.round((downloaded / total) * 100));
        if (Number.isFinite(pct)) setPercent(pct);
      });
      const f = subscribeDownloadFailed(() => {
        setFailed(true);
        setDownloading(false);
      });
      subs.current.push(p, f);

      const dl = await preDownloadApk(url);
      if (dl.ok && dl.path) {
        const install = await installDownloadedApkDetailed(dl.path);
        setDownloading(false);
        if (install.ok) {
          onInstalled?.();
          return;
        }
        if (install.requiresPermission) {
          setPermissionRequired(true);
          toast.info('请在系统设置授予“安装未知应用”权限后重试安装');
          return;
        }
        // 其他情况兜底到浏览器
        await openUpdateLink(url);
      } else {
        setFailed(true);
        setDownloading(false);
        await openUpdateLink(url);
      }
    } catch (err) {
      console.warn('UpdateFlow error:', err);
      setDownloading(false);
      setFailed(true);
      await openUpdateLink(url);
    } finally {
      // 清理订阅
      subs.current.forEach(s => {
        try {
          s.remove?.();
        } catch (error) {
          // 忽略清理订阅时的错误
          console.error('Failed to remove subscription:', error);
        }
      });
      subs.current = [];
    }
  }, [url, onInstalled]);

  const failureHint = (() => {
    if (!failed) return null;
    if (netType === 'cellular') return '当前为蜂窝网络，下载可能较慢且消耗流量，建议在 Wi‑Fi 下重试。';
    if (netType === 'wifi') return '下载失败，请检查 Wi‑Fi 网络或稍后重试。';
    return '下载失败，请检查网络后重试。';
  })();

  return (
    <div className={className}>
      {downloading && (
        <div className='flex-1 min-w-[220px]'>
          <div className='text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1'>正在下载：{percent}%</div>
          <div className='w-full h-2 bg-gray-200 dark:bg-theme-gray-800 rounded'>
            <div
              className='h-2 bg-purple-600 rounded transition-all duration-300'
              style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
            />
          </div>
        </div>
      )}
      {permissionRequired && (
        <div className='text-xs sm:text-sm text-red-600 dark:text-red-400 mt-2'>
          需要授予“安装未知应用”权限：系统设置→应用→安装未知应用→选择本应用并允许，然后返回此页重试安装。
        </div>
      )}
      {failureHint && <div className='text-xs sm:text-sm text-red-600 dark:text-red-400 mt-2'>{failureHint}</div>}
      <div className='pt-2'>
        <button
          onClick={startUpdate}
          disabled={downloading}
          className={`px-4 py-2 rounded-lg border text-white ${
            downloading ? 'bg-gray-400 cursor-wait' : 'bg-purple-600 hover:bg-purple-700'
          }`}>
          {failed
            ? (isNative() ? '重试下载' : '前往更新')
            : downloading
            ? '正在下载...'
            : (isNative() ? '下载并安装' : '前往更新')}
        </button>
      </div>
    </div>
  );
}
