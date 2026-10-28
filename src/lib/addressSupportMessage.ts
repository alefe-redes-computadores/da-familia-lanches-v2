/** R38: contato humano de orientacao, nao e pedido e nao inclui endereco residencial. */
export function buildDistrictSupportMessage(district: string): string {
  const safe = String(district ?? "")
    .replace(/[\x00-\x1f\x7f<>]/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, 75);
  return [
    "Olá! Preciso de ajuda para encontrar meu bairro no site da Da Família Lanches.",
    ...(safe ? [`Bairro que estou procurando: ${safe}.`] : []),
    "Esta mensagem é somente para orientação sobre o endereço. Não fiz nem confirmei um pedido.",
  ].join("\n");
}
// DFL-R38-ADDRESS-HELP
