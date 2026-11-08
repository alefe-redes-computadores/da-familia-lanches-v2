/** R11: policy pure and fail-closed for commercial messaging via Site. */
export type R11Input = {
  eventType: string;
  sourceEventType: string;
  phone: string;
  order: Record<string, unknown>;
  env: Record<string, string | undefined>;
};
const normalizeR11Phone = (p: string) => p.trim().replace(/\D/g, "");
const validPhone = (p: string) => /^55[1-9]\d{9,10}$/.test(normalizeR11Phone(p));
const terminal = (s: unknown) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export function r11SiteMessageGate({eventType,sourceEventType,phone,order,env}:R11Input): string | null {
  // Site exclusively owns pickup-ready messaging; reverse logistics owns tracking only.
  if (sourceEventType === 'delivery.pickup_ready') return 'pickup_ready_site_authority';
  const mode = order.tipoEntrega === 'pickup' ? 'pickup' : 'delivery';
  if (mode === 'pickup' && eventType.startsWith('delivery.')) return 'pickup_logistics_suppressed';
  if (mode === 'delivery' && eventType === 'delivery.completed' && sourceEventType === 'order.updated') return 'site_delivery_completion_suppressed';
  const st = terminal(order.status);
  if ((st === 'cancelado' || st === 'finalizado') && (eventType === 'order.production' || eventType === 'order.ready')) return 'obsolete_commercial_stage';
  if (env.DFL_MESSAGING_R11_SITE_ENABLED !== 'true') return 'r11_site_gate_off';
  if (env.DFL_MESSAGING_R11_KILL_SWITCH !== 'false') return 'r11_kill_switch';
  if (order.whatsappNotificationsConsent !== true || typeof order.whatsappNotificationsConsentAt !== 'string' || !Number.isFinite(Date.parse(order.whatsappNotificationsConsentAt))) return 'explicit_consent_missing';
  if (!validPhone(phone)) return 'invalid_phone';
  const phones=(env.DFL_MESSAGING_R11_APPROVED_PHONES_E164||'').split(',').map(v=>v.trim()).filter(Boolean);
  const scope=env.DFL_MESSAGING_R11_SCOPE || 'canary';
  if (scope === 'consented_customers') {
    if (env.DFL_MESSAGING_R11_ROLLOUT_APPROVED !== 'true') return 'rollout_not_approved';
  } else if (scope === 'canary') {
    if (!phones.length || phones.length > 12 || new Set(phones).size !== phones.length || phones.some(v=>!validPhone(v)) || !phones.includes(normalizeR11Phone(phone))) return 'not_in_approved_pilot';
  } else return 'invalid_rollout_scope';
  // An approved template catalog must be verified externally before enabling this flag.
  // This event allowlist is an *additional* gate, not proof of provider approval.
  const events=(env.DFL_MESSAGING_R11_APPROVED_EVENTS||'').split(',').map(v=>v.trim()).filter(Boolean);
  if (!events.includes(eventType)) return 'template_event_not_enabled';
  return null;
}
