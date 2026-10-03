import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.talkme.app',
  appName: 'TalkMe Chat',
  webDir: '.output/public',
  server: {
    // The app is server-rendered (no static index.html), so the APK loads the live site.
    url: 'https://talkme-chat.lovable.app',
    androidScheme: 'https',
    cleartext: false,
  },
  ios: {
    preferredLanguage: 'en',
  },
  android: {
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
