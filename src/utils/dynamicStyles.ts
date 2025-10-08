// 动态样式工具函数
export const applyDynamicStyles = () => {
  // 处理情绪颜色指示器
  const moodIndicators = document.querySelectorAll('.mood-color-indicator[data-mood-color]');
  moodIndicators.forEach((element) => {
    const color = element.getAttribute('data-mood-color');
    if (color) {
      (element as HTMLElement).style.backgroundColor = color;
    }
  });

  // 处理工具提示位置
  const tooltips = document.querySelectorAll('.wordcloud-tooltip[data-tooltip-x]');
  tooltips.forEach((element) => {
    const x = element.getAttribute('data-tooltip-x');
    const y = element.getAttribute('data-tooltip-y');
    const isRight = element.getAttribute('data-tooltip-right') === 'true';
    
    if (x && y) {
      const htmlElement = element as HTMLElement;
      htmlElement.style.left = `${parseInt(x) + 10}px`;
      htmlElement.style.top = `${parseInt(y) - 35}px`;
      htmlElement.style.transform = isRight ? 'translateX(-100%)' : 'none';
    }
  });

  // 处理进度条宽度
  const progressBars = document.querySelectorAll('.progress-bar-fill[data-width]');
  progressBars.forEach((element) => {
    const width = element.getAttribute('data-width');
    if (width) {
      (element as HTMLElement).style.width = `${width}%`;
    }
  });
};

// 使用 MutationObserver 监听DOM变化并应用样式
export const initDynamicStylesObserver = () => {
  const observer = new MutationObserver((mutations) => {
    let shouldUpdate = false;
    
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' || 
          (mutation.type === 'attributes' && 
           ['data-mood-color', 'data-tooltip-x', 'data-tooltip-y', 'data-width'].includes(mutation.attributeName || ''))) {
        shouldUpdate = true;
      }
    });
    
    if (shouldUpdate) {
      // 使用 requestAnimationFrame 来优化性能
      requestAnimationFrame(applyDynamicStyles);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-mood-color', 'data-tooltip-x', 'data-tooltip-y', 'data-tooltip-right', 'data-width']
  });

  // 初始应用样式
  applyDynamicStyles();
  
  return observer;
};