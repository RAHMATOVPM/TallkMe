import { Capacitor } from '@capacitor/core';

/**
 * Native-only setup (status bar, keyboard behaviour, back button).
 * Safe no-op on the web.
 */
export async function initializeCapacitor() {
  if (typeof window === 'undefined') return;
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    const theme = document.documentElement.getAttribute('data-theme');
    await StatusBar.setStyle({ style: theme === 'light' ? Style.Light : Style.Dark });
  } catch {
    /* plugin unavailable */
  }

  try {
    const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard');
    await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
  } catch {
    /* plugin unavailable */
  }

  try {
    const { App } = await import('@capacitor/app');
    await App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else void App.exitApp();
    });
  } catch {
    /* plugin unavailable */
  }
}
