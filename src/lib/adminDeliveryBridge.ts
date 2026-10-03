const ENTREGAS_PACKAGE = "com.dfl.entregas";
const ENTREGAS_SCHEME = "dflentregas";
function cleanId(value: unknown) {
  return String(value ?? "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 160);
}
export function dflEntregasIntentUrl(deliveryId: unknown, adminOrderId?: unknown) {
  const id = cleanId(deliveryId);
  if (!id) return "";
  const order = cleanId(adminOrderId);
  const fallback = `https://admin.dafamilialanches.com.br/admin?stage=expedicao${order ? `&order=${encodeURIComponent(order)}` : ""}`;
  return `intent://delivery?id=${encodeURIComponent(id)}#Intent;scheme=${ENTREGAS_SCHEME};package=${ENTREGAS_PACKAGE};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}
