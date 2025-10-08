import React, { useEffect, useState } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

interface ImmersiveStatusBarProps {
  immersive?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  backgroundColor?: string;
  showIndicator?: boolean;
  enableTransition?: boolean;
  debugMode?: boolean;
}

const ImmersiveStatusBar: React.FC<ImmersiveStatusBarProps> = ({
  immersive = false,
  theme = 'auto',
  backgroundColor = '#4CAF50',
  showIndicator = false,
  enableTransition = true,
  debugMode = false
}) => {
  const [isNative, setIsNative] = useState(false);

  useEffect(() => {
    setIsNative(Capacitor.isNativePlatform());
  }, []);

  useEffect(() => {
    if (!isNative) return;

    // 利用 showIndicator 设置一个 CSS 变量，供必要时在样式中显示调试指示（避免未使用变量告警）
    try {
      document.documentElement.style.setProperty('--status-bar-indicator-visible', showIndicator ? '1' : '0');
    } catch {
      // 忽略 DOM 操作可能的错误（如 SSR 环境）
    }

    // 设置CSS变量用于背景色（非沉浸式时与 Header 起始色保持一致）
    if (!immersive) {
      try {
        const root = document.documentElement;
        const headerStart = getComputedStyle(root).getPropertyValue('--header-start-color')?.trim();
        root.style.setProperty(
          '--status-bar-bg-color',
          headerStart && headerStart.length > 0 ? headerStart : backgroundColor
        );
      } catch {
        document.documentElement.style.setProperty('--status-bar-bg-color', backgroundColor);
      }
    }

    // 根据设备实际状态栏高度设置变量（Android 回退）
    try {
      const fallbackStatusBarHeight = 24;
      const testDiv = document.createElement('div');
      testDiv.style.paddingTop = 'env(safe-area-inset-top, 0px)';
      document.body.appendChild(testDiv);
      const computed = getComputedStyle(testDiv).paddingTop;
      document.body.removeChild(testDiv);
      const envTopPx = parseFloat(computed || '0');
      const finalStatusBar = Number.isFinite(envTopPx) && envTopPx > 0 ? envTopPx : fallbackStatusBarHeight;
      document.documentElement.style.setProperty('--status-bar-height', `${finalStatusBar}px`);
      const headerHeight = 56;
      document.documentElement.style.setProperty('--header-height', `${headerHeight}px`);
      const extraTop = immersive ? 32 : 4;
      document.documentElement.style.setProperty('--safe-area-extra-top', `${extraTop}px`);
    } catch (error) {
      console.error('Failed to set status bar properties:', error);
    }

    const updateStatusBar = async () => {
      try {
        if (immersive) {
          await StatusBar.setOverlaysWebView({ overlay: true });
          await StatusBar.setBackgroundColor({ color: '#00000000' });

          // 基于顶部实际背景亮度自动选择前景（系统信息文字/图标）颜色
          const root = document.documentElement;
          const headerEl = document.querySelector('header') as HTMLElement | null;

          const toRgb = (color: string): { r: number; g: number; b: number } => {
            const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
            if (!color) return { r: 255, g: 255, b: 255 };
            if (color.startsWith('#')) {
              const hex = color.replace('#', '');
              const full =
                hex.length === 3
                  ? hex
                      .split('')
                      .map(ch => ch + ch)
                      .join('')
                  : hex.substring(0, 6);
              const r = parseInt(full.substring(0, 2), 16);
              const g = parseInt(full.substring(2, 4), 16);
              const b = parseInt(full.substring(4, 6), 16);
              return { r, g, b };
            }
            const m = color.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+))?\)/i);
            if (m) {
              const r = clamp(Number(m[1]));
              const g = clamp(Number(m[2]));
              const b = clamp(Number(m[3]));
              const a = m[4] ? Number(m[4]) : 1;
              const mix = (c: number) => clamp(c * a + 255 * (1 - a));
              return { r: mix(r), g: mix(g), b: mix(b) };
            }
            return { r: 255, g: 255, b: 255 };
          };

          const parseFirstGradientColor = (bgImage: string): string | undefined => {
            if (!bgImage) return undefined;
            // 优先解析 var(--xxx)
            const varMatch = bgImage.match(/var\((--[a-zA-Z0-9-]+)\)/);
            if (varMatch && varMatch[1]) {
              const v = getComputedStyle(root).getPropertyValue(varMatch[1])?.trim();
              if (v) return v;
            }
            // 回退解析 rgba()/rgb()
            const rgbaMatch = bgImage.match(/rgba?\([^)]+\)/i);
            if (rgbaMatch && rgbaMatch[0]) return rgbaMatch[0];
            // 再次回退解析 #hex
            const hexMatch = bgImage.match(/#([0-9a-fA-F]{3,8})/);
            if (hexMatch && hexMatch[0]) return hexMatch[0];
            return undefined;
          };

          let topColor: string | undefined;
          if (headerEl) {
            const styles = getComputedStyle(headerEl);
            topColor =
              parseFirstGradientColor(styles.backgroundImage || '') ||
              (styles.backgroundColor && styles.backgroundColor !== 'transparent' ? styles.backgroundColor : undefined);
          }
          if (!topColor) {
            const headerStart = getComputedStyle(root).getPropertyValue('--header-start-color')?.trim();
            topColor =
              headerStart && headerStart.length > 0
                ? headerStart
                : root.classList.contains('dark')
                ? '#1f2937'
                : '#ffffff';
          }

          const rgb = toRgb(topColor || '#ffffff');
          const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b; // 0-255
          // 修复逻辑：亮度高（浅色背景）使用深色文字(Style.Light)，亮度低（深色背景）使用浅色文字(Style.Dark)
          const styleByTop = luminance > 170 ? Style.Light : Style.Dark;

          await StatusBar.setStyle({ style: styleByTop });
        } else {
          const isDark =
            theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
          const root = document.documentElement;
          const headerStart = getComputedStyle(root).getPropertyValue('--header-start-color')?.trim();
          const fallbackBg = isDark ? '#1f2937' : '#ffffff';
          const nonImmersiveBg = headerStart && headerStart.length > 0 ? headerStart : fallbackBg;

          // 将 CSS 颜色转换为 RGB
          const toRgb = (color: string): { r: number; g: number; b: number } => {
            const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
            if (color.startsWith('#')) {
              const hex = color.replace('#', '');
              const full =
                hex.length === 3
                  ? hex
                      .split('')
                      .map(ch => ch + ch)
                      .join('')
                  : hex.substring(0, 6);
              const r = parseInt(full.substring(0, 2), 16);
              const g = parseInt(full.substring(2, 4), 16);
              const b = parseInt(full.substring(4, 6), 16);
              return { r, g, b };
            }
            const m = color.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+))?\)/i);
            if (m) {
              const r = clamp(Number(m[1]));
              const g = clamp(Number(m[2]));
              const b = clamp(Number(m[3]));
              const a = m[4] ? Number(m[4]) : 1;
              // 在计算亮度时考虑透明度对视觉亮度的影响（简单近似，将与白色混合）
              const mix = (c: number) => clamp(c * a + 255 * (1 - a));
              return { r: mix(r), g: mix(g), b: mix(b) };
            }
            // 兜底返回白色
            return { r: 255, g: 255, b: 255 };
          };

          const rgb = toRgb(nonImmersiveBg);
          const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b; // 0-255
          // 修复逻辑：亮度高（浅色背景）使用深色文字(Style.Light)，亮度低（深色背景）使用浅色文字(Style.Dark)
          const styleByBg = luminance > 170 ? Style.Light : Style.Dark;

          await StatusBar.setOverlaysWebView({ overlay: false });
          // 传入 HEX，避免 rgba 在原生端不被识别
          const hex = `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b
            .toString(16)
            .padStart(2, '0')}`;
          await StatusBar.setBackgroundColor({ color: hex });
          await StatusBar.setStyle({ style: styleByBg });
          document.documentElement.style.setProperty('--status-bar-bg-color', nonImmersiveBg);
        }
      } catch (error) {
        console.error('Failed to update status bar:', error);
      }
    };

    updateStatusBar();
  }, [isNative, immersive, theme, backgroundColor, enableTransition, debugMode, showIndicator]);

  return null;
};

export default ImmersiveStatusBar;
