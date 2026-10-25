/** V90 — navegação recente nesta aba; não armazena nome, telefone nem pedido. */
const KEY = "dfl:recent-products:v1";
const MAX = 5;
function cleanId(id: unknown): string {
  return typeof id === "string" && id.trim().length > 0 && id.length <= 120 ? id.trim() : "";
}
export function readRecentProductIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.sessionStorage.getItem(KEY) ?? "[]");
    return Array.isArray(value) ? Array.from(new Set(value.map(cleanId).filter(Boolean))).slice(0, MAX) : [];
  } catch { return []; }
}
export function rememberRecentProductId(id: string): void {
  const key = cleanId(id);
  if (!key || typeof window === "undefined") return;
  try {
    const next = [key, ...readRecentProductIds().filter((current) => current !== key)].slice(0, MAX);
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch { /* armazenamento privado/desabilitado: navegação continua funcionando */ }
}
