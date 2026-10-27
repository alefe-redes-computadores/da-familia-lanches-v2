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
const ignored = new Set([
  "com", "sem", "uma", "para", "quero", "tem", "que", "de", "do", "da", "um", "o", "a", "e",
  "eu", "gostaria", "preciso", "me", "mostre", "mostrar", "algum", "alguma", "sugestao", "sugestoes",
  "comer", "lanche", "lanches", "sanduiche", "sanduiches", "opcao", "opcoes", "reais", "pedido",
  "combo", "combos", "promocao", "promocoes", "pessoas", "pessoa", "r", "ate", "menos", "abaixo",
]);
const tokenize = (value: string) => normalize(value).split(" ").filter(word => word.length >= 3 && !ignored.has(word));
/** R27: interpretação local, sem IA remota, sem consulta de preços e sem gravar dados. */
export function extractDFLIntent(query: string): {
  terms: string[]; people: number | null; budget: number | null;
  comboOnly: boolean; hasExclusion: boolean;
} {
  const raw = String(query ?? "").slice(0, 180);
  const peopleMatch = raw.match(/\b([1-8])\s*(?:pessoas?|amigos?)\b/i);
  const budgetMatch = raw.match(/(?:até|ate|no máximo|no maximo|menos de|abaixo de)\s*(?:R\$\s*)?(\d{1,4}(?:[.,]\d{1,2})?)/i);
  const people = peopleMatch ? Number(peopleMatch[1]) : null;
  const parsedBudget = budgetMatch ? Number(budgetMatch[1].replace(",", ".")) : NaN;
  const budget = Number.isFinite(parsedBudget) && parsedBudget >= 0 ? parsedBudget : null;
  const comboOnly = /\b(combos?|promocoes?|promocao)\b/.test(normalize(raw));
  const hasExclusion = /\bsem\s+\S+/i.test(raw);
  const words = raw.replace(peopleMatch?.[0] ?? "\u0000", " ")
    .replace(budgetMatch?.[0] ?? "\u0000", " ")
    .replace(/\bsem\s+\S+/gi, " ");
  const aliases: Record<string, string> = {
    franguinho: "frango", frangos: "frango", hamburgueres: "hamburguer",
    burgers: "burger", bacons: "bacon", queijos: "queijo",
  };
  const terms = [...new Set(tokenize(words).map(token => aliases[token] ?? token))];
  return { terms, people, budget, comboOnly, hasExclusion };
}

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
  const intent = extractDFLIntent(query);
  const words = intent.terms;
  const budget = Number.isFinite(request.budget) && (request.budget ?? -1) >= 0 ? Number(request.budget) : intent.budget;
  const people = intent.people ?? (Number.isInteger(request.people) && Number(request.people) >= 1 && Number(request.people) <= 30 ? Number(request.people) : null);
  const combos = request.onlyCombos === true || intent.comboOnly;
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
    const reason = hits.length ? `Encontrado por: ${hits.join(", ")}` : "Opção do cardápio";
    return [{product, reason, score, estimatedServings: portions}];
  });
  return results.sort((a,b) => b.score - a.score || a.product.price - b.product.price || a.product.id.localeCompare(b.product.id)).slice(0, Math.max(0, Math.min(8, Math.floor(limit))));
}
