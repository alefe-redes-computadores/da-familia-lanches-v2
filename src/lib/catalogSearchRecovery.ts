import type { Product } from "@/data/products";

/** Busca auxiliar local: oferece APENAS nomes de produtos disponiveis.
 * Nao modifica busca original, nao calcula preco, nao consulta redes, nao salva dados.
 */
const norm = (value: unknown) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
  .replace(/[^a-z0-9]+/g, " ").trim();
const stopWords = new Set(["o", "a", "de", "da", "do", "um", "uma", "com", "para", "quero", "tem", "ate", "r", "reais"]);
function edit(a: string, b: string, max = 2): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    let best = next[0];
    for (let j = 1; j <= b.length; j++) {
      const value = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      next.push(value);
      best = Math.min(best, value);
    }
    if (best > max) return max + 1;
    prev = next;
  }
  return prev[b.length];
}
export function suggestCatalogQueries(products: readonly Product[], input: string, limit = 4): string[] {
  const query = norm(String(input ?? "").slice(0, 100));
  if (query.length < 3) return [];
  const tokens = query.split(" ").filter(word => word.length >= 3 && !stopWords.has(word)).slice(0, 6);
  if (!tokens.length) return [];
  const found: Array<{ name: string; score: number; index: number }> = [];
  const seen = new Set<string>();
  products.forEach((product, index) => {
    if (product.disponivel === false || !Number.isFinite(product.price) || product.price < 0 || !product.name?.trim()) return;
    const title = norm(product.name);
    if (!title || seen.has(title)) return;
    const nameTokens = title.split(" ").filter(Boolean);
    const whole = query.length >= 5 && Math.abs(title.length - query.length) <= 2 && edit(query, title, 2) <= 2;
    const hits = tokens.filter(token => nameTokens.some(nameWord =>
      nameWord === token || (token.length >= 4 && nameWord.startsWith(token)) ||
      (token.length >= 4 && nameWord.length >= 4 && edit(token, nameWord, token.length >= 8 ? 2 : 1) <= (token.length >= 8 ? 2 : 1))
    )).length;
    if (!whole && !hits) return;
    seen.add(title);
    found.push({ name: product.name, score: (whole ? 20 : 0) + hits * 10 - Math.max(0, tokens.length - hits) * 4, index });
  });
  return found.sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(0, Math.min(5, Math.trunc(limit) || 0))).map(item => item.name);
}
