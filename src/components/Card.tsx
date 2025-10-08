import React from 'react';
import { cn } from '../utils/cn';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'gradient' | 'glass' | 'elevated';
  padding?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className, variant = 'default', padding = 'md', onClick, ...rest }) => {
  // 增加 card 类以应用全局晕影与 backdrop-filter 样式
  const baseStyles = 'card rounded-2xl transition-all duration-300 ease-out';

  const variantStyles = {
    default:
      // 提升深色模式对比度：使用更亮的背景色和更清晰的边框
      'bg-white dark:bg-theme-gray-750 border border-gray-200/60 dark:border-theme-gray-600/80 shadow-xl',
    gradient:
      'bg-gradient-to-br from-white/95 to-purple-50/90 dark:from-theme-gray-750/95 dark:to-purple-900/30 border border-white/20 dark:border-theme-gray-600/40 shadow-xl backdrop-blur-xl',
    glass:
      'bg-white/80 dark:bg-theme-gray-750/90 border border-white/30 dark:border-theme-gray-600/50 shadow-2xl backdrop-blur-2xl',
    elevated:
      'bg-white dark:bg-theme-gray-750 border border-gray-200/50 dark:border-theme-gray-600/60 shadow-2xl shadow-purple-500/10 dark:shadow-purple-400/5'
  };

  const paddingStyles = {
    sm: 'p-3 sm:p-4',
    md: 'p-4 sm:p-6',
    lg: 'p-6 sm:p-8'
  };

  const hoverStyles = onClick
    ? 'cursor-pointer hover:scale-[1.02] hover:shadow-2xl hover:shadow-purple-500/20 dark:hover:shadow-purple-400/10'
    : '';

  return (
    <div
      className={cn(baseStyles, variantStyles[variant], paddingStyles[padding], hoverStyles, className)}
      onClick={onClick}
      {...rest}>
      {children}
    </div>
  );
};

export default Card;
