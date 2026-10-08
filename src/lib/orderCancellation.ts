export const ORDER_CANCELLATION_REASONS = [
  { code: "store_closed", label: "Loja fechada", publicMessage: "A loja precisou encerrar o atendimento." },
  { code: "item_unavailable", label: "Item ou ingrediente indisponível", publicMessage: "Um item do pedido ficou indisponível." },
  { code: "courier_unavailable", label: "Sem motoboy disponível", publicMessage: "Não conseguimos disponibilidade para a entrega." },
  { code: "high_demand", label: "Alta demanda", publicMessage: "A operação atingiu o limite de pedidos neste momento." },
  { code: "operational_issue", label: "Problema operacional", publicMessage: "Tivemos um imprevisto operacional." },
  { code: "customer_unreachable", label: "Cliente não localizado / sem contato", publicMessage: "Não conseguimos concluir o contato necessário para o pedido." },
  { code: "customer_request", label: "Cancelamento solicitado pelo cliente", publicMessage: "O cancelamento foi solicitado pelo cliente." },
  { code: "other", label: "Outro motivo", publicMessage: "O pedido precisou ser cancelado." },
] as const;

export type OrderCancellationReasonCode = typeof ORDER_CANCELLATION_REASONS[number]["code"];

export function cancellationReason(code: OrderCancellationReasonCode) {
  return ORDER_CANCELLATION_REASONS.find((reason) => reason.code === code)!;
}
