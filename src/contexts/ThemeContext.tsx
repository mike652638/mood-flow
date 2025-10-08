import React, { createContext, useEffect, useRef, useState } from 'react';
import { useUIStore } from '../store';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 动态注入过渡样式，避免依赖全局 CSS 文件
  const transitionStyleInjectedRef = useRef(false);

  const [theme, setThemeState] = useState<Theme>(() => {
    // 从 localStorage 获取保存的主题，或使用默认深色模式
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme) {
      return savedTheme;
    }

    // 默认使用浅色模式
    return 'light';

    // 默认使用深色模式
    // return 'dark';
  });

  const isDark = theme === 'dark';

  useEffect(() => {
    if (!transitionStyleInjectedRef.current) {
      try {
        const style = document.createElement('style');
        style.setAttribute('data-theme-transition', '');
        style.textContent = `
          .theme-transition, .theme-transition * {
            transition: background-color 200ms ease, color 200ms ease, border-color 200ms ease,
              fill 200ms ease, stroke 200ms ease;
          }
          @media (prefers-reduced-motion: reduce) {
            .theme-transition, .theme-transition * { transition: none !important; }
          }
        `;
        document.head.appendChild(style);
        transitionStyleInjectedRef.current = true;
      } catch {
        // 忽略样式注入错误
      }
    }

    // 应用主题到 document，并添加轻微过渡动画
    const root = document.documentElement;
    root.classList.add('theme-transition');
    const removeTransition = window.setTimeout(() => {
      root.classList.remove('theme-transition');
    }, 250);
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    return () => {
      window.clearTimeout(removeTransition);
      root.classList.remove('theme-transition');
    };

    // 保存到 localStorage
    localStorage.setItem('theme', theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const value = {
    theme,
    isDark,
    toggleTheme,
    setTheme
  };

  // 跟随系统主题与按时间段自动切换
  const {
    followSystemTheme,
    autoThemeEnabled,
    autoThemeStart,
    autoThemeEnd,
    themeMode,
    setTheme: setUiTheme
  } = useUIStore();

  // 保持 Store 中的 theme 与上下文一致
  useEffect(() => {
    setUiTheme(theme);
  }, [theme, setUiTheme]);

  // 跟随系统主题：监听 prefers-color-scheme
  useEffect(() => {
    if (!followSystemTheme) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setThemeState(media.matches ? 'dark' : 'light');
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [followSystemTheme]);

  // 自动按时间段切换：基于下一个边界进行定时，无需轮询
  const autoTimerRef = useRef<number | null>(null);
  useEffect(() => {
    // 跟随系统或未开启自动模式时，取消调度
    if (followSystemTheme || !autoThemeEnabled || themeMode !== 'auto') {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
      return;
    }

    const toMinutes = (hhmm: string): number => {
      const [h, m] = hhmm.split(':').map(v => parseInt(v, 10));
      return h * 60 + m;
    };

    const nowToMinutes = (): number => {
      const d = new Date();
      return d.getHours() * 60 + d.getMinutes();
    };

    const inRange = (start: number, end: number, now: number): boolean => {
      // 支持跨午夜
      if (start <= end) {
        return now >= start && now < end;
      }
      return now >= start || now < end;
    };

    const scheduleNext = () => {
      const start = toMinutes(autoThemeStart || '22:00');
      const end = toMinutes(autoThemeEnd || '07:00');
      const nowMin = nowToMinutes();
      // 移除未使用的 dayMs，保持计算基于分钟差值

      // 计算当前是否深色与下一个边界分钟数
      const isDarkPeriod = inRange(start, end, nowMin);
      setThemeState(isDarkPeriod ? 'dark' : 'light');

      const nextBoundaryMin = (() => {
        if (isDarkPeriod) {
          // 下一个边界是结束时间 end
          return end;
        }
        // 非深色区间，下一个边界是开始时间 start
        return start;
      })();

      // 计算到下一个边界的毫秒数
      const diffMin = (() => {
        if (nextBoundaryMin >= nowMin) return nextBoundaryMin - nowMin;
        // 跨天
        return nextBoundaryMin + 24 * 60 - nowMin;
      })();
      const delayMs = diffMin * 60 * 1000;

      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
      }
      autoTimerRef.current = window.setTimeout(scheduleNext, delayMs);
    };

    scheduleNext();
    return () => {
      if (autoTimerRef.current) {
        clearTimeout(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [autoThemeEnabled, autoThemeStart, autoThemeEnd, followSystemTheme, themeMode]);

  // 统一模式入口：根据 themeMode 应用对应逻辑
  useEffect(() => {
    if (themeMode === 'system') {
      const media = window.matchMedia('(prefers-color-scheme: dark)');
      const apply = () => setThemeState(media.matches ? 'dark' : 'light');
      apply();
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }

    if (themeMode === 'light') {
      setThemeState('light');
      return;
    }

    if (themeMode === 'dark') {
      setThemeState('dark');
      return;
    }
    // 'auto' 模式的调度由上面的 effect 负责，这里只确保立即一次应用
    if (themeMode === 'auto') {
      // 触发一次以同步 UI
      const start = (autoThemeStart || '22:00').split(':').map(n => parseInt(n, 10));
      const end = (autoThemeEnd || '07:00').split(':').map(n => parseInt(n, 10));
      const now = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const startMin = start[0] * 60 + start[1];
      const endMin = end[0] * 60 + end[1];
      const isDarkPeriod = startMin <= endMin
        ? nowMin >= startMin && nowMin < endMin
        : nowMin >= startMin || nowMin < endMin;
      setThemeState(isDarkPeriod ? 'dark' : 'light');
    }
  }, [themeMode, autoThemeStart, autoThemeEnd]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
