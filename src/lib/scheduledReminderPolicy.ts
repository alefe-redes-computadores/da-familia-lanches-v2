/* R21: regra pura, independente de React e Firebase. */
export const OPTIONS = [5, 10, 15, 30, 60] as const;
export type ReminderSettings = { enabled: boolean; minutes: number; repeatAtTime: boolean };
export type ScheduleOrder = { id: string; status?: string; scheduledFor?: string | null };
export const DEFAULT: ReminderSettings = { enabled: true, minutes: 15, repeatAtTime: true };

export function dueScheduledReminder(order: ScheduleOrder, nowMs: number, settings: ReminderSettings): "before" | "at_time" | null {
  if (!settings.enabled || String(order.status ?? "").trim().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase() !== "agendado") return null;
  const dueMs = Date.parse(String(order.scheduledFor || ""));
  if (!Number.isFinite(dueMs) || !Number.isFinite(nowMs) || !OPTIONS.includes(settings.minutes as typeof OPTIONS[number])) return null;
  const remaining = dueMs - nowMs;
  if (remaining > 0 && remaining <= settings.minutes * 60_000) return "before";
  if (settings.repeatAtTime && remaining <= 0 && remaining >= -30 * 60_000) return "at_time";
  return null;
}
