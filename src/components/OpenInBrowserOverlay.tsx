import React, { useEffect, useState } from 'react';
import { ExternalLink, Copy, X, Info, ArrowUpRight } from 'lucide-react';

function detectWeChat(): boolean {
  try {
    const ua = navigator.userAgent || '';
    return /MicroMessenger|WeiXin|wxwork/i.test(ua);
  } catch {
    return false;
  }
}

interface Props {
  visible?: boolean;
  onClose?: () => void;
  currentUrl?: string;
}

const OpenInBrowserOverlay: React.FC<Props> = ({ visible, onClose, currentUrl }) => {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof visible === 'boolean') {
      setShow(visible);
    } else {
      setShow(detectWeChat());
    }
  }, [visible]);

  const copyLink = async () => {
    try {
      const url = currentUrl || window.location.href;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (!show) return null;

  return (
    <div className='fixed inset-0 z-[100] flex items-start justify-center p-4 bg-black/70 backdrop-blur-sm' onContextMenu={e => e.preventDefault()}>
      <div className='absolute top-3 right-3 text-white opacity-90'>
        <ArrowUpRight className='w-7 h-7' />
      </div>

      <div className='relative mt-12 w-full max-w-md rounded-2xl bg-white/95 dark:bg-theme-gray-800/95 shadow-2xl border border-white/40 dark:border-theme-gray-700/40 px-5 py-6 text-center'>
        <div className='flex items-center justify-center gap-2 mb-2 text-purple-600 dark:text-purple-400'>
          <Info className='w-5 h-5' />
          <span className='font-semibold'>在微信中无法直接下载 APK</span>
        </div>
        <p className='text-sm sm:text-base text-gray-800 dark:text-gray-200'>
          请点击右上角菜单，选择“在浏览器中打开”，以便正常下载与安装。
        </p>

        <div className='mt-4 grid grid-cols-2 gap-3'>
          <button
            onClick={copyLink}
            className='flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gray-100 dark:bg-theme-gray-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 text-gray-800 dark:text-gray-200 transition-all shadow-sm hover:shadow-md active:scale-95'>
            <Copy className='w-4 h-4' />
            <span>{copied ? '已复制链接' : '复制当前链接'}</span>
          </button>
          <button
            onClick={() => {
              setShow(false);
              onClose?.();
            }}
            className='flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all shadow-sm hover:shadow-md active:scale-95'>
            <ExternalLink className='w-4 h-4' />
            <span>我已知道</span>
          </button>
        </div>

        <div className='mt-3 text-xs text-gray-600 dark:text-gray-400'>
          iOS：选择“在 Safari 中打开” · Android：选择“在浏览器中打开”
        </div>

        <button
          aria-label='关闭'
          onClick={() => {
            setShow(false);
            onClose?.();
          }}
          className='absolute top-2 right-2 p-2 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'>
          <X className='w-5 h-5' />
        </button>
      </div>
    </div>
  );
};

export default OpenInBrowserOverlay;