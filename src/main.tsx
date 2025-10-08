import { StrictMode } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import './index.scss';
import './styles/mobile.scss';

// 刷新后保留路由：若存在保留记录则在加载前恢复
try {
  const preserved = sessionStorage.getItem('__PRESERVE_ROUTE__');
  if (preserved) {
    history.replaceState(null, '', preserved);
    sessionStorage.removeItem('__PRESERVE_ROUTE__');
  }
} catch (err) {
  console.warn('[PROD] Preserve route failed:', err);
}

// 初始化 PWA Elements 以支持 Web 环境下的相机功能
import { defineCustomElements } from '@ionic/pwa-elements/loader';
defineCustomElements(window);

// 生产注入校验：提示运行时配置是否缺失关键字段
(function validateRuntimeConfig() {
  try {
    if (import.meta.env.PROD) {
      const cfg =
        (
          window as unknown as {
            __RUNTIME_CONFIG__?: { DEEPSEEK_BASE_URL?: string; DEEPSEEK_API_KEY?: string; DEEPSEEK_MODEL?: string };
          }
        ).__RUNTIME_CONFIG__ || {};
      const missing: string[] = [];
      if (!cfg.DEEPSEEK_BASE_URL) missing.push('DEEPSEEK_BASE_URL');
      if (!cfg.DEEPSEEK_API_KEY) missing.push('DEEPSEEK_API_KEY');
      if (!cfg.DEEPSEEK_MODEL) missing.push('DEEPSEEK_MODEL');
      if (missing.length > 0) {
        console.warn(
          '[RuntimeConfig] 缺少运行时配置键：',
          missing.join(', '),
          '\n请通过服务器模板或中间层在 index.html 注入 window.__RUNTIME_CONFIG__'
        );
      }
    }
  } catch (e) {
    console.warn('[RuntimeConfig] 校验失败：', e);
  }
})();

// 首屏前尽早注入初始主题类，减少切换闪烁（非严格 SSR 但可显著改善）
(function applyInitialThemeClass() {
  try {
    const raw = localStorage.getItem('ui-storage');
    const obj = raw ? JSON.parse(raw) : null;
    const s = obj?.state ?? obj ?? {};
    const mode = s?.themeMode ?? localStorage.getItem('themeMode') ?? 'system';
    const theme = s?.theme ?? localStorage.getItem('theme') ?? 'light';
    const start = s?.autoThemeStart ?? '22:00';
    const end = s?.autoThemeEnd ?? '07:00';

    const toMin = (t: string) => {
      const [h, m] = String(t)
        .split(':')
        .map(n => parseInt(n, 10) || 0);
      return h * 60 + m;
    };
    const nowMin = () => {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    };
    const inRange = (a: number, b: number, n: number) => (a <= b ? n >= a && n < b : n >= a || n < b);

    let isDark = false;
    switch (mode) {
      case 'dark':
        isDark = true;
        break;
      case 'light':
        isDark = false;
        break;
      case 'system':
        isDark = !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        break;
      case 'auto':
        isDark = inRange(toMin(start), toMin(end), nowMin());
        break;
      default:
        isDark = theme === 'dark';
    }
    document.documentElement.classList.toggle('dark', isDark);
  } catch {
    // 忽略初始化错误
  }
})();

// 原生平台：在 React 挂载前立即显示覆盖式启动图，避免错过启动阶段
try {
  if (Capacitor.isNativePlatform()) {
    SplashScreen.show();
  }
} catch {
  // 忽略启动图显示异常
}

// 在触摸设备上阻止系统的长按上下文菜单，避免与自定义长按菜单冲突
try {
  const isTouch =
    typeof window !== 'undefined' && (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
  if (isTouch) {
    window.addEventListener(
      'contextmenu',
      e => {
        e.preventDefault();
      },
      { passive: false }
    );
  }
} catch {
  // 忽略触摸事件监听器设置错误
}

// 在开发环境：仅在完全就绪且可用的上下文中进行 Service Worker 清理
// 避免在预渲染/受限/非安全环境下调用，防止 InvalidStateError
if (import.meta.env.DEV) {
  const canUseServiceWorker = (): boolean => {
    try {
      if (typeof window === 'undefined') return false;
      if (Capacitor?.isNativePlatform?.()) return false;
      const isSecure =
        window.isSecureContext ||
        location.protocol === 'https:' ||
        location.protocol === 'capacitor:' ||
        location.hostname === 'localhost' ||
        location.hostname === '127.0.0.1';
      if (!isSecure) return false;
      // 仅在顶层可见文档且已完成加载时执行
      if (window.top !== window) return false;
      // 部分浏览器支持 document.prerendering，用于检测预渲染阶段
      // @ts-expect-error prerendering 可能不存在
      if (document.prerendering) return false;
      if (document.readyState !== 'complete') return false;
      if (!('serviceWorker' in navigator)) return false;
      // 某些环境可能不支持 getRegistrations
      if (typeof navigator.serviceWorker.getRegistrations !== 'function') return false;
      return true;
    } catch {
      return false;
    }
  };

  window.addEventListener('load', () => {
    try {
      if (!canUseServiceWorker()) return;
      const cleaned = sessionStorage.getItem('sw-cleaned-dev');
      if (cleaned === '1') return;
      navigator.serviceWorker
        .getRegistrations()
        .then(regs => {
          if (Array.isArray(regs) && regs.length > 0) {
            return Promise.all(regs.map(r => r.unregister())).then(() => {
              sessionStorage.setItem('sw-cleaned-dev', '1');
              // 轻微延迟后刷新一次，确保注销生效
              setTimeout(() => {
                try {
                  window.location.reload();
                } catch (err) {
                  if (import.meta.env.DEV) console.error('[DEV] Reload failed:', err);
                }
              }, 100);
            });
          }
        })
        .catch(() => {
          // 在受限环境下静默跳过，不记录为错误以避免噪音
          console.info('[DEV] Service Worker cleanup skipped due to environment.');
        });
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[DEV] Service Worker cleanup error:', err);
    }
  });
}

// 仅在真正的生产域名注册 Service Worker，避免本地预览/调试时缓存导致的异常
const isLocalhost =
  typeof window !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1');

if (import.meta.env.PROD && 'serviceWorker' in navigator && !isLocalhost) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        console.info('[PROD] Service Worker registered successfully:', registration);

        // 监听控制器变更：出现新 Service Worker 接管时提示刷新即可更新
        try {
          const showRefreshBanner = () => {
            if (document.getElementById('sw-update-banner')) return;
            const banner = document.createElement('div');
            banner.id = 'sw-update-banner';
            banner.style.position = 'fixed';
            banner.style.left = '50%';
            banner.style.transform = 'translateX(-50%)';
            banner.style.bottom = '24px';
            banner.style.zIndex = '10000';
            banner.style.padding = '10px 14px';
            banner.style.borderRadius = '12px';
            banner.style.color = '#fff';
            banner.style.background = '#7c3aed';
            banner.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
            banner.style.fontSize = '14px';
            banner.style.display = 'flex';
            banner.style.gap = '10px';
            banner.style.alignItems = 'center';
            banner.textContent = '已预下载新版本，点击刷新立即更新';
            const btn = document.createElement('button');
            btn.textContent = '刷新';
            btn.style.background = '#fff';
            btn.style.color = '#7c3aed';
            btn.style.border = 'none';
            btn.style.padding = '6px 10px';
            btn.style.borderRadius = '10px';
            btn.style.cursor = 'pointer';
            btn.addEventListener('click', () => {
              try {
                sessionStorage.setItem('__PRESERVE_ROUTE__', location.pathname + location.search + location.hash);
                window.location.reload();
              } catch (err) {
                console.warn('[PROD] Refresh failed:', err);
              }
            });
            banner.appendChild(btn);
            document.body.appendChild(banner);
          };

          navigator.serviceWorker.addEventListener('controllerchange', () => {
            showRefreshBanner();
          });

          // 部分浏览器在注册后立刻发现更新且安装完成，可通过 updatefound 提前提示
          registration.addEventListener?.('updatefound', () => {
            // 等待到新的 worker 安装完成后再提示
            const sw = registration.installing;
            if (!sw) return;
            sw.addEventListener('statechange', () => {
              if (sw.state === 'activated') {
                showRefreshBanner();
              }
            });
          });
        } catch (err) {
          console.warn('[PROD] SW update banner setup failed:', err);
        }
      })
      .catch(registrationError => {
        console.error('[PROD] Service Worker registration failed:', registrationError);
      });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
