import React from 'react';
import { cn } from '../utils/cn';

type ButtonVariant = 'primary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600',
  ghost:
    'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 focus:ring-2 focus:ring-gray-300 dark:focus:ring-gray-600',
  danger:
    'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white focus:ring-2 focus:ring-red-300 dark:focus:ring-red-600'
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm rounded-lg',
  md: 'h-10 px-4 text-sm sm:text-base rounded-xl',
  lg: 'h-12 px-5 text-base sm:text-lg rounded-2xl'
};

const Button: React.FC<ButtonProps> = ({ variant = 'primary', size = 'md', className, children, ...rest }) => {
  return (
    <button
      type='button'
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors duration-200 focus:outline-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...rest}>
      {children}
    </button>
  );
};

export default Button;