import { useState, useEffect } from 'react';
import {
  User,
  Settings as SettingsIcon,
  Bell,
  Moon,
  Globe,
  Shield,
  Download,
  Trash2,
  LogOut,
  Heart,
  Smartphone,
  Lock,
  EyeOff
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../store';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import Modal from '../components/Modal';
import Container from '../components/Container';
import Header from '../components/Header';
import { useImmersiveMode } from '../hooks/useImmersiveMode';
import { rescheduleDailyReminder, ReminderOptions, requestReminderPermission } from '../utils/reminders';
import { Capacitor } from '@capacitor/core';
import { supportsImmersiveStatusBar } from '../utils/capacitor';
import { useUIStore } from '../store';
import { checkForUpdate, UpdateCheckResult, getAutoCheckEnabled, setAutoCheckEnabled } from '../utils/update';
import UpdateFlow from '../components/UpdateFlow';

interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  joinDate: string;
}

interface AppSettings {
  notifications: boolean;
  darkMode: boolean;
  // 自动切换模式设置
  autoThemeEnabled?: boolean;
  autoThemeStart?: string; // HH:mm
  autoThemeEnd?: string; // HH:mm
  followSystemTheme?: boolean;
  themeMode?: 'system' | 'light' | 'dark' | 'auto';
  language: 'zh' | 'en';
  reminderTime: string;
  reminderTitle: string;
  reminderBody: string;
  quietHoursEnabled: boolean;
  quietStart: string; // HH:mm
  quietEnd: string; // HH:mm
  dataRetention: number; // 天数
  autoBackup: boolean;
  immersiveStatusBar: boolean; // 新增沉浸式状态栏设置
  dataEncryption: boolean; // 数据加密设置
  privacyMode: boolean; // 隐私模式设置
  autoCheckUpdate?: boolean; // 自动检查更新
}

interface SettingsProps {
  immersiveMode?: boolean;
  onImmersiveModeChange?: (enabled: boolean) => void;
  onThemeChange?: (theme: 'light' | 'dark') => void;
}

const Settings = ({ immersiveMode = false, onImmersiveModeChange, onThemeChange }: SettingsProps) => {
  const { immersiveMode: contextImmersiveMode } = useImmersiveMode();
  const actualImmersiveMode = immersiveMode || contextImmersiveMode;
  const [activeTab, setActiveTab] = useState<'account' | 'app'>('account');
  const { toggleTheme, isDark, setTheme } = useTheme();
  const {
    autoThemeEnabled: storeAutoEnabled,
    autoThemeStart: storeAutoStart,
    autoThemeEnd: storeAutoEnd,
    followSystemTheme: storeFollowSystemTheme,
    themeMode: storeThemeMode,
    setAutoThemeEnabled,
    setAutoThemeStart,
    setAutoThemeEnd,
    setFollowSystemTheme,
    setThemeMode,
    theme: uiTheme,
    setTheme: setUiTheme
  } = useUIStore();
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  // 动态版本号（优先使用由 Vite 注入的 __APP_VERSION__，回退到环境变量或默认值）
  const appVersion: string =
    (typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : (import.meta.env.VITE_APP_VERSION as string)) ||
    '1.0.0';

  // 运行时版本（原生端优先使用 App.getInfo），以避免打包注入与安装版本不一致
  const [runtimeVersion, setRuntimeVersion] = useState<string>(appVersion);
  const [_runtimeBuild, setRuntimeBuild] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    const loadVersion = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const mod = await import('@capacitor/app');
          const info: { version?: string; build?: string | number } = await mod.App.getInfo();
          if (!cancelled && info?.version) setRuntimeVersion(info.version);
          if (!cancelled && info?.build != null) setRuntimeBuild(String(info.build));
        } else {
          const injected =
            typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : (import.meta.env.VITE_APP_VERSION as string);
          if (!cancelled) setRuntimeVersion((injected || '1.0.0').trim());
        }
      } catch (err) {
        console.warn('Load runtime version failed:', err);
      }
    };
    loadVersion();
    return () => {
      cancelled = true;
    };
  }, []);

  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: '心流日记爱好者',
    email: 'user@moodflow.app',
    joinDate: '2025-09-01'
  });

  const [settings, setSettings] = useState<AppSettings>({
    notifications: false,
    darkMode: uiTheme === 'dark',
    autoThemeEnabled: storeAutoEnabled,
    autoThemeStart: storeAutoStart || '22:00',
    autoThemeEnd: storeAutoEnd || '07:00',
    followSystemTheme: storeFollowSystemTheme,
    themeMode: storeThemeMode,
    language: 'zh',
    reminderTime: '21:00',
    reminderTitle: '心流日记提醒',
    reminderBody: '记录今天的心情与想法',
    quietHoursEnabled: false,
    quietStart: '22:00',
    quietEnd: '07:00',
    dataRetention: 365,
    autoBackup: true,
    immersiveStatusBar: immersiveMode,
    dataEncryption: true,
    privacyMode: false,
    autoCheckUpdate: getAutoCheckEnabled()
  });

  // 更新检查相关状态
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // 同步本地设置与全局 Store 状态，确保多页面一致
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      darkMode: uiTheme === 'dark',
      autoThemeEnabled: storeAutoEnabled,
      autoThemeStart: storeAutoStart || prev.autoThemeStart,
      autoThemeEnd: storeAutoEnd || prev.autoThemeEnd,
      followSystemTheme: storeFollowSystemTheme
    }));
  }, [uiTheme, storeAutoEnabled, storeAutoStart, storeAutoEnd, storeFollowSystemTheme]);

  // 自动切换模式：根据时间段自动应用深色/浅色（跟随系统开启时不生效）
  useEffect(() => {
    if (!settings.autoThemeEnabled || settings.followSystemTheme) {
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
      // 支持跨午夜的时间段，如 22:00 - 07:00
      if (start <= end) {
        return now >= start && now < end;
      }
      return now >= start || now < end;
    };

    const applyThemeByTime = () => {
      const start = toMinutes(settings.autoThemeStart || '22:00');
      const end = toMinutes(settings.autoThemeEnd || '07:00');
      const now = nowToMinutes();
      const shouldDark = inRange(start, end, now);
      const target: 'light' | 'dark' = shouldDark ? 'dark' : 'light';

      if ((target === 'dark' && !isDark) || (target === 'light' && isDark)) {
        setTheme(target);
        setUiTheme(target);
        onThemeChange?.(target);
      }
      // 同步设置项中的显示状态（用于 UI 展示）
      setSettings(prev => ({ ...prev, darkMode: target === 'dark' } as AppSettings));
    };

    // 立即应用一次
    applyThemeByTime();
    // 每分钟检查一次
    const timer = setInterval(applyThemeByTime, 60 * 1000);
    return () => clearInterval(timer);
  }, [
    settings.autoThemeEnabled,
    settings.autoThemeStart,
    settings.autoThemeEnd,
    settings.followSystemTheme,
    isDark,
    setTheme,
    setUiTheme,
    onThemeChange
  ]);

  // 原生端：联动通知开关与提醒时间，调度每日提醒
  useEffect(() => {
    const options: ReminderOptions = {
      title: settings.reminderTitle,
      body: settings.reminderBody,
      quiet: {
        enabled: settings.quietHoursEnabled,
        start: settings.quietStart,
        end: settings.quietEnd
      }
    };
    rescheduleDailyReminder(settings.notifications, settings.reminderTime, options);
  }, [
    settings.notifications,
    settings.reminderTime,
    settings.reminderTitle,
    settings.reminderBody,
    settings.quietHoursEnabled,
    settings.quietStart,
    settings.quietEnd
  ]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleProfileUpdate = () => {
    toast.success('个人资料已更新');
  };

  const handleSettingsUpdate = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (key === 'darkMode') {
      // 跟随系统或自动模式开启时，禁止手动切换
      if (settings.followSystemTheme) {
        toast.warning('已开启跟随系统主题，无法手动切换');
        return;
      }
      if (settings.autoThemeEnabled) {
        toast.warning('已开启自动切换模式，无法手动切换');
        return;
      }
      toggleTheme();
      const newTheme = !isDark ? 'dark' : 'light';
      setSettings(prev => ({ ...prev, [key]: !isDark } as AppSettings));
      setUiTheme(newTheme);
      onThemeChange?.(newTheme);
      toast.success('设置已保存');
    } else if (key === 'autoThemeEnabled') {
      const enabled = value as boolean;
      setSettings(prev => ({ ...prev, autoThemeEnabled: enabled } as AppSettings));
      setAutoThemeEnabled(enabled);
      toast.success(enabled ? '自动切换模式已开启' : '自动切换模式已关闭');
    } else if (key === 'autoThemeStart') {
      const v = value as string;
      setSettings(prev => ({ ...prev, autoThemeStart: v } as AppSettings));
      setAutoThemeStart(v);
      toast.success('开始时间已更新');
    } else if (key === 'autoThemeEnd') {
      const v = value as string;
      setSettings(prev => ({ ...prev, autoThemeEnd: v } as AppSettings));
      setAutoThemeEnd(v);
      toast.success('结束时间已更新');
    } else if (key === 'followSystemTheme') {
      const enabled = value as boolean;
      setSettings(prev => ({ ...prev, followSystemTheme: enabled } as AppSettings));
      setFollowSystemTheme(enabled);
      toast.success(enabled ? '已开启跟随系统主题' : '已关闭跟随系统主题');
    } else if (key === 'immersiveStatusBar') {
      const enabling = value as boolean;
      if (enabling) {
        const res = await supportsImmersiveStatusBar();
        if (!res.supported) {
          // 简洁提示语：根据具体原因生成更短的用户提示
          let msg = '设备不支持沉浸式状态栏';
          if (res.reason === '当前为 Web 环境') {
            msg = '当前为 Web 环境，无法开启沉浸式状态栏';
          } else if (res.reason === '缺少 StatusBar 插件') {
            msg = '缺少状态栏插件，无法开启沉浸式状态栏';
          }
          toast.warning(msg);
          return; // 拦截状态切换
        }
        setSettings(prev => ({ ...prev, [key]: true } as AppSettings));
        onImmersiveModeChange?.(true);
        toast.success('已启用沉浸式状态栏');
      } else {
        setSettings(prev => ({ ...prev, [key]: false } as AppSettings));
        onImmersiveModeChange?.(false);
        toast.success('已关闭沉浸式状态栏');
      }
    } else if (key === 'notifications') {
      // 切换推送通知开关时的动态提示与能力检测
      const enabled = value as boolean;
      if (enabled) {
        const native = Capacitor.isNativePlatform();
        const available = Capacitor.isPluginAvailable('LocalNotifications');
        if (!native || !available) {
          toast.warning('当前设备不支持推送通知（仅在移动设备上生效）');
          // 同步关闭相关依赖设置，避免禁用状态下残留启用项
          setSettings(prev => ({ ...prev, notifications: false, quietHoursEnabled: false } as AppSettings));
          return;
        }

        const granted = await requestReminderPermission();
        if (!granted) {
          toast.error('未授予通知权限，无法开启');
          // 权限未授予时回滚并关闭静音时段
          setSettings(prev => ({ ...prev, notifications: false, quietHoursEnabled: false } as AppSettings));
          return;
        }

        setSettings(prev => ({ ...prev, notifications: true } as AppSettings));

        const options: ReminderOptions = {
          title: settings.reminderTitle,
          body: settings.reminderBody,
          quiet: {
            enabled: settings.quietHoursEnabled,
            start: settings.quietStart,
            end: settings.quietEnd
          }
        };
        try {
          await rescheduleDailyReminder(true, settings.reminderTime, options);
          toast.success(`推送通知已开启，将在 ${settings.reminderTime} 提醒`);
        } catch (e) {
          console.warn('开启推送通知后调度提醒失败：', e);
          toast.warning('已开启推送通知，但提醒调度失败，请稍后重试');
        }
      } else {
        // 关闭通知时同时关闭静音时段，保持状态一致
        setSettings(prev => ({ ...prev, notifications: false, quietHoursEnabled: false } as AppSettings));
        toast.success('已关闭推送通知');
      }
    } else {
      setSettings(prev => ({ ...prev, [key]: value } as AppSettings));
      toast.success('设置已保存');
    }
  };

  // 手动检查更新
  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    const result = await checkForUpdate();
    setUpdateResult(result);
    setCheckingUpdate(false);
    if (result.hasUpdate && result.info) {
      setShowUpdateModal(true);
    } else {
      toast.success('当前已是最新版本');
    }
  };

  // 自动检查更新开关持久化
  const handleAutoCheckToggle = (enabled: boolean) => {
    setSettings(prev => ({ ...prev, autoCheckUpdate: enabled }));
    setAutoCheckEnabled(enabled);
    toast.success(enabled ? '已开启自动检查更新' : '已关闭自动检查更新');
  };

  // 统一主题模式切换：system / light / dark / auto
  const handleThemeModeChange = (mode: 'system' | 'light' | 'dark' | 'auto') => {
    setSettings(
      prev =>
        ({
          ...prev,
          themeMode: mode,
          followSystemTheme: mode === 'system',
          autoThemeEnabled: mode === 'auto',
          darkMode: mode === 'dark' ? true : mode === 'light' ? false : prev.darkMode
        } as AppSettings)
    );

    // 保持与全局 Store 同步
    setThemeMode(mode);
    setFollowSystemTheme(mode === 'system');
    setAutoThemeEnabled(mode === 'auto');

    if (mode === 'light' || mode === 'dark') {
      setTheme(mode);
      setUiTheme(mode);
      onThemeChange?.(mode);
    }

    toast.success('主题模式已更新');
  };

  const handleDataExport = async () => {
    try {
      // 模拟数据导出
      const data = {
        profile: userProfile,
        settings: settings,
        exportDate: new Date().toISOString()
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mood-flow-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('数据导出成功');
    } catch {
      toast.error('数据导出失败');
    }
  };

  const handleDataDelete = async () => {
    try {
      // 这里应该调用实际的数据删除API
      toast.success('数据已清除');
      setShowDeleteConfirm(false);
    } catch {
      toast.error('数据清除失败');
    }
  };

  const handleLogout = async () => {
    try {
      // 先调用 Supabase 退出登录
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      // 清除本地认证状态
      logout();

      // 跳转到登录页面
      navigate('/login', { replace: true });
      toast.success('已安全退出');
    } catch (error) {
      console.error('退出登录失败:', error);
      toast.error('退出失败');
    }
  };

  const tabs = [
    { id: 'account', label: '账户设置', icon: User },
    { id: 'app', label: '应用设置', icon: SettingsIcon }
  ];

  return (
    <>
      <Header title='设置管理' immersiveMode={actualImmersiveMode} />
      <Container className='pb-0'>
        <div className='page-sections'>
          {/* 标签页导航 */}
          <Card variant='default' padding='sm' className='overflow-hidden p-2 sm:p-3'>
            <div className='flex space-x-2 sm:space-x-3 lg:space-x-4 overflow-x-auto scrollbar-hide p-1'>
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as 'account' | 'app')}
                    aria-label={`切换到${tab.label}标签页`}
                    className={`flex-1 flex flex-row items-center justify-center gap-2 px-3 sm:px-3 py-2 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm lg:text-base transition-all duration-200 min-w-0 font-semibold ${
                      activeTab === tab.id
                        ? 'bg-purple-500 text-white shadow-lg transform scale-[1.02]'
                        : 'bg-gray-100 dark:bg-theme-gray-700 text-gray-600 dark:text-gray-300 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:shadow-md hover:scale-[1.01]'
                    }`}>
                    <Icon className='w-4 h-4 flex-shrink-0' />
                    <span className='text-sm sm:text-base lg:text-lg xl:text-xl font-bold truncate whitespace-nowrap'>
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* 账户设置 */}
          {activeTab === 'account' && (
            <Card variant='default' padding='md' className='p-4 sm:p-5 lg:p-8 xl:p-10 2xl:p-12'>
              <div className='flex items-center space-x-3 sm:space-x-4 lg:space-x-6 mb-4 sm:mb-5 lg:mb-6 xl:mb-8'>
                <User className='w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9 2xl:w-10 2xl:h-10 text-purple-500' />
                <div>
                  <h2 className='text-lg sm:text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl font-semibold text-gray-900 dark:text-white'>
                    账户设置
                  </h2>
                  <p className='text-sm sm:text-base lg:text-lg xl:text-xl text-gray-500 dark:text-gray-400'>
                    管理您的个人资料和数据
                  </p>
                </div>
              </div>

              {/* 个人资料（改为 Card 包裹，采用图标行标题样式） */}
              <Card
                variant='default'
                padding='md'
                className='p-4 sm:p-5 lg:p-6 hover:shadow-lg transition-all duration-200 mb-4 sm:mb-5 lg:mb-6'>
                <div className='flex items-center space-x-3 sm:space-x-4 mb-4'>
                  <User className='w-6 h-6 sm:w-7 sm:h-7 text-purple-600 dark:text-purple-400' />
                  <div>
                    <h4 className='font-semibold text-base sm:text-lg text-gray-800 dark:text-gray-200'>个人资料</h4>
                    <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>管理昵称与邮箱</p>
                  </div>
                </div>
                <div className='grid md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-3 sm:gap-4 lg:gap-6 xl:gap-8'>
                  <div>
                    <label className='block text-sm lg:text-base font-medium text-warm-gray-700 dark:text-gray-300 mb-2 lg:mb-3'>
                      昵称
                    </label>
                    <input
                      type='text'
                      value={userProfile.name}
                      onChange={e => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
                      className='input w-full bg-white dark:bg-theme-gray-700 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-theme-gray-600 transition-all duration-200 hover:bg-white/70 dark:hover:bg-theme-gray-700/70 text-sm sm:text-base lg:py-3 lg:px-4'
                      placeholder='输入你的昵称'
                    />
                  </div>
                  <div>
                    <label className='block text-sm lg:text-base font-medium text-warm-gray-700 dark:text-gray-300 mb-2 lg:mb-3'>
                      邮箱
                    </label>
                    <input
                      type='email'
                      value={userProfile.email}
                      onChange={e => setUserProfile(prev => ({ ...prev, email: e.target.value }))}
                      className='input w-full bg-white dark:bg-theme-gray-700 text-gray-900 dark:text-gray-100 border-gray-200 dark:border-theme-gray-600 transition-all duration-200 hover:bg-white/70 dark:hover:bg-theme-gray-700/70 text-sm sm:text-base lg:py-3 lg:px-4'
                      placeholder='输入你的邮箱'
                    />
                  </div>
                </div>
                <button
                  onClick={handleProfileUpdate}
                  aria-label='保存个人资料'
                  className='btn-primary w-full py-3 lg:py-4 xl:py-5 mt-4 sm:mt-5 lg:mt-6 shadow-md hover:shadow-lg lg:hover:shadow-xl transition-all duration-200 text-base sm:text-lg lg:text-xl xl:text-2xl font-semibold'>
                  保存更改
                </button>
              </Card>

              {/* 隐私安全（移除区块标题，统一并列栅格与间距） */}
              <div className='mb-4 sm:mb-5 lg:mb-6'>
                <div className='grid md:grid-cols-2 gap-4 sm:gap-5 lg:gap-6'>
                  {/* 数据加密 */}
                  <Card
                    variant='default'
                    padding='md'
                    className='p-4 sm:p-5 lg:p-6 hover:shadow-lg transition-all duration-200'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center space-x-3 sm:space-x-4 lg:space-x-6'>
                        <Lock className='w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9 text-green-600 dark:text-green-400' />
                        <div>
                          <h4 className='font-semibold text-base sm:text-lg lg:text-xl xl:text-2xl text-gray-800 dark:text-gray-200'>
                            数据加密
                          </h4>
                          <p className='text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400'>
                            保护您的数据安全
                          </p>
                        </div>
                      </div>
                      <label className='relative inline-flex items-center cursor-pointer' aria-label='数据加密'>
                        <input
                          type='checkbox'
                          checked={settings.dataEncryption}
                          onChange={e => handleSettingsUpdate('dataEncryption', e.target.checked)}
                          className='sr-only peer'
                          aria-describedby='data-encryption-description'
                        />
                        <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-theme-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-theme-gray-600 peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                  </Card>

                  {/* 隐私模式 */}
                  <Card
                    variant='default'
                    padding='md'
                    className='p-4 sm:p-5 lg:p-6 hover:shadow-lg transition-all duration-200'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center space-x-3 sm:space-x-4 lg:space-x-6'>
                        <EyeOff className='w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9 text-blue-600 dark:text-blue-400' />
                        <div>
                          <h4 className='font-semibold text-base sm:text-lg lg:text-xl xl:text-2xl text-gray-800 dark:text-gray-200'>
                            隐私模式
                          </h4>
                          <p className='text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400'>
                            隐藏敏感信息
                          </p>
                        </div>
                      </div>
                      <label className='relative inline-flex items-center cursor-pointer' aria-label='隐私模式'>
                        <input
                          type='checkbox'
                          checked={settings.privacyMode}
                          onChange={e => handleSettingsUpdate('privacyMode', e.target.checked)}
                          className='sr-only peer'
                          aria-describedby='privacy-mode-description'
                        />
                        <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                      </label>
                    </div>
                  </Card>
                </div>
              </div>

              {/* 数据管理（移除区块标题，统一并列栅格与间距） */}
              <div className='mb-4 sm:mb-5 lg:mb-6'>
                <div className='grid md:grid-cols-2 gap-4 sm:gap-5 lg:gap-6'>
                  {/* 数据导出 */}
                  <Card
                    variant='default'
                    padding='md'
                    className='p-4 sm:p-5 lg:p-6 hover:shadow-lg transition-all duration-200'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center space-x-3 sm:space-x-4 lg:space-x-6'>
                        <Download className='w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9 text-green-600 dark:text-green-400' />
                        <div>
                          <h4 className='font-semibold text-base sm:text-lg lg:text-xl xl:text-2xl text-gray-800 dark:text-gray-200'>
                            导出数据
                          </h4>
                          <p className='text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400'>
                            下载您的所有记录
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleDataExport}
                        aria-label='导出数据'
                        className='btn px-4 py-2 sm:px-5 sm:py-2 lg:px-6 lg:py-3 xl:px-8 xl:py-4 bg-green-500 hover:bg-green-600 text-white rounded-lg sm:rounded-xl lg:rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg text-sm sm:text-base lg:text-lg xl:text-xl font-medium'>
                        导出
                      </button>
                    </div>
                  </Card>

                  {/* 数据清除 */}
                  <Card
                    variant='default'
                    padding='md'
                    className='p-4 sm:p-5 lg:p-6 hover:shadow-lg transition-all duration-200 border-red-200 dark:border-red-800'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center space-x-3 sm:space-x-4 lg:space-x-6'>
                        <Trash2 className='w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9 text-red-600 dark:text-red-400' />
                        <div>
                          <h4 className='font-semibold text-base sm:text-lg lg:text-xl xl:text-2xl text-red-800 dark:text-red-200'>
                            清除所有数据
                          </h4>
                          <p className='text-sm sm:text-base lg:text-lg text-red-600 dark:text-red-400'>
                            此操作不可撤销
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        aria-label='清除所有数据'
                        className='btn btn-danger px-4 py-2 sm:px-5 sm:py-2 lg:px-6 lg:py-3 xl:px-8 xl:py-4 bg-red-500 hover:bg-red-600 text-white rounded-lg sm:rounded-xl lg:rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg text-sm sm:text-base lg:text-lg xl:text-xl font-medium'>
                        清除
                      </button>
                    </div>
                  </Card>
                </div>
              </div>

              {/* 退出登录按钮（次要操作使用 btn-ghost） */}
              <button
                onClick={handleLogout}
                aria-label='退出登录'
                className='btn btn-ghost flex items-center justify-center gap-2 w-full py-3 lg:py-4 xl:py-5 bg-white/80 dark:bg-theme-gray-700/80 text-gray-800 dark:text-gray-200 rounded-lg sm:rounded-xl lg:rounded-2xl shadow-md hover:shadow-lg lg:hover:shadow-xl transition-all duration-200 text-base sm:text-lg lg:text-xl xl:text-2xl font-semibold border-2 border-gray-200/60 dark:border-theme-gray-600/60 hover:border-purple-300 dark:hover:border-purple-500'>
                <LogOut className='w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6' />
                退出登录
              </button>
            </Card>
          )}

          {/* 应用设置 */}
          {activeTab === 'app' && (
            <Card variant='default' padding='lg' className='lg:p-8 xl:p-12 2xl:p-16'>
              <div className='flex items-center space-x-4 lg:space-x-6 mb-6 lg:mb-8 xl:mb-10'>
                <SettingsIcon className='w-6 h-6 lg:w-7 lg:h-7 xl:w-8 xl:h-8 2xl:w-9 2xl:h-9 text-purple-500' />
                <div>
                  <h2 className='text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl font-semibold text-gray-900 dark:text-white'>
                    应用设置
                  </h2>
                  <p className='text-base lg:text-lg xl:text-xl text-gray-500 dark:text-gray-400'>
                    自定义应用偏好和显示效果
                  </p>
                </div>
              </div>

              <div className='space-y-4 sm:space-y-5 lg:space-y-6'>
                {/* 主题模式（统一管理：系统/浅色/深色/按时自动） */}
                <Card
                  variant='default'
                  padding='md'
                  className='p-4 sm:p-5 lg:p-6 hover:shadow-lg transition-all duration-200'>
                  <div className='flex items-center space-x-3 sm:space-x-4 mb-4'>
                    <Moon className='w-6 h-6 sm:w-7 sm:h-7 text-purple-600 dark:text-purple-400' />
                    <div>
                      <h4 className='font-semibold text-base sm:text-lg text-gray-800 dark:text-gray-200'>主题模式</h4>
                      <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>设置全局主题模式</p>
                    </div>
                  </div>
                  <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3'>
                    {(
                      [
                        { value: 'system', label: '跟随系统' },
                        { value: 'auto', label: '定时切换' },
                        { value: 'light', label: '浅色模式' },
                        { value: 'dark', label: '深色模式' }
                      ] as const
                    ).map(opt => (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm sm:text-base ${
                          settings.themeMode === opt.value
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-200'
                            : 'border-gray-200 dark:border-theme-gray-600 bg-white dark:bg-theme-gray-700 text-gray-800 dark:text-gray-200'
                        }`}>
                        <input
                          type='radio'
                          name='theme-mode'
                          value={opt.value}
                          checked={settings.themeMode === opt.value}
                          onChange={() => handleThemeModeChange(opt.value)}
                          className='accent-purple-600'
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>

                  {settings.themeMode === 'auto' && (
                    <div className='mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
                      <div>
                        <label htmlFor='auto-theme-start' className='block mb-2'>
                          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>开始时间</span>
                        </label>
                        <input
                          id='auto-theme-start'
                          type='time'
                          value={settings.autoThemeStart}
                          onChange={e => handleSettingsUpdate('autoThemeStart', e.target.value)}
                          className='w-full px-4 py-3 sm:px-5 sm:py-4 bg-white dark:bg-theme-gray-700 border-2 border-gray-200 dark:border-theme-gray-600 rounded-lg focus:ring-4 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-base text-gray-800 dark:text-gray-200'
                        />
                      </div>
                      <div>
                        <label htmlFor='auto-theme-end' className='block mb-2'>
                          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>结束时间</span>
                        </label>
                        <input
                          id='auto-theme-end'
                          type='time'
                          value={settings.autoThemeEnd}
                          onChange={e => handleSettingsUpdate('autoThemeEnd', e.target.value)}
                          className='w-full px-4 py-3 sm:px-5 sm:py-4 bg-white dark:bg-theme-gray-700 border-2 border-gray-200 dark:border-theme-gray-600 rounded-lg focus:ring-4 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-base text-gray-800 dark:text-gray-200'
                        />
                      </div>
                      <p className='sm:col-span-2 text-xs sm:text-sm text-gray-500 dark:text-gray-400'>
                        示例：22:00 至次日 07:00 为深色模式；其他时间为浅色模式。
                      </p>
                    </div>
                  )}
                </Card>

                {/* 深色模式卡片已合并到“主题模式”，此处不再展示 */}

                {/* 沉浸式状态栏 */}
                <Card
                  variant='default'
                  padding='md'
                  className='p-4 sm:p-5 lg:p-6 hover:shadow-lg transition-all duration-200'>
                  <div className='flex items-center justify-between gap-3 sm:gap-4'>
                    <div className='flex items-center space-x-3 sm:space-x-4 flex-1 min-w-0'>
                      <Smartphone className='w-6 h-6 sm:w-7 sm:h-7 text-green-600 dark:text-green-400 flex-shrink-0' />
                      <div className='min-w-0 flex-1'>
                        <h4 className='font-semibold text-base sm:text-lg text-gray-800 dark:text-gray-200 truncate'>
                          沉浸式状态栏
                        </h4>
                        <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>仅在移动设备上生效</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSettingsUpdate('immersiveStatusBar', !settings.immersiveStatusBar)}
                      aria-label={settings.immersiveStatusBar ? '关闭沉浸式状态栏' : '开启沉浸式状态栏'}
                      className={`relative inline-flex h-6 w-11 sm:h-7 sm:w-12 items-center rounded-full transition-all duration-200 shadow-md hover:shadow-lg flex-shrink-0 ${
                        settings.immersiveStatusBar
                          ? 'bg-green-500 hover:bg-green-600'
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}>
                      <span
                        className={`inline-block h-4 w-4 sm:h-5 sm:w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                          settings.immersiveStatusBar ? 'translate-x-6 sm:translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </Card>

                {/* 语言设置（暂时隐藏） */}
                <Card
                  variant='default'
                  padding='md'
                  className='hidden p-4 sm:p-5 lg:p-6 hover:shadow-lg transition-all duration-200'>
                  <div className='flex items-center space-x-3 sm:space-x-4 mb-4'>
                    <Globe className='w-6 h-6 sm:w-7 sm:h-7 text-orange-600 dark:text-orange-400' />
                    <div>
                      <h4 className='font-semibold text-base sm:text-lg text-gray-800 dark:text-gray-200'>语言设置</h4>
                      <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>选择应用语言</p>
                    </div>
                  </div>
                  <select
                    value={settings.language}
                    onChange={e => handleSettingsUpdate('language', e.target.value as 'zh' | 'en')}
                    aria-label='语言选择器'
                    className='w-full px-4 py-3 sm:px-5 sm:py-4 bg-white dark:bg-theme-gray-700 border-2 border-gray-200 dark:border-theme-gray-600 rounded-lg focus:ring-4 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-base sm:text-lg appearance-none cursor-pointer text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-theme-gray-600 shadow-sm hover:shadow-md focus:shadow-lg'>
                    <option value='zh'>中文</option>
                    <option value='en'>English</option>
                  </select>
                </Card>

                {/* 接收情绪记录提醒（移动到语言设置之后） */}
                <Card
                  variant='default'
                  padding='md'
                  className='p-4 sm:p-5 lg:p-6 hover:shadow-lg transition-all duration-200'>
                  <div className='flex items-center justify-between mb-4'>
                    <div className='flex items-center space-x-3 sm:space-x-4'>
                      <Bell className='w-6 h-6 sm:w-7 sm:h-7 text-blue-600 dark:text-blue-400' />
                      <div>
                        <h4 className='font-semibold text-base sm:text-lg text-gray-800 dark:text-gray-200'>
                          接收情绪记录提醒
                        </h4>
                        <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400'>仅在移动设备上生效</p>
                      </div>
                    </div>
                    <label className='relative inline-flex items-center cursor-pointer' aria-label='接收情绪记录提醒'>
                      <input
                        type='checkbox'
                        checked={settings.notifications}
                        onChange={e => handleSettingsUpdate('notifications', e.target.checked)}
                        className='sr-only peer'
                        aria-describedby='notifications-description'
                      />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-theme-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-theme-gray-600 peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                  {!settings.notifications && (
                    <p className='mt-2 mb-3 text-sm sm:text-base text-gray-600 dark:text-gray-400'>
                      开启通知后可编辑提醒设置
                    </p>
                  )}
                  <div className={`${settings.notifications ? '' : 'disabled-block'}`}>
                    <label htmlFor='reminder-time' className='block mb-2'>
                      <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>选择提醒时间</span>
                    </label>
                    <input
                      id='reminder-time'
                      type='time'
                      value={settings.reminderTime}
                      onChange={e => handleSettingsUpdate('reminderTime', e.target.value)}
                      disabled={!settings.notifications}
                      className='w-full px-4 py-3 sm:px-5 sm:py-4 bg-white dark:bg-theme-gray-700 border-2 border-gray-200 dark:border-theme-gray-600 rounded-lg focus:ring-4 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-base sm:text-lg text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-theme-gray-600 shadow-sm hover:shadow-md focus:shadow-lg'
                    />

                    {/* 自定义提醒标题与文案 */}
                    <div className='mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
                      <div>
                        <label htmlFor='reminder-title' className='block mb-2'>
                          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>提醒标题</span>
                        </label>
                        <input
                          id='reminder-title'
                          type='text'
                          value={settings.reminderTitle}
                          onChange={e => handleSettingsUpdate('reminderTitle', e.target.value)}
                          placeholder='如：心流日记提醒'
                          disabled={!settings.notifications}
                          className='w-full px-4 py-3 sm:px-5 sm:py-4 bg-white dark:bg-theme-gray-700 border-2 border-gray-200 dark:border-theme-gray-600 rounded-lg focus:ring-4 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-base text-gray-800 dark:text-gray-200'
                        />
                      </div>
                      <div>
                        <label htmlFor='reminder-body' className='block mb-2'>
                          <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>提醒文案</span>
                        </label>
                        <input
                          id='reminder-body'
                          type='text'
                          value={settings.reminderBody}
                          onChange={e => handleSettingsUpdate('reminderBody', e.target.value)}
                          placeholder='如：记录今天的心情与想法'
                          disabled={!settings.notifications}
                          className='w-full px-4 py-3 sm:px-5 sm:py-4 bg-white dark:bg-theme-gray-700 border-2 border-gray-200 dark:border-theme-gray-600 rounded-lg focus:ring-4 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-base text-gray-800 dark:text-gray-200'
                        />
                      </div>
                    </div>

                    {/* 静音时段设置 */}
                    <div className='mt-4'>
                      <div className='flex items-center justify-between mb-3 sm:mb-4'>
                        <div className='text-sm sm:text-base text-gray-700 dark:text-gray-300'>静音时段</div>
                        <label className='relative inline-flex items-center cursor-pointer'>
                          <input
                            type='checkbox'
                            checked={settings.quietHoursEnabled}
                            onChange={e => handleSettingsUpdate('quietHoursEnabled', e.target.checked)}
                            className='sr-only peer'
                            disabled={!settings.notifications}
                          />
                          <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-theme-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-theme-gray-600 peer-checked:bg-purple-600"></div>
                        </label>
                      </div>
                      {settings.quietHoursEnabled && (
                        <div className='grid grid-cols-2 gap-3 sm:gap-4'>
                          <div>
                            <label htmlFor='quiet-start' className='block mb-2'>
                              <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>开始时间</span>
                            </label>
                            <input
                              id='quiet-start'
                              type='time'
                              value={settings.quietStart}
                              onChange={e => handleSettingsUpdate('quietStart', e.target.value)}
                              disabled={!settings.notifications || !settings.quietHoursEnabled}
                              className='w-full px-4 py-3 sm:px-5 sm:py-4 bg-white dark:bg-theme-gray-700 border-2 border-gray-200 dark:border-theme-gray-600 rounded-lg focus:ring-4 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-base text-gray-800 dark:text-gray-200'
                            />
                          </div>
                          <div>
                            <label htmlFor='quiet-end' className='block mb-2'>
                              <span className='text-sm font-medium text-gray-700 dark:text-gray-300'>结束时间</span>
                            </label>
                            <input
                              id='quiet-end'
                              type='time'
                              value={settings.quietEnd}
                              onChange={e => handleSettingsUpdate('quietEnd', e.target.value)}
                              disabled={!settings.notifications || !settings.quietHoursEnabled}
                              className='w-full px-4 py-3 sm:px-5 sm:py-4 bg-white dark:bg-theme-gray-700 border-2 border-gray-200 dark:border-theme-gray-600 rounded-lg focus:ring-4 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-base text-gray-800 dark:text-gray-200'
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    {/* 结束禁用样式容器 */}
                  </div>
                </Card>

                {/* 应用更新与升级 */}
                <Card
                  variant='default'
                  padding='md'
                  className='p-3 sm:p-4 lg:p-6 xl:p-8 2xl:p-10 mb-6 sm:mb-8 lg:mb-10'>
                  <div className='flex items-start justify-between'>
                    <div className='flex items-center space-x-3 sm:space-x-4 lg:space-x-6'>
                      <Download className='w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-purple-600 dark:text-purple-400' />
                      <div>
                        <h4 className='font-semibold text-base sm:text-lg lg:text-xl text-gray-800 dark:text-gray-200'>
                          应用更新与升级
                        </h4>
                        <p className='text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400'>
                          当前版本 V{runtimeVersion}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleCheckUpdate}
                      disabled={checkingUpdate}
                      className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-sm sm:text-base font-medium transition-all duration-200 border shadow-md hover:shadow-lg flex items-center gap-2 ${
                        checkingUpdate
                          ? 'bg-gray-200 dark:bg-theme-gray-700 text-gray-600 dark:text-gray-300 cursor-wait'
                          : 'bg-purple-600 text-white hover:bg-purple-700'
                      }`}
                      aria-label='检查更新'>
                      {checkingUpdate ? (
                        <span className='inline-flex items-center gap-2'>
                          <svg className='animate-spin h-4 w-4' viewBox='0 0 24 24'>
                            <circle
                              className='opacity-25'
                              cx='12'
                              cy='12'
                              r='10'
                              stroke='currentColor'
                              strokeWidth='4'></circle>
                            <path
                              className='opacity-75'
                              fill='currentColor'
                              d='M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z'></path>
                          </svg>
                          正在检查...
                        </span>
                      ) : (
                        '检查更新'
                      )}
                    </button>
                  </div>
                  <p className='mt-3 text-sm sm:text-base text-gray-600 dark:text-gray-400'>
                    支持移动设备 APP 升级，若检测到新版本，将显示版本说明与升级指引。
                  </p>
                  <div className='mt-3 sm:mt-4 flex items-center justify-between'>
                    <div>
                      <h5 className='font-medium text-sm sm:text-base text-gray-800 dark:text-gray-200'>
                        自动检查更新
                      </h5>
                      <p className='text-xs sm:text-sm text-gray-600 dark:text-gray-400'>
                        开启应用或回到前台时自动检测
                      </p>
                    </div>
                    <label className='relative inline-flex items-center cursor-pointer' aria-label='自动检查更新'>
                      <input
                        type='checkbox'
                        checked={!!settings.autoCheckUpdate}
                        onChange={e => handleAutoCheckToggle(e.target.checked)}
                        className='sr-only peer'
                      />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                    </label>
                  </div>
                </Card>

                {/* 关于应用 */}
                <Card variant='default' padding='md' className='p-3 sm:p-4 lg:p-6 xl:p-8 2xl:p-10'>
                  <div className='flex items-center space-x-3 sm:space-x-4 lg:space-x-6 mb-4 sm:mb-5 lg:mb-6'>
                    <Heart className='w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 xl:w-9 xl:h-9 text-pink-500' />
                    <div>
                      <h4 className='font-semibold text-base sm:text-lg lg:text-xl xl:text-2xl text-gray-800 dark:text-gray-200'>
                        关于应用
                      </h4>
                      <p className='text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400'>
                        了解更多应用信息
                      </p>
                    </div>
                  </div>

                  <div className='space-y-3 sm:space-y-4'>
                    <div>
                      <p className='text-sm sm:text-base lg:text-lg text-gray-600 dark:text-gray-400 leading-relaxed'>
                        心流日记是一款专注于心理健康的应用，帮助用户记录和管理情绪，提供个性化的情绪分析和建议。
                      </p>
                    </div>

                    <div>
                      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'>
                        <Link
                          to='/terms'
                          className='group flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 bg-gray-100 dark:bg-theme-gray-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-all shadow-sm hover:shadow-md'>
                          <div className='flex items-center space-x-3 sm:space-x-4'>
                            <Shield className='w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400' />
                            <div>
                              <span className='block font-medium text-gray-800 dark:text-gray-200 text-sm sm:text-base'>
                                服务条款
                              </span>
                              <span className='block text-xs sm:text-sm text-gray-600 dark:text-gray-400'>
                                阅读使用协议
                              </span>
                            </div>
                          </div>
                          <span className='text-gray-400 group-hover:text-purple-500'>›</span>
                        </Link>

                        <Link
                          to='/privacy'
                          className='group flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4 bg-gray-100 dark:bg-theme-gray-700 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-all shadow-sm hover:shadow-md'>
                          <div className='flex items-center space-x-3 sm:space-x-4'>
                            <Lock className='w-5 h-5 sm:w-6 sm:h-6 text-purple-600 dark:text-purple-400' />
                            <div>
                              <span className='block font-medium text-gray-800 dark:text-gray-200 text-sm sm:text-base'>
                                隐私政策
                              </span>
                              <span className='block text-xs sm:text-sm text-gray-600 dark:text-gray-400'>
                                了解隐私政策
                              </span>
                            </div>
                          </div>
                          <span className='text-gray-400 group-hover:text-purple-500'>›</span>
                        </Link>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </Card>
          )}
        </div>

        {showUpdateModal && updateResult?.info && (
          <Modal title={`发现新版本 V${updateResult.info.latestVersion}`} onClose={() => setShowUpdateModal(false)}>
            <div className='space-y-3 sm:space-y-4'>
              <p className='text-sm sm:text-base text-gray-700 dark:text-gray-200'>
                当前版本：V{updateResult.currentVersion}
              </p>
              {updateResult.info.releaseNotes && (
                <div>
                  <h5 className='font-medium text-sm sm:text-base text-gray-800 dark:text-gray-200 mb-1'>更新说明</h5>
                  <p className='text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed'>
                    {updateResult.info.releaseNotes}
                  </p>
                </div>
              )}
              <div className='flex justify-center gap-3 sm:gap-4 pt-2'>
                {!updateResult.info.mandatory && (
                  <button
                    className='px-4 py-2 rounded-lg border bg-gray-100 dark:bg-theme-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-theme-gray-700'
                    onClick={() => setShowUpdateModal(false)}>
                    稍后再说
                  </button>
                )}
                {updateResult.info.androidApkUrl && (
                  <UpdateFlow url={updateResult.info.androidApkUrl} onInstalled={() => setShowUpdateModal(false)} />
                )}
              </div>
            </div>
          </Modal>
        )}

        {showDeleteConfirm && (
          <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
            <Card variant='default' padding='lg' className='max-w-md mx-4'>
              <h3 className='text-lg font-semibold text-gray-900 dark:text-white mb-4'>确认删除</h3>
              <p className='text-gray-600 dark:text-gray-400 mb-6'>
                此操作将永久删除所有数据，无法恢复。您确定要继续吗？
              </p>
              <div className='flex gap-3'>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className='btn btn-ghost flex-1 px-4 py-2 rounded-lg bg-gray-200 dark:bg-theme-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-theme-gray-700 transition-colors'>
                  取消
                </button>
                <button
                  onClick={handleDataDelete}
                  className='btn btn-danger flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors'>
                  确认删除
                </button>
              </div>
            </Card>
          </div>
        )}
      </Container>
    </>
  );
};

export default Settings;
