/** R106: identidade promocional de um produto, sem escrita nem regra comercial. */
import type { Product } from "@/data/products";
import type { VisualCampaign } from "@/lib/visualCampaigns";

export type CampaignProductHighlight = Readonly<{ label: string; percent: number }>;

function eligible(product: Product, categories?: ReadonlySet<string>): boolean {
  return product.disponivel !== false &&
    Number.isFinite(product.price) && product.price >= 0 &&
    typeof product.oldPrice === "number" && Number.isFinite(product.oldPrice) &&
    product.oldPrice > product.price &&
    (!categories || categories.has(product.category));
}

/** Mesma selecao automatica da Home R105: somente seis ofertas genuinas. */
export function featuredCampaignProduct(
  campaign: VisualCampaign | null,
  product: Product | null | undefined,
  products: readonly Product[],
  visibleCategoryIds?: ReadonlySet<string>,
): CampaignProductHighlight | null {
  if (!campaign || !campaign.scopes.includes("offers") || !product ||
      !eligible(product, visibleCategoryIds)) return null;
  if (campaign.offerProductIds.length) {
    if (!campaign.offerProductIds.includes(product.id)) return null;
  } else {
    const auto = products.filter(candidate => eligible(candidate, visibleCategoryIds) &&
      (candidate.promoPlacement === "home_showcase" ||
        (candidate.promoPlacement == null && candidate.isSuggestion === true)))
      .sort((a, b) =>
        ((b.oldPrice! - b.price) / b.oldPrice!) - ((a.oldPrice! - a.price) / a.oldPrice!))
      .slice(0, 6);
    if (!auto.some(candidate => candidate.id === product.id)) return null;
  }
  const percent = Math.round((1 - product.price / product.oldPrice!) * 100);
  return {label: campaign.badgeLabel || campaign.publicName, percent: Math.max(0, percent)};
}
