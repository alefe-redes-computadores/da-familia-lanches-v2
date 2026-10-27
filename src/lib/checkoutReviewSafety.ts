/** R36: lembretes informativos antes do clique final. A API continua a autoridade. */
export type CheckoutReviewInput = {
  hasItems: boolean;
  personalReady: boolean;
  addressReady: boolean;
  pickup: boolean;
  scheduleRequired: boolean;
  scheduleSelected: boolean;
  online: boolean;
  uncertain: boolean;
};
export type CheckoutReviewResult = {
  ready: boolean;
  kind: "safe" | "offline" | "review" | "uncertain";
  title: string;
  message: string;
};
export function inspectCheckoutReviewSafety(input: CheckoutReviewInput): CheckoutReviewResult {
  if (input.uncertain) return { ready:false, kind:"uncertain", title:"Confirme o resultado da tentativa anterior", message:"Este pedido pode ter sido recebido. Consulte Meus Pedidos ou a equipe antes de tentar novamente. Não envie outro pedido pelo WhatsApp." };
  if (!input.online) return { ready:false, kind:"offline", title:"Você está sem conexão", message:"O carrinho permanece salvo. Reconecte e confira a etapa antes de confirmar." };
  if (!input.hasItems) return { ready:false, kind:"review", title:"Carrinho sem itens", message:"Volte ao cardápio para escolher os produtos." };
  if (!input.personalReady) return { ready:false, kind:"review", title:"Revise seus dados de contato", message:"Confira nome e WhatsApp com DDD antes de enviar." };
  if (!input.pickup && !input.addressReady) return { ready:false, kind:"review", title:"Revise o endereço de entrega", message:"Confira bairro, rua, número e o CEP, caso informado." };
  if (input.scheduleRequired && !input.scheduleSelected) return { ready:false, kind:"review", title:"Falta escolher um horário", message:"Selecione um horário disponível para agendar seu pedido." };
  return { ready:true, kind:"safe", title:"Tudo pronto para sua revisão final", message:"Confira itens, endereço, taxa, desconto e forma de pagamento. O pedido só é registrado ao confirmar." };
}
