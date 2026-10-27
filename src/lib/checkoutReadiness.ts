/** R34: orientacao 100% local; nao gera pedidos nem decide taxas comerciais. */
export type CheckoutReadinessInput = {
  pickup: boolean;
  name: string;
  phone: string;
  district: string;
  districtValid: boolean;
  street: string;
  number: string;
  cep: string;
  hasItems: boolean;
  scheduleRequired: boolean;
  scheduleSelected: boolean;
};
export type ReadinessItem = { id: string; title: string; done: boolean; hint: string };
export type CheckoutReadiness = {
  items: ReadinessItem[];
  done: number;
  total: number;
  ready: boolean;
  next: ReadinessItem | null;
};

export function inspectCheckoutReadiness(input: CheckoutReadinessInput): CheckoutReadiness {
  const phoneDigits = String(input.phone ?? "").replace(/\D/g, "");
  const cepDigits = String(input.cep ?? "").replace(/\D/g, "");
  const items: ReadinessItem[] = [
    { id: "name", title: "Nome", done: String(input.name ?? "").trim().length >= 2, hint: "Informe o nome para identificar o pedido." },
    { id: "phone", title: "WhatsApp", done: [10, 11].includes(phoneDigits.length), hint: "Informe um WhatsApp com DDD para receber atualizações." },
  ];
  if (!input.pickup) {
    items.push(
      { id: "district", title: "Bairro", done: Boolean(input.districtValid && String(input.district ?? "").trim()), hint: "Informe o bairro completo ou escolha uma sugestão." },
      { id: "street", title: "Rua", done: String(input.street ?? "").trim().length >= 4, hint: "Digite a rua ou avenida completa." },
      { id: "number", title: "Número", done: Boolean(String(input.number ?? "").trim()), hint: "Informe o número da entrega." },
      { id: "cep", title: "CEP opcional", done: cepDigits.length === 0 || cepDigits.length === 8, hint: "Apague o CEP parcial ou complete os 8 números." },
    );
  }
  if (input.scheduleRequired) {
    items.push({ id: "schedule", title: "Agendamento", done: input.scheduleSelected, hint: "Escolha um horário disponível para o agendamento." });
  }
  items.push({ id: "cart", title: "Carrinho", done: input.hasItems, hint: "Adicione pelo menos um produto ao carrinho." });
  const done = items.filter(item => item.done).length;
  return { items, done, total: items.length, ready: done === items.length, next: items.find(item => !item.done) ?? null };
}
