import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { toast as sonnerToast } from 'sonner';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard } from '@capacitor/keyboard';

// 检查是否在原生环境中运行
export const isNative = () => {
  return Capacitor.isNativePlatform();
};

// 检查平台类型
export const getPlatform = () => {
  return Capacitor.getPlatform();
};

// 相机功能
export const takePicture = async () => {
  try {
    if (!isNative()) {
      // Web 环境下的文件选择
      return new Promise<string>((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = e => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          } else {
            reject(new Error('No file selected'));
          }
        };
        input.click();
      });
    }

    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Prompt // 让用户选择相机或相册
    });

    return image.dataUrl || '';
  } catch (error) {
    console.error('Error taking picture:', error);
    throw error;
  }
};

// 文件系统操作
export const saveFile = async (data: string, fileName: string) => {
  try {
    if (!isNative()) {
      // Web 环境下的文件下载
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    await Filesystem.writeFile({
      path: fileName,
      data: data,
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });

    await showToast('文件保存成功');
  } catch (error) {
    console.error('Error saving file:', error);
    await showToast('文件保存失败');
    throw error;
  }
};

// 读取文件
export const readFile = async (fileName: string) => {
  try {
    if (!isNative()) {
      throw new Error('File reading not supported in web environment');
    }

    const result = await Filesystem.readFile({
      path: fileName,
      directory: Directory.Documents,
      encoding: Encoding.UTF8
    });

    return result.data as string;
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
};

// 分享功能
export const shareContent = async (title: string, text: string, url?: string) => {
  try {
    if (!isNative()) {
      // Web 环境下的分享 API
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else {
        // 降级到复制到剪贴板
        await navigator.clipboard.writeText(`${title}\n${text}${url ? `\n${url}` : ''}`);
        await showToast('内容已复制到剪贴板');
      }
      return;
    }

    await Share.share({
      title,
      text,
      url,
      dialogTitle: '分享情绪日记'
    });
  } catch (error) {
    console.error('Error sharing:', error);
    throw error;
  }
};

// 显示 Toast 消息
export const showToast = async (
  message: string,
  duration: 'short' | 'long' = 'short',
  variant: 'default' | 'success' | 'error' | 'warning' = 'default'
) => {
  try {
    const ms = duration === 'short' ? 2000 : 4000;

  switch (variant) {
    case 'success':
      sonnerToast.success(message, { duration: ms });
      break;
    case 'error':
      sonnerToast.error(message, { duration: ms });
      break;
    case 'warning':
      if (sonnerToast.warning) {
        sonnerToast.warning(message, { duration: ms });
      } else {
        sonnerToast(message, { duration: ms });
      }
      break;
    default:
      sonnerToast(message, { duration: ms });
  }
  } catch (error) {
    console.error('Error showing toast:', error);
  }
};

// 状态栏控制
export const setStatusBarStyle = async (style: 'light' | 'dark' = 'dark', backgroundColor?: string) => {
  try {
    if (!isNative()) return;

    await StatusBar.setStyle({
      style: style === 'light' ? Style.Light : Style.Dark
    });

    // 设置沉浸式状态栏
    await StatusBar.setOverlaysWebView({ overlay: true });

    if (backgroundColor) {
      await StatusBar.setBackgroundColor({ color: backgroundColor });
    }
  } catch (error) {
    console.error('Error setting status bar style:', error);
  }
};

// 设置沉浸式状态栏
export const setImmersiveStatusBar = async (theme: 'light' | 'dark' = 'light') => {
  try {
    if (!isNative()) return;

    // 启用沉浸式模式
    await StatusBar.setOverlaysWebView({ overlay: true });

    // 根据主题设置状态栏样式
    if (theme === 'light') {
      await StatusBar.setStyle({ style: Style.Light }); // 浅色背景用深色文字
      await StatusBar.setBackgroundColor({ color: '#00000000' }); // 透明背景
    } else {
      await StatusBar.setStyle({ style: Style.Dark }); // 深色背景用浅色文字
      await StatusBar.setBackgroundColor({ color: '#00000000' }); // 透明背景
    }
  } catch (error) {
    console.error('Error setting immersive status bar:', error);
  }
};

// 恢复普通状态栏
export const setNormalStatusBar = async (backgroundColor: string = '#4CAF50') => {
  try {
    if (!isNative()) return;

    // 禁用沉浸式模式
    await StatusBar.setOverlaysWebView({ overlay: false });

    // 设置背景色
    await StatusBar.setBackgroundColor({ color: backgroundColor });

    // 设置样式：根据背景亮度选择前景颜色（统一逻辑，避免与主题产生冲突）
    try {
      const rgb = (() => {
        const hex = backgroundColor.replace('#', '');
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
      })();
      const luminance = 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
      // 浅色背景（亮度高）使用深色文字（Style.Light）；深色背景使用浅色文字（Style.Dark）
      const style = luminance > 170 ? Style.Light : Style.Dark;
      await StatusBar.setStyle({ style });
    } catch {
      // 兜底：浅色主题使用深色图标
      await StatusBar.setStyle({ style: Style.Dark });
    }
  } catch (error) {
    console.error('Error setting normal status bar:', error);
  }
};

// 检测设备是否支持沉浸式状态栏（原生 + 插件可用）
export const supportsImmersiveStatusBar = async (): Promise<{ supported: boolean; reason?: string; platform?: string }> => {
  try {
    const native = Capacitor.isNativePlatform();
    const platform = Capacitor.getPlatform();
    const available = Capacitor.isPluginAvailable('StatusBar');

    if (!native) {
      return { supported: false, reason: '当前为 Web 环境', platform };
    }
    if (!available) {
      return { supported: false, reason: '缺少 StatusBar 插件', platform };
    }

    // 在 Android / iOS 的原生容器中，Capacitor StatusBar 均支持覆盖 WebView
    return { supported: true, platform };
  } catch (error) {
    console.warn('检测沉浸式状态栏支持失败：', error);
    return { supported: false, reason: '检测失败' };
  }
};

// 隐藏启动画面
export const hideSplashScreen = async () => {
  try {
    if (!isNative()) return;

    await SplashScreen.hide();
  } catch (error) {
    console.error('Error hiding splash screen:', error);
  }
};

// 键盘控制
export const hideKeyboard = async () => {
  try {
    if (!isNative()) {
      // Web 环境下失焦当前活动元素
      (document.activeElement as HTMLElement)?.blur();
      return;
    }

    await Keyboard.hide();
  } catch (error) {
    console.error('Error hiding keyboard:', error);
  }
};

// 获取设备信息
export const getDeviceInfo = async () => {
  try {
    if (!isNative()) {
      return {
        platform: 'web',
        model: navigator.userAgent,
        operatingSystem: navigator.platform,
        osVersion: 'unknown',
        manufacturer: 'unknown',
        isVirtual: false,
        webViewVersion: 'unknown'
      };
    }

    const { Device } = await import('@capacitor/device');
    const info = await Device.getInfo();
    return info;
  } catch (error) {
    console.error('Error getting device info:', error);
    return null;
  }
};

// 网络状态检测
export const getNetworkStatus = async () => {
  try {
    if (!isNative()) {
      return {
        connected: navigator.onLine,
        connectionType: 'unknown'
      };
    }

    const { Network } = await import('@capacitor/network');
    const status = await Network.getStatus();
    return status;
  } catch (error) {
    console.error('Error getting network status:', error);
    return { connected: true, connectionType: 'unknown' };
  }
};

// 应用初始化
export const initializeApp = async () => {
  try {
    if (!isNative()) {
      // Running in web environment
      console.info('[PROD] Running in web environment');
      return;
    }

    // Running in native app
    // 交由界面层（ImmersiveStatusBar 组件或显式调用）统一管理状态栏样式，避免初始化阶段的抢占与冲突

    // 显示覆盖式启动画面，交由 Capacitor 配置控制时长
    // 确保在 Android 12+ 上接管系统级图标页后呈现全屏 Splash
    await SplashScreen.show();

    // 获取设备信息
    const deviceInfo = await getDeviceInfo();
    console.info('[PROD] Device info:', deviceInfo);

    // 检查网络状态
    const networkStatus = await getNetworkStatus();
    console.info('[PROD] Network status:', networkStatus);

    // 延迟隐藏启动图，确保应用完全加载
    setTimeout(async () => {
      try {
        await SplashScreen.hide();
        console.info('[PROD] Splash screen hidden after delay');
      } catch (error) {
        console.error('Error hiding splash screen:', error);
      }
    }, 3000);

    // App initialized successfully
  } catch (error) {
    console.error('Error initializing app:', error);
  }
};

// 导出所有功能
export const CapacitorUtils = {
  isNative,
  getPlatform,
  takePicture,
  saveFile,
  readFile,
  shareContent,
  showToast,
  setStatusBarStyle,
  supportsImmersiveStatusBar,
  hideSplashScreen,
  hideKeyboard,
  getDeviceInfo,
  getNetworkStatus,
  initializeApp
};

export default CapacitorUtils;
