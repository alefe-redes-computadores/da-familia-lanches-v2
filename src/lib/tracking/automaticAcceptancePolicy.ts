/** R23 — política pura, sem efeitos colaterais, do aceite comercial DFL360. */
export type AutoAcceptanceOrder = Record<string, unknown>;

const txt = (v: unknown): string => typeof v === 'string' ? v.trim() : '';
const normal = (v: unknown) => txt(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const AUTO_ACCEPT_COLLECTION = 'tracking_auto_acceptance_intents_v1';
export const AUTO_ACCEPT_PATH = '/api/integration/tracking/v1/auto/accept' as const;

export function acceptanceStatus(raw: unknown): 'Pendente' | 'Agendado' | null {
  const s = normal(raw);
  if (s === 'pendente') return 'Pendente';
  if (s === 'agendado') return 'Agendado';
  return null;
}

export function acceptedOrderCanNotify(order: AutoAcceptanceOrder, acceptedAt: string): boolean {
  const stamp = Date.parse(acceptedAt);
  if (!Number.isFinite(stamp)) return false;
  if (normal(order.sourceSystem) !== 'dfl_site' || normal(order.checkoutChannel) !== 'site') return false;
  if (order.whatsappNotificationsConsent !== true || txt(order.whatsappNotificationsConsentSource) !== 'checkout_r12_explicit') return false;
  if (order.whatsappNotificationsOptOut === true || order.whatsappOptOut === true ||
      order.messagingOptOut === true || txt(order.whatsappNotificationsConsentRevokedAt)) return false;
  const consent = Date.parse(txt(order.whatsappNotificationsConsentAt));
  if (!Number.isFinite(consent) || consent > stamp + 120_000) return false;
  const st = normal(order.status);
  if (/cancel|finaliz|entregue|conclu|reembols|devolv/.test(st)) return false;
  for (const key of ['testOrder','isTest','isTestOrder','isFictitious','isDemo','testMode']) {
    if (order[key] === true) return false;
  }
  const c = order.customerSnapshot;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return false;
  const phone = txt((c as Record<string,unknown>).phoneE164);
  return /^\+55[1-9][0-9][2-9][0-9]{7,8}$/.test(phone);
}

export function terminalOrDifferentAcceptance(order: AutoAcceptanceOrder, acceptedAt: string): boolean {
  const recorded = txt(order.acceptedAt);
  if (recorded !== acceptedAt) return true;
  return /cancel|finaliz|entregue|conclu|reembols|devolv/.test(normal(order.status));
}
