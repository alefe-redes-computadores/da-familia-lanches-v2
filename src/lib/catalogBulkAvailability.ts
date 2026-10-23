import type { Product } from "@/data/products";

/** V86 R6: planejamento local e puro. A API confirma o estado novamente numa transação. */
export type BulkCatalogItem = Pick<Product, "id" | "name" | "category" | "disponivel" | "bundleItems">;
export type BulkAvailabilityChange = { id: string; expected: boolean };
export type BulkAvailabilityPlan = {
  changes: BulkAvailabilityChange[];
  affectedCombos: BulkCatalogItem[];
  uncoveredCombos: BulkCatalogItem[];
  automaticallyIncluded: BulkCatalogItem[];
  missing: string[];
  valid: boolean;
  message: string;
};
export const BULK_MAX_ITEMS = 40;

export function buildBulkAvailabilityPlan(
  products: readonly BulkCatalogItem[],
  selectedIds: readonly string[],
  nextAvailable: boolean,
  includeLinkedCombos = true,
): BulkAvailabilityPlan {
  const byId = new Map(products.map(product => [product.id, product]));
  const unique = [...new Set(selectedIds)];
  const missing = unique.filter(id => !byId.has(id));
  const manuallySelected = new Set(unique.filter(id => byId.has(id) && byId.get(id)!.disponivel !== nextAvailable));
  const target = new Set(manuallySelected);
  const linked = new Set<string>();
  if (!nextAvailable) {
    // A dependência é pela composição REAL do combo, nunca pelo texto de descrição.
    for (let step = 0; step < products.length; step += 1) {
      let changed = false;
      for (const product of products) {
        if (product.disponivel === false || !product.bundleItems?.some(item => target.has(item.productId))) continue;
        linked.add(product.id);
        if (includeLinkedCombos && !target.has(product.id)) {
          target.add(product.id);
          changed = true;
        }
      }
      if (!changed) break;
    }
    // Também alerta os combos diretamente vinculados que não seriam pausados.
    for (const product of products) {
      if (product.disponivel && product.bundleItems?.some(item => manuallySelected.has(item.productId))) linked.add(product.id);
    }
  }
  const all = [...target].map(id => byId.get(id)!).filter(Boolean);
  const changes = all.filter(product => product.disponivel !== nextAvailable)
    .map(product => ({ id: product.id, expected: product.disponivel }));
  const affectedCombos = [...linked].map(id => byId.get(id)!).filter(Boolean);
  const uncoveredCombos = affectedCombos.filter(product => product.disponivel && !target.has(product.id));
  const automaticallyIncluded = all.filter(product => !manuallySelected.has(product.id));
  const valid = missing.length === 0 && changes.length > 0 && changes.length <= BULK_MAX_ITEMS;
  const message = missing.length ? "Alguns produtos sumiram do catálogo. Atualize a lista." :
    !changes.length ? "Selecione produtos que precisam mudar de estado." :
    changes.length > BULK_MAX_ITEMS ? `Limite seguro de ${BULK_MAX_ITEMS} alterações por lote. Divida a operação.` :
    uncoveredCombos.length ? "Alguns combos permanecem ativos mesmo com componentes pausados. Revise-os." : "";
  return { changes, affectedCombos, uncoveredCombos, automaticallyIncluded, missing, valid, message };
}
