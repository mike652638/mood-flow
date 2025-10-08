import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { supabase } from './lib/supabase';
import { initializeApp, setImmersiveStatusBar, isNative } from './utils/capacitor';
import { checkForUpdate, getAutoCheckEnabled, openUpdateLink } from './utils/update';
import { preDownloadApk, installDownloadedApk } from './utils/nativeUpdate';
import Modal from './components/Modal';
import { useAuthStore } from './store';
import Layout from './components/Layout';
import ImmersiveStatusBar from './components/ImmersiveStatusBar';

// 使用动态导入进行代码分割
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Home = lazy(() => import('./pages/Home'));
const Record = lazy(() => import('./pages/Record'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Settings = lazy(() => import('./pages/Settings'));
const Mentor = lazy(() => import('./pages/Mentor'));

function App() {
  const { user, setUser, logout } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [immersiveMode, setImmersiveMode] = useState(isNative());
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark'>('light');
  const [mandatoryUpdate, setMandatoryUpdate] = useState<{ version: string; url?: string } | null>(null);

  useEffect(() => {
    // 初始化应用（不阻塞认证检查）
    const initialize = async () => {
      try {
        await initializeApp();

        // 仅在原生环境默认启用沉浸式状态栏
        if (isNative()) {
          await setImmersiveStatusBar(currentTheme);
        }
      } catch (error) {
        console.error('App initialization error:', error);
      }
    };

    // 检查用户认证状态（优先通过会话判断，避免在无会话时触发刷新令牌请求）
    const checkAuth = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const authUser = sessionData.session?.user || null;
        if (authUser) {
          setUser({
            id: authUser.id,
            email: authUser.email || '',
            name: authUser.user_metadata?.name || authUser.email?.split('@')[0] || '',
            avatar_url: authUser.user_metadata?.avatar_url,
            preferences: authUser.user_metadata?.preferences || {},
            created_at: authUser.created_at,
            updated_at: authUser.updated_at || authUser.created_at
          });
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    // 并行执行初始化与认证检查，并设置安全兜底：最长等待 5 秒
    initialize();
    const authPromise = checkAuth();
    const timeout = setTimeout(() => setLoading(false), 5000);

    authPromise.finally(() => clearTimeout(timeout));

    // 监听认证状态变化
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || '',
          avatar_url: session.user.user_metadata?.avatar_url,
          preferences: session.user.user_metadata?.preferences || {},
          created_at: session.user.created_at,
          updated_at: session.user.updated_at || session.user.created_at
        });
      } else if (event === 'SIGNED_OUT') {
        logout();
      }
    });

    return () => subscription.unsubscribe();
  }, [setUser, logout, currentTheme]);

  // 开机与回到前台自动检查更新（受设置开关控制）
  useEffect(() => {
    const performAutoCheck = async () => {
      try {
        if (!getAutoCheckEnabled()) return;
        const result = await checkForUpdate();
        if (result.hasUpdate && result.info) {
          if (result.info.mandatory) {
            setMandatoryUpdate({ version: result.info.latestVersion, url: result.info.androidApkUrl });
            // 原生端：尝试在后台静默预下载并触发安装（需要原生实现支持）
            try {
              if (isNative() && result.info.androidApkUrl) {
                const dl = await preDownloadApk(result.info.androidApkUrl);
                if (dl.ok && dl.path) {
                  await installDownloadedApk(dl.path);
                }
              }
            } catch (err) {
              console.warn('Pre-download failed:', err);
            }
          } else {
            // 非强制更新：给予提示即可
            // 这里不打断用户流程，提示可前往设置页更新
            // 使用轻量 toast 提示，不做交互按钮，避免跨端兼容复杂度
            console.info(`发现新版本 V${result.info.latestVersion}，可前往“设置”页面更新`);
          }
        }
      } catch {
        // 忽略自动检查错误
      }
    };

    // 启动后检查一次
    performAutoCheck();

    // 前后台切换时检查：原生优先使用 Capacitor App，Web 使用 visibilitychange
    let removeListener: (() => void) | undefined;
    try {
      if (isNative()) {
        // 动态导入以避免 Web 端无插件时报错
        import('@capacitor/app')
          .then((mod: typeof import('@capacitor/app')) => {
            const App = mod.App;
            const sub = App.addListener('appStateChange', (state: { isActive: boolean }) => {
              if (state?.isActive) performAutoCheck();
            });
            // addListener 在运行时返回 Promise<PluginListenerHandle>；此处需在移除时等待句柄
            removeListener = () => {
              try {
                // 兼容 Promise 句柄与直接句柄两种情况
                const maybePromise = sub as unknown as Promise<{ remove: () => Promise<void> }> | { remove: () => Promise<void> };
                if (typeof (maybePromise as any)?.then === 'function') {
                  (maybePromise as Promise<{ remove: () => Promise<void> }>).then(h => h.remove()).catch(() => {});
                } else {
                  (maybePromise as { remove: () => Promise<void> }).remove?.();
                }
              } catch {}
            };
          })
          .catch(() => {
            // 原生失败时降级到文档可见性
            const onVis = () => {
              if (document.visibilityState === 'visible') performAutoCheck();
            };
            document.addEventListener('visibilitychange', onVis);
            removeListener = () => document.removeEventListener('visibilitychange', onVis);
          });
      } else {
        const onVis = () => {
          if (document.visibilityState === 'visible') performAutoCheck();
        };
        document.addEventListener('visibilitychange', onVis);
        removeListener = () => document.removeEventListener('visibilitychange', onVis);
      }
    } catch (err) {
      console.warn('Auto-check listener setup failed:', err);
    }

    return () => {
      try {
        removeListener?.();
      } catch (err) {
        console.warn('Auto-check listener cleanup failed:', err);
      }
    };
  }, []);

  // 处理主题切换
  const handleThemeChange = (theme: 'light' | 'dark') => {
    setCurrentTheme(theme);
    // 更新HTML根元素的主题类（同时支持 .dark 与 .dark-theme 两种类，以兼容现有样式文件）
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('dark-theme', theme === 'dark');
  };

  if (loading) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-sky-50 dark:bg-gradient-to-br dark:from-theme-gray-900 dark:to-theme-gray-800'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 dark:border-emerald-400 mx-auto mb-4'></div>
          <p className='text-gray-800 dark:text-gray-200 font-medium'>加载中，请稍候 ...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      {/* 沉浸式状态栏组件 */}
      <ImmersiveStatusBar immersive={immersiveMode} theme={currentTheme} showIndicator={true} enableTransition={true} />

      <div className={`app-container ${immersiveMode ? 'immersive' : ''}`}>
        <Suspense
          fallback={
            <div className='min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-sky-50 dark:bg-gradient-to-br dark:from-theme-gray-900 dark:to-theme-gray-800'>
              <div className='text-center'>
                <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 dark:border-emerald-400 mx-auto mb-4'></div>
                <p className='text-gray-800 dark:text-gray-200 font-medium'>加载中，请稍候 ...</p>
              </div>
            </div>
          }>
          {user ? (
            <Routes>
              <Route path='/' element={<Layout immersiveMode={immersiveMode} currentTheme={currentTheme} />}>
                <Route index element={<Home />} />
                <Route path='home' element={<Home />} />
                <Route path='record' element={<Record />} />
                <Route path='analytics' element={<Analytics />} />
                <Route path='mentor' element={<Mentor />} />
                <Route
                  path='settings'
                  element={
                    <Settings
                      immersiveMode={immersiveMode}
                      onImmersiveModeChange={setImmersiveMode}
                      onThemeChange={handleThemeChange}
                    />
                  }
                />
              </Route>
              <Route path='/terms' element={<Terms />} />
              <Route path='/privacy' element={<Privacy />} />
              <Route path='*' element={<Navigate to='/' replace />} />
            </Routes>
          ) : (
            <Routes>
              <Route path='/login' element={<Login />} />
              <Route path='/register' element={<Register />} />
              <Route path='/forgot-password' element={<ForgotPassword />} />
              <Route path='/terms' element={<Terms />} />
              <Route path='/privacy' element={<Privacy />} />
              <Route path='*' element={<Navigate to='/login' replace />} />
            </Routes>
          )}
        </Suspense>
        {/* 强制更新弹窗（不可关闭，仅允许前往更新）*/}
        {mandatoryUpdate && (
          <Modal title={`必须更新到 V${mandatoryUpdate.version}`} onClose={() => {}}>
            <div className='space-y-3 sm:space-y-4'>
              <p className='text-sm sm:text-base text-gray-700 dark:text-gray-200'>
                为了保证功能与安全性，请立即更新到最新版本。
              </p>
              <div className='flex justify-center pt-2'>
                <button
                  onClick={() => mandatoryUpdate?.url && openUpdateLink(mandatoryUpdate.url)}
                  className='px-4 py-2 rounded-lg border bg-purple-600 text-white hover:bg-purple-700'>
                  立即更新
                </button>
                <button
                  onClick={async () => {
                    try {
                      const mod: typeof import('@capacitor/app') = await import('@capacitor/app');
                      const AppPlugin = mod.App;
                      if (AppPlugin?.exitApp) {
                        await AppPlugin.exitApp();
                        return;
                      }
                    } catch (err) {
                      console.warn('[PROD] Exit app failed:', err);
                    }
                    try {
                      window.close();
                    } catch (err) {
                      console.warn('[PROD] Close window failed:', err);
                    }
                  }}
                  className='ml-3 px-4 py-2 rounded-lg border bg-gray-100 dark:bg-theme-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-theme-gray-700'>
                  退出应用
                </button>
              </div>
            </div>
          </Modal>
        )}
        <Toaster position='top-center' richColors offset={128} mobileOffset={{ top: 128 }} duration={2500} />
      </div>
    </Router>
  );
}

export default App;
