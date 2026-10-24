/** Busca local do editor DFL: sem requests extras, acentos e ordem indiferentes. */
export function normalizeCatalogSearch(value: unknown): string {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}
export function catalogProductMatchesSearch(product: {name:string;description?:string;id:string}, query: string): boolean {
  const tokens = normalizeCatalogSearch(query).split(" ").filter(Boolean);
  if (!tokens.length) return true;
  const haystack = normalizeCatalogSearch(`${product.name} ${product.description ?? ""} ${product.id}`);
  return tokens.every((token) => haystack.includes(token));
}
