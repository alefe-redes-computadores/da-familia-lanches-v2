import type { Product } from "@/data/products";
import type { CatalogCategory } from "@/lib/catalogCategories";

/** R35: leitura agregada dos dados ja carregados, sem backend, vendas ou novos eventos. */
export type CatalogConversionSummary = {
  visible: number;
  hidden: number;
  withImage: number;
  withDescription: number;
  activeOffers: number;
  completeBundles: number;
  bundleCount: number;
  suggestions: string[];
};

export function summarizeCatalogConversion(products: readonly Product[], categories: readonly CatalogCategory[]): CatalogConversionSummary {
  const activeCategories = new Set(categories.filter(c => c.active !== false).map(c => c.id));
  const byId = new Map(products.map(p => [p.id, p]));
  const visible = products.filter(p => p.disponivel !== false && activeCategories.has(p.category));
  const withImage = visible.filter(p => typeof p.image === "string" && p.image.trim().length > 0).length;
  const withDescription = visible.filter(p => typeof p.description === "string" && p.description.trim().length >= 35).length;
  const activeOffers = visible.filter(p => typeof p.oldPrice === "number" && Number.isFinite(p.oldPrice) && p.oldPrice > p.price && p.price >= 0).length;
  const bundles = visible.filter(p => (p.bundleItems?.length ?? 0) > 0);
  const completeBundles = bundles.filter(p => p.bundleItems!.every(part => {
    const included = byId.get(part.productId);
    return Boolean(included && included.disponivel !== false && Number.isInteger(part.quantity) && part.quantity > 0);
  })).length;
  const suggestions: string[] = [];
  if (visible.length && withImage < visible.length) suggestions.push(`${visible.length - withImage} item(ns) visível(is) sem foto; revise a apresentação antes de divulgar.`);
  if (visible.length && withDescription < visible.length) suggestions.push(`${visible.length - withDescription} item(ns) com descrição breve; confira ingredientes e informações de compra.`);
  if (completeBundles < bundles.length) suggestions.push(`${bundles.length - completeBundles} combo(s) com vínculo pausado, ausente ou quantidade inconsistente.`);
  if (visible.length && !activeOffers) suggestions.push("Nenhuma oferta com preço anterior válido foi identificada. Isso não impede vendas.");
  const hidden = products.filter(p => p.disponivel !== false && !activeCategories.has(p.category)).length;
  if (hidden) suggestions.push(`${hidden} item(ns) disponíveis estão fora de categorias ativas; confira se é intencional.`);
  return { visible: visible.length, hidden, withImage, withDescription, activeOffers, completeBundles, bundleCount: bundles.length, suggestions };
}
