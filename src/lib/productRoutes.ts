import type { Product } from "@/data/products";

export function publicSlug(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export function productPublicSection(product: Product) {
  if (product.publicSection) return publicSlug(product.publicSection);
  if (product.promoPlacement === "home_showcase") return "ofertas-da-familia";
  if (product.category === "promocoes") return "promocoes";
  if (product.category === "combos") {
    const name = publicSlug(product.name);
    if (name.includes("artesanal")) return "combos-artesanais";
    if (name.includes("tradicional")) return "combos-tradicionais";
    return "combos";
  }
  if (product.category === "tradicionais") return "lanches";
  if (product.category === "artesanais") return "lanches-artesanais";
  if (product.category === "hotdogs") return "hot-dogs";
  return publicSlug(product.category || "cardapio");
}

export function productPublicSlug(product: Product) {
  if (product.publicSlug) return publicSlug(product.publicSlug);
  const id = publicSlug(product.id);
  if (product.promoPlacement === "home_showcase") {
    return id.replace(/^combo-/, "").replace(/-oferta$/, "") || id;
  }
  return id || publicSlug(product.name);
}

export function productHref(product: Product) {
  return `/${productPublicSection(product)}/${productPublicSlug(product)}`;
}

export function matchesProductRoute(product: Product, section: string, slug: string) {
  return productPublicSection(product) === publicSlug(section) &&
    (productPublicSlug(product) === publicSlug(slug) || publicSlug(product.id) === publicSlug(slug));
}

export const PUBLIC_SECTION_LABELS: Record<string, string> = {
  "ofertas-da-familia": "Ofertas da Família",
  promocoes: "Promoções",
  combos: "Combos",
  "combos-tradicionais": "Combos tradicionais",
  "combos-artesanais": "Combos artesanais",
  lanches: "Lanches tradicionais",
  "lanches-artesanais": "Lanches artesanais",
  "hot-dogs": "Hot Dogs",
  bebidas: "Bebidas",
};
