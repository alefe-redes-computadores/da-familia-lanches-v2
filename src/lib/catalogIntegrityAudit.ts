/** DFL-R90-COMBO-AUDIT — verificacao local, sem gravar nem modificar o catalogo. */
import type { Product } from "@/data/products";

export type CatalogBundleIssue = {
  productId: string;
  productName: string;
  kind: "unlinked" | "missing" | "paused" | "quantity" | "self" | "duplicate";
  detail: string;
};

/**
 * Identifica vinculos de produtos completos; ingredientes livres nao sao
 * itens operacionais. Uma ausencia de vinculos e aviso de revisao, nao prova
 * de erro: algumas promocoes podem ser cadastradas como produto simples.
 */
export function auditCatalogBundles(products: readonly Product[]): CatalogBundleIssue[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  const issues: CatalogBundleIssue[] = [];
  for (const product of products) {
    const components = product.bundleItems ?? [];
    const looksLikeCombo = product.category === "combos" || product.category === "promocoes" || product.id.startsWith("combo-");
    const warn = (kind: CatalogBundleIssue["kind"], detail: string) => {
      issues.push({ productId: product.id, productName: product.name, kind, detail });
    };
    if (looksLikeCombo && components.length === 0) {
      warn("unlinked", "Sem componentes vinculados; confira se a oferta inclui outros produtos.");
    }
    const seen = new Set<string>();
    for (const component of components) {
      const id = String(component.productId ?? "").trim();
      if (!Number.isInteger(component.quantity) || component.quantity <= 0) {
        warn("quantity", `Quantidade inválida para ${id || "componente sem ID"}.`);
      }
      if (id && id === product.id) warn("self", "Produto vinculado a ele mesmo.");
      if (seen.has(id)) warn("duplicate", `Componente repetido: ${id || "sem ID"}.`);
      seen.add(id);
      const linked = byId.get(id);
      if (!linked) warn("missing", `Componente não encontrado: ${id || "ID vazio"}.`);
      else if (linked.disponivel === false) warn("paused", `Componente pausado: ${linked.name}.`);
    }
  }
  return issues;
}
