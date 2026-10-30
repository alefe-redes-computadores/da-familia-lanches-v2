// DFL-R91-GESTAO-COMERCIAL — diagnostico puro e conservador, sem escrita de dados.
import type { Product } from "@/data/products";

export type CommercialFinding = {
  productId: string;
  productName: string;
  kind: "invalid_price" | "invalid_previous_price" | "paused_showcase";
  detail: string;
};

/** Alertas orientativos, nunca um mecanismo automatico de alteracao de preco. */
export function auditCommercialCatalog(products: readonly Product[]): CommercialFinding[] {
  const findings: CommercialFinding[] = [];
  for (const product of products) {
    if (!Number.isFinite(product.price) || product.price < 0) {
      findings.push({productId: product.id, productName: product.name, kind: "invalid_price", detail: "Preco atual invalido: conferir cadastro."});
      continue;
    }
    if (product.oldPrice != null && (!Number.isFinite(product.oldPrice) || product.oldPrice <= product.price)) {
      findings.push({productId: product.id, productName: product.name, kind: "invalid_previous_price", detail: "Preco anterior deve ser maior que o preco atual para anunciar desconto."});
    }
    if (product.promoPlacement === "home_showcase" && product.disponivel === false) {
      findings.push({productId: product.id, productName: product.name, kind: "paused_showcase", detail: "Produto pausado esta configurado para destaque em ofertas; confira se e intencional."});
    }
  }
  return findings;
}

export function countValidPromotions(products: readonly Product[]): number {
  return products.filter(product => product.disponivel !== false && Number.isFinite(product.price) && product.price >= 0 &&
    typeof product.oldPrice === "number" && Number.isFinite(product.oldPrice) && product.oldPrice > product.price).length;
}
