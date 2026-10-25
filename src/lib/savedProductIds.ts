/** V90 R3 — favoritos neste dispositivo. Guarda só IDs, sem dados pessoais. */
const STORAGE_KEY = "dfl:saved-products:v1";
const MAX_IDS = 12;
function cleanId(id: unknown): string {
  return typeof id === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(id) ? id : "";
}
export function readSavedProductIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length > 4096) return [];
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.map(cleanId).filter(Boolean))).slice(0, MAX_IDS);
  } catch { return []; }
}
/** Retorna o estado após a gravação, ou false se o storage foi bloqueado. */
export function toggleSavedProductId(id: string): boolean {
  const key = cleanId(id);
  if (!key || typeof window === "undefined") return false;
  const current = readSavedProductIds();
  const saved = current.includes(key);
  const next = saved ? current.filter((item) => item !== key) : [key, ...current].slice(0, MAX_IDS);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("dfl:saved-products-changed"));
    return !saved;
  } catch { return false; }
}

/** V90 R4 — limpeza explícita da lista local. Não afeta outros dados do cliente. */
export function clearSavedProductIds(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("dfl:saved-products-changed"));
    return true;
  } catch { return false; }
}
