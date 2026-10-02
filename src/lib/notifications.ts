// Local push-style notifications for new chat messages.
// Uses the Web Notifications API (works in browser tabs and installed PWA),
// with graceful degradation when unsupported or denied.

export type NotifPermission = "unsupported" | "default" | "granted" | "denied";

const PREF_KEY = "talkme_notifications";

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getPermission(): NotifPermission {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission as NotifPermission;
}

export function getNotifPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const v = localStorage.getItem(PREF_KEY);
    if (v === null) return false;
    return JSON.parse(v) === true;
  } catch {
    return false;
  }
}

export function setNotifPref(on: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(on));
  } catch {
    /* ignore */
  }
}

/** Ask the user for permission. Returns the resulting permission state. */
export async function requestNotifPermission(): Promise<NotifPermission> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const res = await Notification.requestPermission();
    return res as NotifPermission;
  } catch {
    return getPermission();
  }
}

/**
 * Show a notification for an incoming message.
 * No-op when disabled, not permitted, or the tab is already focused.
 */
export function notifyMessage(title: string, body: string, tag = "talkme-message") {
  if (!notificationsSupported()) return;
  if (!getNotifPref()) return;
  if (Notification.permission !== "granted") return;
  if (typeof document !== "undefined" && document.visibilityState === "visible") return;
  try {
    const n = new Notification(title, {
      body,
      tag,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      silent: false,
    });
    n.onclick = () => {
      try {
        window.focus();
      } catch {
        /* ignore */
      }
      n.close();
    };
  } catch {
    /* ignore */
  }
}
