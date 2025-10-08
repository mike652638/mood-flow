import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, PenTool, BarChart3, Settings, Camera, Mic, MessageSquare } from 'lucide-react';
import { ImmersiveModeContext } from '../contexts/ImmersiveModeContext';
import { isNative } from '../utils/capacitor';

interface LayoutProps {
  immersiveMode?: boolean;
  currentTheme?: 'light' | 'dark';
}

const Layout = ({ immersiveMode = false, currentTheme = 'light' }: LayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const nativeImmersive = immersiveMode && isNative();

  // refs for positioning quick actions above the "record" item
  const recordRef = useRef<HTMLAnchorElement | null>(null);
  const [showQuick, setShowQuick] = useState(false);
  const [suppressNextClick, setSuppressNextClick] = useState(false);

  const navItems = useMemo(
    () => [
      { path: '/home', icon: Home, label: '首页' },
      { path: '/record', icon: PenTool, label: '记录' },
      { path: '/mentor', icon: MessageSquare, label: '导师' },
      { path: '/analytics', icon: BarChart3, label: '分析' },
      { path: '/settings', icon: Settings, label: '设置' }
    ],
    []
  );

  // 计算当前激活导航项索引（根路径视为首页）
  const activeIndex = useMemo(
    () => navItems.findIndex(i => location.pathname === i.path || (i.path === '/home' && location.pathname === '/')),
    [location.pathname, navItems]
  );
  const itemWidthPercent = 100 / navItems.length;

  // 新增：nav-indicator 引用 & 通过 CSS 变量更新宽度与偏移，避免使用内联 style
  const indicatorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = indicatorRef.current;
    if (!el) return;
    el.style.setProperty('--indicator-width', `${itemWidthPercent}%`);
    el.style.setProperty('--indicator-offset', `${(activeIndex < 0 ? 0 : activeIndex) * 100}%`);
  }, [itemWidthPercent, activeIndex]);

  // 轻微震动反馈（支持的设备上）
  const handleNavClick = (e?: React.MouseEvent<HTMLAnchorElement> | React.TouchEvent<HTMLAnchorElement>) => {
    if (suppressNextClick) {
      // 若因长按打开了快捷菜单，拦截本次点击跳转
      e?.preventDefault();
      e?.stopPropagation();
      setSuppressNextClick(false);
      return;
    }
    try {
      (navigator as Navigator & { vibrate?: (duration: number) => void })?.vibrate?.(10);
    } catch {
      // 忽略振动API不支持的情况
    }
  };

  // 处理“记录”长按逻辑
  const longPressTimer = useRef<number | null>(null);
  const LONG_PRESS_MS = 420;
  const onRecordPointerDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    // 仅在主指针且非鼠标右键触发
    if (e.button !== 0) return;
    longPressTimer.current = window.setTimeout(() => {
      setShowQuick(true);
      setSuppressNextClick(true); // 打开后阻止紧随其后的 click 导航
      try {
        (navigator as Navigator & { vibrate?: (duration: number) => void })?.vibrate?.(20);
      } catch {
        // 忽略振动API不支持的情况
      }
    }, LONG_PRESS_MS);
  };
  const clearLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleQuickAction = (type: 'audio' | 'photo') => {
    setShowQuick(false);
    setSuppressNextClick(false); // 重置状态，确保后续点击正常工作
    // 导航到记录页并带上快速参数，记录页可据此决定直接打开录音/拍照
    navigate(`/record?quick=${type}`);
  };

  return (
    <ImmersiveModeContext.Provider value={{ immersiveMode, currentTheme }}>
      <div className={`min-h-screen bg-gradient-healing dark:bg-theme-gray-900 ${immersiveMode ? 'immersive' : ''}`}>
        {/* 主内容区域 - 为固定顶部导航栏留出空间（沉浸模式在原生端按状态栏+Header预留，Web端保持旧的固定值） */}
        <main
          className={`${
            nativeImmersive ? 'pt-safe-area-and-header' : 'pt-20 sm:pt-20 md:pt-24 lg:pt-24 xl:pt-24 2xl:pt-24'
          } pb-24 sm:pb-28 md:pb-32 lg:pb-12 xl:pb-10 fade-in`}>
          <Outlet />
        </main>

        {/* 底部导航栏（仅移动端显示） */}
        <nav
          onContextMenu={e => e.preventDefault()}
          className={`fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-t from-white/98 to-white/95 dark:from-theme-gray-800/98 dark:to-theme-gray-800/95 backdrop-blur-2xl border-t border-white/40 dark:border-theme-gray-700/40 shadow-2xl lg:hidden touch-optimized ${
            nativeImmersive ? 'pb-safe-area-inset-bottom' : 'pb-3 sm:pb-4'
          }`}>
          <div className='max-w-lg mx-auto px-2 sm:px-3'>
            {/* 增加相对定位以承载滑动指示条 */}
            <div className='relative flex py-1 sm:py-2 gap-1 sm:gap-2'>
              {/* 活动项滑动指示条（底部彩色条） */}
              <div
                aria-hidden='true'
                ref={indicatorRef}
                className='nav-indicator pointer-events-none absolute left-0 bottom-0 h-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-transform duration-300 ease-out will-change-transform'
              />

              {navItems.map(({ path, icon: Icon, label }) => {
                // 当访问根路径 '/' 时，首页按钮也应该显示为激活状态
                const isActive = location.pathname === path || (path === '/home' && location.pathname === '/');
                const isRecord = path === '/record';
                return (
                  <Link
                    key={path}
                    to={path}
                    ref={isRecord ? recordRef : undefined}
                    onClick={handleNavClick}
                    onPointerDown={isRecord ? onRecordPointerDown : undefined}
                    onPointerUp={isRecord ? clearLongPress : undefined}
                    onPointerCancel={isRecord ? clearLongPress : undefined}
                    onPointerLeave={isRecord ? clearLongPress : undefined}
                    onContextMenu={
                      isRecord
                        ? e => {
                            e.preventDefault();
                          }
                        : undefined
                    }
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={label}
                    className={`group relative flex flex-col items-center px-1.5 sm:px-2 py-2 sm:py-2.5 rounded-xl transition-all duration-200 min-w-0 flex-1 select-none border touch-optimized cursor-pointer ${
                      isActive
                        ? 'text-purple-600 dark:text-purple-300 bg-white/80 dark:bg-theme-gray-700/80 shadow-lg border-white/50 dark:border-theme-gray-600/50 scale-[1.02]'
                        : 'text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-300 hover:bg-white/60 dark:hover:bg-theme-gray-700/60 active:scale-95 border-transparent'
                   }`}>
                    <Icon
                      className={`w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1 transition-transform duration-200 ${
                        isActive ? 'scale-110' : 'group-hover:scale-110 group-active:scale-95'
                      }`}
                    />
                    <span className='text-[10px] sm:text-xs truncate transition-colors'>{label}</span>
                    {/* 激活状态顶部小指示点 */}
                    <span
                      aria-hidden='true'
                      className={`absolute -top-0.5 w-1.5 h-1.5 rounded-full bg-purple-500/90 shadow shadow-purple-500/40 transition-all duration-200 ${
                        isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                      }`}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* 二级快捷操作浮层（仅在长按"记录"时显示） */}
        {showQuick && (
          <div
            className='fixed inset-0 z-[60] flex items-end justify-center pb-24 sm:pb-28 touch-optimized'
            onContextMenu={e => e.preventDefault()}
            onClick={() => {
              setShowQuick(false);
              setSuppressNextClick(false); // 重置状态，确保后续点击正常工作
            }}>
            <div className='absolute inset-0 bg-black/30 backdrop-blur-[1px]' />
            <div className='relative z-[61] flex items-center gap-6 px-4 py-3 rounded-2xl bg-white/95 dark:bg-gray-800/95 shadow-2xl border border-white/40 dark:border-gray-700/40 animate-in fade-in zoom-in duration-150'>
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleQuickAction('audio');
                }}
                className='flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-b from-purple-500 to-indigo-500 text-white shadow-lg active:scale-95 transition-transform cursor-pointer'>
                <Mic className='w-6 h-6' />
                <span className='mt-1 text-[10px]'>录音</span>
              </button>
              <button
                onClick={e => {
                  e.stopPropagation();
                  handleQuickAction('photo');
                }}
                className='flex flex-col items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-b from-pink-500 to-rose-500 text-white shadow-lg active:scale-95 transition-transform cursor-pointer'>
                <Camera className='w-6 h-6' />
                <span className='mt-1 text-[10px]'>拍照</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </ImmersiveModeContext.Provider>
  );
};

export default Layout;
