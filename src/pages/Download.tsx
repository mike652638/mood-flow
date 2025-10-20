import { useEffect, useState } from 'react';
import Header from '../components/Header';
import Container from '../components/Container';
import Card from '../components/Card';
import Button from '../components/Button';
import { checkForUpdate, openUpdateLink, UpdateInfo } from '../utils/update';
import { Smartphone, Download, CheckCircle, Info, Shield, QrCode, Share2, Copy } from 'lucide-react';
import OpenInBrowserOverlay from '../components/OpenInBrowserOverlay';
import { useLocation, useNavigate } from 'react-router-dom';
import Modal from '../components/Modal';
import { toast } from 'sonner';

const DownloadPage = () => {
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [_sourceUrl, setSourceUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [apkMeta, setApkMeta] = useState<{
    sizeBytes?: number;
    sizeText?: string;
    checksumType?: string;
    checksum?: string;
  } | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [openingDownload, setOpeningDownload] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        // 在开发环境下也强制从 R2 远程源读取最新版本信息
        const result = await checkForUpdate(
          'https://pub-0bd3064e8b4743b19a2219ed6f880902.r2.dev/releases/updates.json'
        );
        if (!cancelled) {
          setInfo(result.info || null);
          setSourceUrl(result.sourceUrl);
          // 开发环境下 checkForUpdate 不返回 info，这里回退读取 sourceUrl（通常为 /updates.json）
          if (!result.info && result.sourceUrl) {
            try {
              const res = await fetch(result.sourceUrl, { cache: 'no-store' });
              if (res.ok) {
                const j = (await res.json()) as UpdateInfo;
                if (!cancelled) setInfo(j);
              }
            } catch {
              // 忽略本地回退失败
            }
          }
        }
      } catch (err) {
        console.error('获取最新版本信息失败:', err);
        if (!cancelled) setError('获取最新版本信息失败');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleDownload = async () => {
    const url = info?.androidApkUrl;
    if (url) {
      try {
        setOpeningDownload(true);
        await toast.promise(openUpdateLink(url), {
          loading: '正在打开下载…',
          success: '已打开下载链接',
          error: '打开失败，请稍后重试'
        });
      } finally {
        setOpeningDownload(false);
      }
    }
  };

  const apkUrl = info?.androidApkUrl || '';

  const params = new URLSearchParams(location.search);
  const routeState = location.state as { from?: string } | null;
  const isFromSettings =
    routeState?.from === 'settings' ||
    params.get('from') === 'settings' ||
    params.get('source') === 'settings';
  const shareTarget = apkUrl || window.location.href;
  // WeChat/QQ UA 检测，用于优化提示文案
  const isWeChatOrQQ =
    /MicroMessenger|QQ\//i.test(navigator.userAgent) || /QQBrowser|MQQBrowser/i.test(navigator.userAgent);

  // 轻量校验：HEAD/Range 请求获取 APK 大小与摘要
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const fetchMeta = async (url: string) => {
      try {
        const tryHead = async () => {
          const res = await fetch(url, { method: 'HEAD', signal: ac.signal });
          if (!res.ok) throw new Error(`HEAD ${res.status}`);
          return res;
        };
        const tryRange = async () => {
          const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, signal: ac.signal });
          if (!res.ok) throw new Error(`RANGE ${res.status}`);
          return res;
        };
        let res: Response | null = null;
        try {
          res = await tryHead();
        } catch {
          try {
            res = await tryRange();
          } catch {
            res = null;
          }
        }
        if (!res) return;
        const headers = res.headers;
        // 文件大小
        let size = parseInt(headers.get('content-length') || '0', 10);
        const contentRange = headers.get('content-range');
        if (!size && contentRange) {
          const m = contentRange.match(/\/(\d+)$/);
          if (m && m[1]) size = parseInt(m[1], 10);
        }
        const sizeText = size ? formatBytes(size) : undefined;
        // 校验摘要（优先 SHA-256，其次 MD5，最后 ETag）
        const sha256 =
          headers.get('x-amz-meta-sha256') || headers.get('x-amz-meta-sha-256') || headers.get('x-checksum-sha256');
        const md5 = headers.get('content-md5') || headers.get('x-amz-meta-md5');
        let etag = headers.get('etag') || undefined;
        if (etag && etag.startsWith('"') && etag.endsWith('"')) etag = etag.slice(1, -1);
        let checksumType: string | undefined;
        let checksum: string | undefined;
        if (sha256) {
          checksumType = 'SHA-256';
          checksum = sha256;
        } else if (md5) {
          checksumType = 'MD5';
          checksum = md5;
        } else if (etag) {
          checksumType = 'ETag';
          checksum = etag;
        }
        if (!cancelled) setApkMeta({ sizeBytes: size || undefined, sizeText, checksumType, checksum });
      } catch {
        if (!cancelled) setApkMeta(null);
      }
    };
    if (apkUrl) fetchMeta(apkUrl);
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [apkUrl]);

  function formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
  }

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: '心流日记下载', text: '下载心流日记 APP', url: shareTarget });
        return;
      }
    } catch (error) {
      console.warn('Web Share 调用失败，回退到自定义弹窗:', error);
    }
    setShowShareModal(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareTarget);
      setCopied(true);
      toast.success('链接已复制');
    } catch (error) {
      console.warn('复制链接失败，尝试使用回退方案:', error);
      try {
        const input = document.createElement('input');
        input.value = shareTarget;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        setCopied(true);
        toast.success('链接已复制');
      } catch (fallbackError) {
        console.warn('复制链接失败（剪贴板与回退均失败）:', fallbackError);
        setCopied(false);
      }
    }
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      <OpenInBrowserOverlay currentUrl={window.location.href} />
      <Header
        title='下载心流日记'
        immersiveMode={false}
        showBackButton={isFromSettings}
        onBack={() => navigate('/settings')}
        rightIcon={
          <button
            onClick={handleShare}
            className='p-2 rounded-xl bg-white/80 dark:bg-theme-gray-700/80 hover:bg-white dark:hover:bg-theme-gray-600 text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md'
            aria-label='分享'>
            <Share2 size={20} />
          </button>
        }
      />
      {/* 为固定头部+状态栏预留顶部空间，避免主内容被遮挡 */}
      <Container style={{ paddingTop: 'calc(var(--header-height, 64px) + 8px)' }} className='pb-6'>
        <div className='page-sections space-y-4 sm:space-y-6'>
          <Card variant='default' padding='md' className='p-4 sm:p-6'>
            <div className='flex items-center gap-3 mb-3'>
              <Smartphone className='w-6 h-6 text-purple-600 dark:text-purple-400' />
              <div>
                <h2 className='text-lg sm:text-xl font-semibold text-gray-900 dark:text-white'>心流日记 APP</h2>
                <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>记录、分析与疗愈你的情绪</p>
              </div>
            </div>
            <div className='grid md:grid-cols-3 gap-3 sm:gap-4'>
              <div className='bg-gray-50 dark:bg-theme-gray-800 rounded-lg p-3 sm:p-4'>
                <p className='text-sm sm:text-base leading-relaxed text-gray-800 dark:text-gray-200'>- 快速记录情绪与触发事件</p>
                <p className='text-sm sm:text-base leading-relaxed text-gray-800 dark:text-gray-200'>- AI 伙伴给出安慰与建议</p>
                <p className='text-sm sm:text-base leading-relaxed text-gray-800 dark:text-gray-200'>- 趋势图与分析报告帮助成长</p>
              </div>
              <div className='bg-gray-50 dark:bg-theme-gray-800 rounded-lg p-3 sm:p-4'>
                <p className='text-sm sm:text-base leading-relaxed text-gray-800 dark:text-gray-200'>- 保护隐私的本地存储与加密</p>
                <p className='text-sm sm:text-base leading-relaxed text-gray-800 dark:text-gray-200'>- 可选提醒，建立记录习惯</p>
                <p className='text-sm sm:text-base leading-relaxed text-gray-800 dark:text-gray-200'>- 沉浸式与主题模式自由切换</p>
              </div>
              <div className='bg-gray-50 dark:bg-theme-gray-800 rounded-lg p-3 sm:p-4'>
                <p className='text-sm sm:text-base leading-relaxed text-gray-800 dark:text-gray-200'>- 纯净无广告，轻量高效</p>
                <p className='text-sm sm:text-base leading-relaxed text-gray-800 dark:text-gray-200'>- 适配常见 Android 机型</p>
                <p className='text-sm sm:text-base leading-relaxed text-gray-800 dark:text-gray-200'>- 持续迭代与版本更新</p>
              </div>
            </div>
          </Card>

          <Card variant='default' padding='md' className='p-4 sm:p-6'>
            <div className='flex items-center gap-3 mb-3'>
              <Download className='w-6 h-6 text-purple-600 dark:text-purple-400' />
              <div>
                <h3 className='text-lg sm:text-xl font-semibold text-gray-900 dark:text-white'>下载最新版本</h3>
                {info?.latestVersion && (
                  <p className='text-sm text-gray-600 dark:text-gray-400'>最新版本：V{info.latestVersion}</p>
                )}
                {info?.publishedAt && (
                  <p className='text-sm sm:text-base text-gray-500 dark:text-gray-500 leading-relaxed'>发布时间：{info.publishedAt}</p>
                )}
              </div>
            </div>

            {loading ? (
              <div className='flex items-center justify-center py-6'>
                <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600'></div>
              </div>
            ) : error ? (
              <p className='text-sm text-red-600'>获取版本信息失败，请稍后重试</p>
            ) : apkUrl ? (
              <div className='space-y-3'>
                <Button
                  onClick={handleDownload}
                  disabled={openingDownload}
                  className='w-full disabled:opacity-60 disabled:cursor-not-allowed'>
                  {openingDownload ? (
                    <span className='inline-flex items-center gap-2'>
                      <span className='animate-spin rounded-full h-4 w-4 border-2 border-white/70 border-t-transparent'></span>
                      正在打开下载…
                    </span>
                  ) : (
                    '立即下载 APK'
                  )}
                </Button>
                {apkMeta && (apkMeta.sizeText || apkMeta.checksum) && (
                  <div className='mt-2 text-sm sm:text-base text-gray-700 dark:text-gray-300 space-y-1'>
                    {apkMeta.sizeText && <p>文件大小：{apkMeta.sizeText}</p>}
                    {apkMeta.checksum && (
                      <>
                        <p>校验方式：{apkMeta.checksumType || '未知'}</p>
                        <p>
                          校验值：<span className='break-all'>{apkMeta.checksum}</span>
                        </p>
                      </>
                    )}
                  </div>
                )}
                {info?.releaseNotes && (
                  <details className='mt-2'>
                    <summary className='text-sm sm:text-base text-gray-700 dark:text-gray-300 cursor-pointer'>版本更新说明</summary>
                    <pre className='whitespace-pre-wrap text-sm sm:text-base leading-relaxed text-gray-700 dark:text-gray-300 mt-2'>
                      {info.releaseNotes.length > 160 ? info.releaseNotes.slice(0, 800) : info.releaseNotes}
                    </pre>
                  </details>
                )}
              </div>
            ) : (
              <div className='space-y-2'>
                <p className='text-sm sm:text-base text-gray-800 dark:text-gray-200'>暂无可用下载链接，请稍后重试或联系维护者。</p>
              </div>
            )}
          </Card>

          {/* 扫码下载二维码（优先使用 APK 链接，其次使用当前页面 URL）*/}
          <Card variant='default' padding='md' className='p-4 sm:p-6'>
            <div className='flex items-center gap-3 mb-3'>
              <QrCode className='w-6 h-6 text-purple-600 dark:text-purple-400' />
              <h3 className='text-lg sm:text-xl font-semibold text-gray-900 dark:text-white'>扫码下载/分享</h3>
            </div>
            <div className='flex flex-col items-center'>
              <div className='rounded-xl overflow-hidden border border-gray-200 dark:border-theme-gray-700 bg-white dark:bg-theme-gray-800 p-2 shadow-sm'>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
                    apkUrl || window.location.href
                  )}`}
                  alt='下载二维码'
                  className='w-[180px] sm:w-[200px] md:w-[240px] h-auto'
                  loading='lazy'
                />
              </div>
              <p className='mt-3 text-sm sm:text-base leading-relaxed text-gray-700 dark:text-gray-300 text-center'>
                使用手机扫码即可下载，移动端也可将二维码展示给他人扫码。
              </p>
            </div>
          </Card>

          <Card variant='default' padding='md' className='p-4 sm:p-6'>
            <div className='flex items-center gap-3 mb-3'>
              <Shield className='w-6 h-6 text-purple-600 dark:text-purple-400' />
              <h3 className='text-lg sm:text-xl font-semibold text-gray-900 dark:text-white'>安装指引（Android）</h3>
            </div>
            <ol className='space-y-2 list-decimal list-inside text-sm sm:text-base leading-relaxed text-gray-800 dark:text-gray-200'>
              <li>点击上方“立即下载 APK”，等待下载完成。</li>
              <li>下载完成后，打开“文件管理”，在“下载”目录找到 APK 文件。</li>
              <li>
                首次安装如提示“来自未知来源”，请前往“设置 → 应用与权限 → 安装未知应用”，
                选择你的浏览器或文件管理器并允许安装权限。
              </li>
              <li>返回 APK 文件，点击打开并按提示完成安装。</li>
              <li>安装后从桌面打开“心流日记”，首次进入可在“设置”中开启提醒与沉浸式状态栏。</li>
            </ol>
            <div className='mt-3 flex items-center gap-2 text-sm sm:text-base leading-relaxed text-gray-600 dark:text-gray-400'>
              <Info className='w-4 h-4 flex-shrink-0' />
              <span>若浏览器拦截下载或提示风险，请选择“仍然下载/保留”，本应用不含广告与恶意代码。</span>
            </div>
          </Card>

          <Card variant='default' padding='md' className='p-4 sm:p-6'>
            <div className='flex items-center gap-3 mb-3'>
              <CheckCircle className='w-6 h-6 text-green-600 dark:text-green-400' />
              <h3 className='text-lg sm:text-xl font-semibold text-gray-900 dark:text-white'>常见问题</h3>
            </div>
            <div className='space-y-2 text-sm sm:text-base leading-relaxed text-gray-800 dark:text-gray-200'>
              <p>• 无法打开 APK：请使用系统“文件管理”或 Chrome/系统浏览器下载并打开。</p>
              <p>• 提示无法安装：请确认已允许“安装未知应用”的权限，并确保 APK 完整下载。</p>
              <p>• 下载很慢或中断：可切换网络或使用上方备用链接。</p>
            </div>
          </Card>
        </div>
      </Container>

      {showShareModal && (
        <Modal title='分享下载链接' onClose={() => setShowShareModal(false)}>
          <div className='space-y-2 sm:space-y-3'>
            <div className='flex items-center gap-2'>
              <input
                readOnly
                type='text'
                aria-label='下载链接'
                onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
                value={shareTarget}
                className='input w-full bg-white dark:bg-theme-gray-700 text-gray-800 dark:text-gray-100 text-sm sm:text-base'
              />
              <button
                onClick={copyLink}
                aria-label='复制链接'
                className='px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm sm:text-base flex items-center gap-1'>
                <Copy className='w-4 h-4' />
                {copied ? '已复制' : '复制'}
              </button>
            </div>
            <div className='flex flex-col items-center'>
              <div className='rounded-xl overflow-hidden border border-gray-200 dark:border-theme-gray-700 bg-white dark:bg-theme-gray-800 p-2 shadow-sm'>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(shareTarget)}`}
                  alt='分享二维码'
                  className='w-[180px] sm:w-[200px] md:w-[240px] h-auto'
                  loading='lazy'
                />
              </div>
              <p className='mt-2 text-sm sm:text-base leading-relaxed text-gray-600 dark:text-gray-400 text-center'>
                {isWeChatOrQQ
                  ? '当前为微信/QQ内置浏览器环境，下载可能受限。建议复制链接到外部浏览器打开，或让对方扫码下载。'
                  : '可复制链接或扫码下载；如无法直接打开，请复制到浏览器中。'}
              </p>
            </div>
          </div>
        </Modal>
      )}

    </>
  );
};

export default DownloadPage;
