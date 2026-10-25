/** DFL SITE V88: só oferecer caminho manual quando o servidor recusou explicitamente a operação.
 * Resposta incerta, idempotência ou regra comercial: nunca sugerir pedido em canal paralelo. */
const SERVER_REJECTION_CODES = new Set([
  "SERVICE_CONFIG",
]);
export function canOfferManualOrderFallback(code: string): boolean {
  return SERVER_REJECTION_CODES.has(code);
}
