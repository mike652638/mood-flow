import { useContext } from 'react';
import { ImmersiveModeContext } from '../contexts/ImmersiveModeContext';

export const useImmersiveMode = () => {
  const context = useContext(ImmersiveModeContext);
  
  if (!context) {
    // 如果没有上下文，返回默认值
    return {
      immersiveMode: false,
      currentTheme: 'light' as const
    };
  }
  
  return context;
};