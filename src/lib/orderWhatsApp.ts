type Item = {
  quantity: number;
  name: string;
  price: number;
  addons?: string[];
  observation?: string;
};

export type OrderWhatsAppInput = {
  registered: boolean;
  orderId?: string;
  customerName: string;
  phone: string;
  items: Item[];
  deliveryMode: "delivery" | "pickup";
  address?: string;
  district?: string;
  complement?: string;
  reference?: string;
  subtotal: number;
  deliveryFee: number;
  discount: number;
  couponCode?: string;
  total: number;
  paymentMethod: "pix" | "cartao" | "dinheiro";
  changeFor?: string;
  orderObservation?: string;
  scheduledLabel?: string;
};

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function buildOrderWhatsAppMessage(input: OrderWhatsAppInput) {
  const payment =
    input.paymentMethod === "pix" ? "PIX" :
    input.paymentMethod === "cartao" ? "Cartão · levar maquininha" :
    input.changeFor?.trim() ? `Dinheiro · troco para ${input.changeFor.trim()}` : "Dinheiro · sem troco informado";

  const items = input.items.map((item) => {
    const lines = [`*${item.quantity}x ${item.name}* · ${money(item.price * item.quantity)}`];
    if (item.addons?.length) lines.push(`   ↳ Adicionais: ${item.addons.join(", ")}`);
    if (item.observation?.trim()) lines.push(`   ↳ Obs.: ${item.observation.trim()}`);
    return lines.join("\n");
  }).join("\n\n");

  const header = input.registered
    ? ["🍔 *DA FAMÍLIA LANCHES*", `✅ *PEDIDO REGISTRADO${input.orderId ? ` · #${input.orderId.slice(-8).toUpperCase()}` : ""}*`, "_O pedido já está salvo no site._"]
    : ["🍔 *DA FAMÍLIA LANCHES*", "⚠️ *PEDIDO PARA CONFIRMAÇÃO MANUAL*", "_O site não conseguiu registrar este pedido automaticamente._"];

  return [
    ...header,
    "",
    "👤 *CLIENTE*",
    input.customerName || "Cliente",
    `WhatsApp: ${input.phone}`,
    "",
    "🧾 *ITENS*",
    items,
    "",
    input.deliveryMode === "pickup" ? "🛍️ *RETIRADA*" : "🛵 *ENTREGA*",
    input.deliveryMode === "pickup" ? "Retirada no balcão" : input.address,
    input.deliveryMode === "delivery" && input.district ? `Bairro: ${input.district}` : null,
    input.deliveryMode === "delivery" && input.complement ? `Complemento: ${input.complement}` : null,
    input.deliveryMode === "delivery" && input.reference ? `Referência: ${input.reference}` : null,
    "",
    "💳 *PAGAMENTO*",
    payment,
    "",
    "💰 *RESUMO*",
    `Subtotal: ${money(input.subtotal)}`,
    `Entrega: ${input.deliveryFee === 0 ? "Grátis" : money(input.deliveryFee)}`,
    input.discount > 0 ? `Desconto${input.couponCode ? ` (${input.couponCode})` : ""}: -${money(input.discount)}` : null,
    `*TOTAL: ${money(input.total)}*`,
    input.orderObservation?.trim() ? `\n📝 *OBSERVAÇÃO*\n${input.orderObservation.trim()}` : null,
    input.scheduledLabel ? `\n🕒 *AGENDAMENTO*\n${input.scheduledLabel}` : null,
    "",
    input.registered ? "🔎 Acompanhe o andamento em *Meus pedidos* no site." : "👉 *Confirme o recebimento e o prazo com o cliente antes de produzir.*",
  ].filter(Boolean).join("\n");
}
