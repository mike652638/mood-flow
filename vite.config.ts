import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

function readAppVersion(): string {
  const gradlePath = join(process.cwd(), 'android', 'app', 'build.gradle');
  if (existsSync(gradlePath)) {
    const txt = readFileSync(gradlePath, 'utf-8');
    const m = txt.match(/versionName\s+"([^"]+)"/);
    if (m) return m[1];
  }

  const pkgPath = join(process.cwd(), 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      return pkg.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  return '0.0.0';
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(readAppVersion()),
  },
  build: {
    sourcemap: 'hidden',
    rollupOptions: {
      output: {
        manualChunks: {
          // 将 React 相关库分离到单独的 chunk
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // 将 UI 组件库分离
          'ui-vendor': ['sonner', 'lucide-react'],
          // 将数据库和状态管理相关库分离
          'data-vendor': ['@supabase/supabase-js', 'zustand'],
          // 将图表和分析相关库分离
          'chart-vendor': ['recharts', 'date-fns', '@visx/responsive', '@visx/scale', '@visx/text', '@visx/wordcloud'],
          // 将 Capacitor 相关库分离
          'capacitor-vendor': [
            '@capacitor/core', 
            '@capacitor/camera', 
            '@capacitor/device', 
            '@capacitor/filesystem', 
            '@capacitor/keyboard', 
            '@capacitor/network', 
            '@capacitor/share', 
            '@capacitor/splash-screen', 
            '@capacitor/status-bar', 
            '@capacitor/toast',
            '@langx/capacitor-voice-recorder',
            '@ionic/pwa-elements'
          ]
        }
      }
    }
  },
  plugins: [
    // 移除开发态的 react-dev-locator 以避免浏览器尝试请求 TSX 源文件导致的 net::ERR_ABORTED 报错
    react(),
    tsconfigPaths()
  ],
})
