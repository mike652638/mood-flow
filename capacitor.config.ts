import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'host.joyful.moodflow',
  appName: '心流日记',
  webDir: 'dist',
  server: {
    hostname: 'localhost',
    // url: 'http://localhost:5173',
    cleartext: true,
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: '#AC7AFD',
      androidSplashResourceName: 'splash',
      androidScaleType: 'FIT_CENTER',
      showSpinner: false
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#00000000',
      overlaysWebView: true,
      androidStatusBarBackgroundColor: '#00000000'
    },
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true
    },
    Camera: {
      permissions: ['camera', 'photos']
    }
  }
};

export default config;
