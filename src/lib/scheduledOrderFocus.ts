/** V89 R3 — somente apresentação; não muda status nem consulta backend. */
export function isOverdueScheduledOrder(status: string, scheduledFor: unknown, now: number): boolean {
  if (status !== "Agendado" || typeof scheduledFor !== "string" || !Number.isFinite(now)) return false;
  const stamp = Date.parse(scheduledFor);
  return Number.isFinite(stamp) && stamp <= now;
}
