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

/** Mensagens públicas: nunca incluir notas internas ou detalhes de operação. */
export function cancellationPublicMessage(code: string | null | undefined): string {
  const reason = ORDER_CANCELLATION_REASONS.find((item) => item.code === code);
  switch (reason?.code) {
    case "store_closed": return "Precisamos encerrar o atendimento antes de preparar seu pedido. Pedimos desculpas pelo transtorno.";
    case "item_unavailable": return "Um item ou ingrediente necessário ficou indisponível e não conseguimos preparar seu pedido como gostaríamos. Sentimos muito!";
    case "courier_unavailable": return "Não conseguimos confirmar um entregador para levar seu pedido com segurança. Pedimos desculpas pelo inconveniente.";
    case "high_demand": return "Recebemos mais pedidos do que conseguimos preparar com a qualidade que você merece neste momento. Sentimos muito!";
    case "operational_issue": return "Tivemos um imprevisto na operação e, infelizmente, não conseguimos seguir com seu pedido. Pedimos desculpas.";
    case "customer_unreachable": return "Precisávamos confirmar uma informação importante, mas não conseguimos contato a tempo. Por isso, o pedido foi cancelado.";
    case "customer_request": return "Seu pedido foi cancelado conforme solicitado. Esperamos atender você novamente em breve!";
    default: return "Infelizmente, precisamos cancelar seu pedido. Pedimos desculpas pelo inconveniente.";
  }
}
