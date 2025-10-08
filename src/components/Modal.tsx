import React from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, footer, children, className }) => {
  return (
    <div className='modal fixed inset-0 z-[var(--modal-z-index)] flex items-center justify-center p-4'>
      <div className='absolute inset-0 bg-black/40 dark:bg-black/50 backdrop-blur-sm' onClick={onClose} />
      <div
        className={`modal-panel relative z-10 w-full max-w-2xl mx-4 sm:mx-auto bg-white/95 dark:bg-theme-gray-900/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 dark:border-theme-gray-700/50 flex flex-col max-h-[80dvh] sm:max-h-[70vh] ${
          className || ''
        }`}>
        {/* 固定标题栏 */}
        <div className='flex-shrink-0 px-6 sm:px-8 py-4 border-b border-white/30 dark:border-theme-gray-700/60 bg-white/90 dark:bg-theme-gray-900/90 rounded-t-3xl'>
          <div className='relative'>
            <h3 className='text-lg sm:text-xl font-bold text-center text-gray-900 dark:text-white pr-10'>{title}</h3>
            <button
              onClick={onClose}
              aria-label='关闭'
              className='absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-100 dark:bg-theme-gray-800 hover:bg-gray-200 dark:hover:bg-theme-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 active:scale-95'>
              ✕
            </button>
          </div>
        </div>

        {/* 可滚动内容区域 */}
        <div className='flex-1 px-6 sm:px-8 py-4 overflow-y-auto overscroll-contain pb-6 sm:pb-6'>{children}</div>

        {/* 固定底部按钮区域 */}
        {footer && (
          <div className='flex-shrink-0 px-6 sm:px-8 py-4 border-t border-white/30 dark:border-theme-gray-700/60 bg-white/90 dark:bg-theme-gray-900/90 rounded-b-3xl'>
            <div className='flex flex-row flex-wrap justify-center items-center gap-3 sm:gap-4'>{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
