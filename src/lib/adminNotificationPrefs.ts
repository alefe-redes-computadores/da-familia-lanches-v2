"use client";

export type AdminNotificationPrefs = {
  newOrders: boolean;
  readyOrders: boolean;
  soundAndVibration: boolean;
  quietHours: boolean;
  privatePreview: boolean;
};

const KEY = "dfl-admin-notification-prefs-v31";

export const DEFAULT_ADMIN_NOTIFICATION_PREFS: AdminNotificationPrefs = {
  newOrders: true,
  readyOrders: true,
  soundAndVibration: true,
  quietHours: false,
  privatePreview: false,
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
      quietHours: parsed.quietHours === true,
      privatePreview: parsed.privatePreview === true,
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

/** So silencia audio e vibracao locais; nao altera push remoto, WhatsApp ou pedidos. */
export function adminLocalQuietHoursActive(date = new Date()): boolean {
  if (!readAdminNotificationPrefs().quietHours) return false;
  const hour = Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', hourCycle: 'h23',
  }).format(date));
  return Number.isFinite(hour) && (hour >= 23 || hour < 7);
}
/** Privacidade apenas do aviso LOCAL; dados reais continuam no painel autenticado. */
export function adminLocalAlertBody(body: string): string {
  return readAdminNotificationPrefs().privatePreview ? 'Confira os detalhes no painel administrativo.' : body;
}

export function adminNotificationPrefEnabled(key: keyof AdminNotificationPrefs) {
  return readAdminNotificationPrefs()[key];
}
