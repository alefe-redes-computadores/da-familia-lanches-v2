/** R251 — Orientações determinísticas, sem coleta de dados, sem IA remota e sem criar pedidos. */
export type DFLHelpTopic = "order" | "checkout" | "address" | "payment" | "human" | "catalog";
export type DFLHelpAction = "orders" | "cart" | "tour" | "human" | "catalog";
export type DFLHelpAnswer = {
  topic: DFLHelpTopic;
  title: string;
  guidance: string;
  action: DFLHelpAction;
  actionLabel: string;
  caution?: string;
};

const clean = (raw: string) => String(raw ?? "").slice(0, 150)
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function classifyDFLHelp(query: string): DFLHelpTopic {
  const text = clean(query);
  if (/(meus pedidos|acompanhar|rastrear|status do pedido|pedido (sumiu|atrasad[oa]?|demorand[oa]?|nao chegou|chegou|confirmad[oa]?|duplicad[oa]?|foi)|nao recebi|ja pedi|ja fiz|deu certo o pedido)/.test(text)) return "order";
  if (/(whatsapp|atendente|atendimento|humano|falar com|suporte|equipe)/.test(text)) return "human";
  if (/\b(cep|bairro|endereco|rua|numero da casa|localizacao|taxa de entrega|frete|retirada|entregar)\b/.test(text)) return "address";
  if (/\b(pix|pagamento|pagar|cartao|troco|cupom|desconto|comprovante|valor final)\b/.test(text)) return "payment";
  if (/(nao consegui|nao consigo|nao conclui|nao finaliz|travou|travando|erro ao finalizar|nao deu certo|finalizar|checkout|como pedir|fazer pedido|como comprar)/.test(text)) return "checkout";
  return "catalog";
}

const answers: Record<DFLHelpTopic, DFLHelpAnswer> = {
  order: {
    topic: "order", title: "Vamos conferir seu pedido", action: "orders", actionLabel: "Abrir Meus Pedidos",
    guidance: "Consulte Meus Pedidos para verificar se a loja recebeu sua compra e acompanhar as atualizações disponíveis.",
    caution: "Se você já tocou em Confirmar e a resposta demorou, não faça outro pedido antes de verificar o resultado.",
  },
  checkout: {
    topic: "checkout", title: "Vamos finalizar com segurança", action: "tour", actionLabel: "Ver passo a passo",
    guidance: "Escolha seu lanche, confira o carrinho, informe entrega ou retirada e revise os valores e a forma de pagamento antes de confirmar uma vez.",
    caution: "Se a confirmação travou ou ficou incerta, consulte Meus Pedidos antes de repetir ou usar o WhatsApp.",
  },
  address: {
    topic: "address", title: "Ajuda com entrega ou endereço", action: "cart", actionLabel: "Ir para o carrinho",
    guidance: "No checkout, escolha entrega ou retirada. Para entrega, confira o bairro completo, a rua e o número. O CEP é opcional.",
  },
  payment: {
    topic: "payment", title: "Ajuda com pagamento e descontos", action: "cart", actionLabel: "Ver carrinho",
    guidance: "Na revisão final, confira taxa, desconto, total e método de pagamento. O cupom precisa ser validado antes da confirmação.",
    caution: "Não considere um Pix pago ou um cupom aprovado até a confirmação correspondente.",
  },
  human: {
    topic: "human", title: "A equipe pode ajudar você", action: "human", actionLabel: "Conversar pelo WhatsApp",
    guidance: "Você pode pedir ajuda à equipe. Abrir a conversa não envia o carrinho nem registra um novo pedido.",
  },
  catalog: {
    topic: "catalog", title: "Vamos encontrar seu lanche", action: "catalog", actionLabel: "Explorar sugestões abaixo",
    guidance: "Você pode pesquisar ingredientes, escolher quantas pessoas vão comer e informar um orçamento. As sugestões usam os itens disponíveis do cardápio.",
    caution: "Em restrições alimentares, confirme a composição do produto com a equipe antes de pedir.",
  },
};

export function getDFLHelpAnswer(query: string): DFLHelpAnswer { return answers[classifyDFLHelp(query)]; }
