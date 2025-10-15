import { ArrowLeft, HeartHandshake, Home, PenTool, BarChart3, Settings } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Container from './Container';
import { isNative } from '../utils/capacitor';

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  onBack?: () => void;
  className?: string;
  immersiveMode?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Header = ({
  title,
  showBackButton = false,
  onBack,
  className = '',
  immersiveMode = false,
  leftIcon,
  rightIcon
}: HeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const nativeImmersive = immersiveMode && isNative();

  const navItems = [
    { path: '/home', label: '首页', icon: <Home className='w-4 h-4' /> },
    { path: '/record', label: '记录', icon: <PenTool className='w-4 h-4' /> },
    { path: '/mentor', label: 'AI 伴侣', icon: <HeartHandshake className='w-4 h-4' /> },
    { path: '/analytics', label: '分析', icon: <BarChart3 className='w-4 h-4' /> },
    { path: '/settings', label: '设置管理', icon: <Settings className='w-4 h-4' /> }
  ];

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b border-white/20 dark:border-theme-gray-700/30 shadow-lg transition-all duration-300 ${
        nativeImmersive ? 'pt-safe-area-top-fallback' : 'pt-0'
      } ${isNative() ? 'safe-area-header' : ''} header-gradient ${className}`}>
      <Container preset='wide' spacing='tight' className={`py-2`}>
        <div className='flex items-center justify-between'>
          {/* 左侧：返回按钮或自定义图标或占位 */}
          <div className='w-10 h-10 flex items-center justify-center flex-shrink-0'>
            {leftIcon ||
              (showBackButton && (
                <button
                  onClick={handleBack}
                  className='p-2 rounded-xl bg-white/80 dark:bg-theme-gray-700/80 hover:bg-white dark:hover:bg-theme-gray-600 text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 transition-all duration-200 hover:scale-110 active:scale-95 shadow-sm hover:shadow-md'
                  aria-label='返回'>
                  <ArrowLeft size={20} />
                </button>
              ))}
          </div>

          {/* 中间：页面标题 - 添加异形屏适配 */}
          <div className={`flex-1 text-center ${isNative() ? 'notch-safe-title' : ''}`}>
            <h1
              className={`text-base sm:text-lg leading-6 sm:leading-7 font-bold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent truncate ${
                nativeImmersive ? 'max-w-[60%] mx-auto' : ''
              }`}>
              {title}
            </h1>
          </div>

          {/* 右侧：桌面端导航（lg+）与移动端占位或自定义图标 */}
          <div className='hidden lg:flex items-center space-x-1'>
            {navItems.map(({ path, label, icon }) => {
              // 当访问根路径 '/' 时，首页按钮也应该显示为激活状态
              const isActive = location.pathname === path || (path === '/home' && location.pathname === '/');
              return (
                <Link
                  key={path}
                  to={path}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-700 dark:text-purple-300 border-purple-300/50 dark:border-purple-600/50 shadow-sm'
                      : 'text-gray-600 dark:text-gray-300 border-transparent hover:text-purple-600 dark:hover:text-purple-300 hover:bg-white/70 dark:hover:bg-theme-gray-700/50 hover:border-white/40'
                  }`}>
                  <span className='inline-flex items-center gap-1.5'>
                    {icon}
                    <span>{label}</span>
                  </span>
                </Link>
              );
            })}
            {/* 桌面端显示右侧自定义按钮（如新建会话） */}
            <div className='ml-2'>{rightIcon}</div>
          </div>
          <div className='w-10 h-10 lg:hidden flex items-center justify-center'>{rightIcon}</div>
        </div>
      </Container>
    </header>
  );
};

export default Header;
