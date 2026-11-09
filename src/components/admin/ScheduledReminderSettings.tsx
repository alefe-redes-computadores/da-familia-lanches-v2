"use client";

import { useEffect, useRef, useState } from "react";
import { BellRing, CalendarClock } from "lucide-react";
import { useAdminFeedback } from "@/components/admin/ui/AdminExperienceProvider";
import styles from "./ScheduledReminderSettings.module.css";
import { DEFAULT, OPTIONS, dueScheduledReminder, type ReminderSettings, type ScheduleOrder } from "@/lib/scheduledReminderPolicy";

const SETTINGS_KEY = "dfl:scheduled-reminders-r21-settings-v1";
const SEEN_KEY = "dfl:scheduled-reminders-r21-seen-v1";

function readSettings(): ReminderSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null") as Partial<ReminderSettings> | null;
    return raw && typeof raw === "object"
      ? {
          enabled: raw.enabled !== false,
          minutes: OPTIONS.includes(raw.minutes as typeof OPTIONS[number]) ? Number(raw.minutes) : 15,
          repeatAtTime: raw.repeatAtTime !== false,
        }
      : DEFAULT;
  } catch { return DEFAULT; }
}

function seenReminders(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}") as Record<string, unknown>;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
    const now = Date.now();
    return Object.fromEntries(Object.entries(raw).filter(([, val]) => typeof val === "number" && now - val >= 0 && now - val < 30 * 86_400_000)) as Record<string, number>;
  } catch { return {}; }
}

/** R21: apenas alertas locais enquanto o Admin estiver aberto. Zero leituras ou escritas remotas. */
export function ScheduledReminderSettings({ orders, onOpenSchedules }: {
  orders: ScheduleOrder[];
  onOpenSchedules: () => void;
}) {
  const { show } = useAdminFeedback();
  const [settings, setSettings] = useState<ReminderSettings>(DEFAULT);
  const [ready, setReady] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const seenThisSession = useRef(new Set<string>());

  useEffect(() => { setSettings(readSettings()); setReady(true); setNowMs(Date.now()); }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* opcional */ }
  }, [ready, settings]);
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") setNowMs(Date.now()); };
    const timer = window.setInterval(tick, 15_000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, []);
  useEffect(() => {
    if (!ready || !nowMs || document.visibilityState !== "visible" || !settings.enabled) return;
    const seen = seenReminders();
    const candidate = orders.find(order => {
      const phase = dueScheduledReminder(order, nowMs, settings);
      return phase && !seen[`${order.id}|${order.scheduledFor}|${phase}`] && !seenThisSession.current.has(`${order.id}|${order.scheduledFor}|${phase}`);
    });
    if (!candidate) return;
    const phase = dueScheduledReminder(candidate, nowMs, settings);
    if (!phase) return;
    const key = `${candidate.id}|${candidate.scheduledFor}|${phase}`;
    // Marcar antes do toast, para nao repetir ao renderizar ou trocar de aba.
    seen[key] = nowMs;
    seenThisSession.current.add(key);
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(Object.fromEntries(Object.entries(seen).slice(-120)))); } catch { /* sessao em memoria */ }
    const short = candidate.id.slice(-8).toUpperCase();
    const title = phase === "at_time" ? `Chegou o horário · #${short}` : `Agendamento próximo · #${short}`;
    const message = phase === "at_time"
      ? "Confira o pedido agendado e inicie o preparo quando apropriado. Nenhum status foi alterado."
      : `Pedido agendado entra na janela de ${settings.minutes} min. Confira a fila e a preparacao.`;
    show({ tone: "info", title, message, key: `r21-schedule-${key}`, actionLabel: "Ver agendados", onAction: onOpenSchedules });
    // Notificacao do Android somente se a permissao ja existir. Nunca solicitar automaticamente.
    if ("Notification" in window && Notification.permission === "granted" && "serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistration().then(registration => {
        if (registration) return registration.showNotification(title, { body: message, tag: `r21-schedule-${key}` });
      }).catch(() => {});
    }
  }, [ready, nowMs, orders, settings, show, onOpenSchedules]);

  const pending = orders.filter(o => String(o.status) === "Agendado").length;
  return (
    <details className={styles.panel} data-pending={pending > 0}>
      <summary><span className={styles.heading}><CalendarClock size={18} aria-hidden="true"/><strong>Lembretes de agendamentos</strong></span><small>{pending} agendado(s) · {settings.enabled ? `${settings.minutes} min antes` : "desativado"}</small></summary>
      <div className={styles.content}>
        <p>Configure avisos neste Admin. Eles funcionam enquanto o painel estiver aberto; nao sao uma promessa de notificacao com o aplicativo fechado.</p>
        <label className={styles.check}><input type="checkbox" checked={settings.enabled} onChange={event => setSettings(v => ({...v, enabled:event.target.checked}))}/><span>Ativar lembretes</span></label>
        <label className={styles.row}><span>Antecedência</span><select value={settings.minutes} disabled={!settings.enabled} onChange={event => setSettings(v => ({...v,minutes:Number(event.target.value)}))}>{OPTIONS.map(value => <option key={value} value={value}>{value} minutos antes</option>)}</select></label>
        <label className={styles.check}><input type="checkbox" checked={settings.repeatAtTime} disabled={!settings.enabled} onChange={event => setSettings(v => ({...v, repeatAtTime:event.target.checked}))}/><span>Reforçar no horário se ainda estiver agendado</span></label>
        <div className={styles.foot}><BellRing size={15} aria-hidden="true"/> Nenhum lembrete inicia preparo, confirma pedido ou envia WhatsApp.</div>
      </div>
    </details>
  );
}
