import React, { useEffect, useId, useRef } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  footerClassName?: string;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, footer, children, className, footerClassName }) => {
  const titleId = useId();
  const contentId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // 锁定页面滚动与 ESC 关闭
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') {
        const root = panelRef.current;
        if (!root) return;
        const focusables = root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (active === first || !root.contains(active)) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (active === last || !root.contains(active)) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    // 初始聚焦到面板内第一个可聚焦元素或关闭按钮
    queueMicrotask(() => {
      const root = panelRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length) focusables[0].focus();
    });
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKeyDown);
      // 还原焦点到触发元素
      if (previouslyFocused) previouslyFocused.focus();
    };
  }, [onClose]);

  return (
    <div
      className='modal fixed inset-0 z-[var(--modal-z-index)] flex items-center justify-center p-4'
      role='dialog'
      aria-modal='true'
      aria-labelledby={titleId}
      aria-describedby={contentId}
    >
      <div className='absolute inset-0 bg-black/40 dark:bg-black/50 backdrop-blur-sm' onClick={onClose} />
      <div
        ref={panelRef}
        className={`modal-panel relative z-10 w-full max-w-2xl mx-4 sm:mx-auto bg-white/95 dark:bg-theme-gray-900/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 dark:border-theme-gray-700/50 flex flex-col max-h-[80dvh] sm:max-h-[70vh] motion-reduce:transition-none ${
          className || ''
        }`}>
        {/* 固定标题栏 */}
        <div className='flex-shrink-0 px-6 sm:px-8 py-4 border-b border-white/30 dark:border-theme-gray-700/60 bg-white/90 dark:bg-theme-gray-900/90 rounded-t-3xl'>
          <div className='relative'>
            <h3 id={titleId} className='text-lg sm:text-xl font-bold text-center text-gray-900 dark:text-white pr-10'>
              {title}
            </h3>
            <button
              onClick={onClose}
              aria-label='关闭'
              className='absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-gray-100 dark:bg-theme-gray-800 hover:bg-gray-200 dark:hover:bg-theme-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-600 active:scale-95'>
              ✕
            </button>
          </div>
        </div>

        {/* 可滚动内容区域 */}
        <div id={contentId} className='flex-1 px-6 sm:px-8 py-4 overflow-y-auto overscroll-contain pb-6 sm:pb-6'>
          {children}
        </div>

        {/* 固定底部按钮区域 */}
        {footer && (
          <div
            className='flex-shrink-0 px-6 sm:px-8 py-4 border-t border-white/30 dark:border-theme-gray-700/60 bg-white/90 dark:bg-theme-gray-900/90 rounded-b-3xl'
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
          >
            <div className={`flex flex-row flex-wrap justify-center items-center gap-3 sm:gap-4 ${footerClassName || ''}`}>
              {footer}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Modal;
