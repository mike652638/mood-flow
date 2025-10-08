import { createContext } from 'react';

export interface ImmersiveModeContextType {
  immersiveMode: boolean;
  currentTheme: 'light' | 'dark';
}

export const ImmersiveModeContext = createContext<ImmersiveModeContextType>({
  immersiveMode: false,
  currentTheme: 'light'
});