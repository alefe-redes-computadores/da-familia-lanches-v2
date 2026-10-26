import type { Product } from "@/data/products";

export type AssistRequest = {
  query?: string;
  people?: number;
  budget?: number;
  onlyCombos?: boolean;
};
export type AssistRecommendation = {
  product: Product;
  reason: string;
  score: number;
  estimatedServings: number | null;
};

const normalize = (value: unknown) => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
const ignored = new Set(["com", "sem", "uma", "para", "quero", "tem", "que", "de", "do", "da", "um", "o", "a", "e"]);
const tokenize = (value: string) => normalize(value).split(" ").filter(word => word.length >= 3 && !ignored.has(word));
function servings(product: Product): number | null {
  if (!product.bundleItems?.length) return null;
  const food = product.bundleItems.filter(x => !/refri|kuat|fanta|coca|agua|suco/i.test(x.productId));
  if (!food.length) return null;
  const n = food.reduce((sum, item) => sum + (Number.isFinite(item.quantity) ? Math.max(0, item.quantity) : 0), 0);
  return n > 0 ? n : null;
}
function isCombo(p: Product) { return Boolean(p.bundleItems?.length) || /combo|promoc/i.test(p.name + " " + p.category); }

/** Motor deterministico: apenas recomenda produtos presentes no catalogo recebido.
 * Nunca cria pedido, altera carrinho, calcula frete nem promete porcoes exatas.
 */
export function recommendDFLProducts(products: readonly Product[], request: AssistRequest, limit = 5): AssistRecommendation[] {
  const query = String(request.query ?? "").slice(0, 180);
  const words = tokenize(query);
  const budget = Number.isFinite(request.budget) && (request.budget ?? -1) >= 0 ? Number(request.budget) : null;
  const people = Number.isInteger(request.people) && Number(request.people) >= 1 && Number(request.people) <= 30 ? Number(request.people) : null;
  const combos = request.onlyCombos === true || /combo|promocao|promocoes/i.test(normalize(query));
  const results = products.flatMap(product => {
    if (product.disponivel === false || !Number.isFinite(product.price) || product.price < 0 || !product.id || !product.name) return [];
    if (budget !== null && product.price > budget) return [];
    if (combos && !isCombo(product)) return [];
    const name = normalize(product.name);
    const full = normalize([product.name, product.description, product.category, product.detailsItems?.join(" "), product.includedExtras].filter(Boolean).join(" "));
    const hits = words.filter(w => full.includes(w));
    if (words.length && !hits.length) return [];
    let score = hits.reduce((a,w) => a + (name.includes(w) ? 8 : 3), 0);
    const portions = servings(product);
    if (people !== null && portions !== null) score += portions >= people ? 9 - Math.min(5, portions - people) : -10;
    if (combos && isCombo(product)) score += 4;
    if (budget !== null) score += Math.min(3, (budget - product.price) / Math.max(1, budget) * 3);
    const reason = hits.length ? `Combina com: ${hits.join(", ")}` : portions !== null && people !== null
      ? `Inclui ${portions} unidade(s) de lanche; confira a composicao` : "Opcao disponivel no catalogo";
    return [{product, reason, score, estimatedServings: portions}];
  });
  return results.sort((a,b) => b.score - a.score || a.product.price - b.product.price || a.product.id.localeCompare(b.product.id)).slice(0, Math.max(0, Math.min(8, Math.floor(limit))));
}
