/** V88 R3: resposta incerta exige consulta, nunca uma nova tentativa por canal paralelo. */
const EXPLICIT_REJECTIONS = new Set([
  "SERVICE_CONFIG", "AUTH_REQUIRED", "PAYLOAD_INVALID", "CART_INVALID",
  "PRODUCT_UNAVAILABLE", "PRICE_CHANGED", "DELIVERY_CHANGED", "PHONE_INVALID",
  "ADDRESS_INVALID", "PAYMENT_INVALID", "IDEMPOTENCY_CONFLICT", "IDEMPOTENCY_REQUIRED",
  "SCHEDULE_REQUIRED", "SCHEDULE_INVALID",
]);
/** Não afirma que o pedido foi criado: apenas orienta o cliente a conferir. */
export function orderOutcomeNeedsReview(code: string): boolean {
  const normalized = String(code || "").trim().toUpperCase();
  if (EXPLICIT_REJECTIONS.has(normalized) || /^(COUPON_|REWARD_|ADDON_|UPSELL_|SCHEDULE_)/.test(normalized)) return false;
  return true; // timeout, rede, erro inesperado e servidor sobrecarregado são ambíguos
}
