"use client";

export type AdminNotificationPrefs = {
  newOrders: boolean;
  readyOrders: boolean;
  soundAndVibration: boolean;
};

const KEY = "dfl-admin-notification-prefs-v31";

export const DEFAULT_ADMIN_NOTIFICATION_PREFS: AdminNotificationPrefs = {
  newOrders: true,
  readyOrders: true,
  soundAndVibration: true,
};

export function readAdminNotificationPrefs(): AdminNotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_ADMIN_NOTIFICATION_PREFS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULT_ADMIN_NOTIFICATION_PREFS;
    const parsed = JSON.parse(raw) as Partial<AdminNotificationPrefs>;
    return {
      newOrders: parsed.newOrders !== false,
      readyOrders: parsed.readyOrders !== false,
      soundAndVibration: parsed.soundAndVibration !== false,
    };
  } catch {
    return DEFAULT_ADMIN_NOTIFICATION_PREFS;
  }
}

export function writeAdminNotificationPrefs(next: AdminNotificationPrefs) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("dfl:admin-notification-prefs-changed", { detail: next }));
}

export function adminNotificationPrefEnabled(key: keyof AdminNotificationPrefs) {
  return readAdminNotificationPrefs()[key];
}
