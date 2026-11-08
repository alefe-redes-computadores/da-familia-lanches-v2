/** R24 P0 — autoridade do pedido no último instante anterior ao handoff.
 * Política PURA: não consulta dados nem ativa o WhatsApp.
 */
export type R24Event =
  | 'order.created' | 'order.production' | 'order.ready' | 'order.cancelled'
  | 'delivery.started' | 'delivery.next_stop' | 'delivery.position_changed'
  | 'delivery.completed' | 'delivery.failed';

export function normalizedR24Status(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** null = nenhuma nova proibição por esta política; demais contratos seguem obrigatórios. */
export function r24MessageStateGuard(
  eventType: string,
  order: Record<string, unknown>,
  sourceEventType = '',
): string | null {
  const status = normalizedR24Status(order.status);
  const pickup = order.tipoEntrega === 'pickup';
  const delivered = order.deliveryOperationalCompleted === true ||
    (typeof order.deliveryOperationalCompletedAt === 'string' && Boolean(order.deliveryOperationalCompletedAt.trim())) ||
    order.deliveryTrackingEvent === 'delivery.completed';
  const cancelled = /cancel|reembols|devolv/.test(status);
  const terminal = cancelled || /finaliz|entregue|conclu/.test(status);

  // Retirada no balcão nunca equivale a transporte concluído por motoboy.
  if (pickup && eventType.startsWith('delivery.')) return 'r24_pickup_has_no_delivery_notification';
  // Mensagem de pedido cancelado só é coerente quando o estado canônico ainda é cancelado.
  if (eventType === 'order.cancelled') return cancelled ? null : 'r24_cancel_event_no_longer_current';
  // Mensagem de entrega concluída requer evento operacional, não inferência do status Site.
  if (eventType === 'delivery.completed') {
    if (cancelled) return 'r24_delivery_after_cancellation';
    return sourceEventType === 'delivery.completed' ? null : 'r24_not_authoritative_delivery_completion';
  }
  if (terminal || delivered) return 'r24_obsolete_after_terminal';
  if (eventType === 'order.production' && status !== 'em producao') return 'r24_obsolete_production_stage';
  if (eventType === 'order.ready' && status !== 'pronto') return 'r24_obsolete_ready_stage';
  return null;
}
