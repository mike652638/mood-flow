import React from 'react'
import { cn } from '../utils/cn'

interface ContainerProps {
  children: React.ReactNode
  className?: string
  spacing?: 'tight' | 'normal' | 'loose'
  maxWidth?: 'sm' | 'md' | 'lg' | 'full'
  preset?: 'basic' | 'wide' | 'content'
}

const Container: React.FC<ContainerProps> = ({ 
  children, 
  className,
  spacing = 'normal',
  maxWidth = 'full',
  preset = 'wide'
}) => {
  // 响应式间距映射（覆盖到 2xl）
  const spacingStyles: Record<NonNullable<ContainerProps['spacing']>, string> = {
    tight: 'space-y-2 sm:space-y-3 md:space-y-4 lg:space-y-5 xl:space-y-6 2xl:space-y-8',
    normal: 'space-y-3 sm:space-y-4 md:space-y-6 lg:space-y-8 xl:space-y-10 2xl:space-y-12',
    loose: 'space-y-4 sm:space-y-6 md:space-y-8 lg:space-y-10 xl:space-y-12 2xl:space-y-16'
  }
  
  // 仅 basic 预设时使用的简单 max-w 尺寸
  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    full: 'max-w-full'
  }

  // 预设宽度：统一站点常用布局宽度
  const presetWidth = {
    wide: 'max-w-full sm:max-w-2xl lg:max-w-6xl xl:max-w-7xl 2xl:max-w-[1400px]',
    content: 'max-w-full sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl',
    basic: '' // 由 maxWidthStyles 控制
  } as const

  const widthClasses = preset === 'basic' ? maxWidthStyles[maxWidth] : presetWidth[preset]
  
  return (
    <div className={cn(
      // 水平内边距与居中
      'container-base mx-auto px-3 sm:px-4 md:px-6 lg:px-8',
      widthClasses,
      spacingStyles[spacing],
      'pb-safe-area-inset-bottom',
      className
    )}>
      {children}
    </div>
  )
}

export default Container