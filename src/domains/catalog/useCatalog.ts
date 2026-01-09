import { useMemo, useState } from "react";
import type { CatalogCategory, Product } from "./types";
import { mockProducts } from "./mockProducts";

export type CatalogTab = {
  id: CatalogCategory;
  label: string;
};

const TABS: CatalogTab[] = [
  { id: "burger", label: "Burgers" },
  { id: "hotdog", label: "Hot Dogs" },
  { id: "combo", label: "Combos" },
  { id: "promo", label: "Promoções" },
  { id: "drink", label: "Bebidas" },
];

function normalizeCategory(input: string | null | undefined): CatalogCategory | null {
  if (!input) return null;

  const v = input.trim().toLowerCase();

  // já veio no formato certo
  if (v === "burger" || v === "hotdog" || v === "combo" || v === "promo" || v === "drink") {
    return v;
  }

  // veio como label (PT-BR)
  if (v === "burgers" || v === "burgeres" || v === "hamburgers" || v === "hambúrgueres") return "burger";
  if (v === "hot dogs" || v === "hotdogs") return "hotdog";
  if (v === "combos") return "combo";
  if (v === "promoções" || v === "promocoes" || v === "promos" || v === "promoções ") return "promo";
  if (v === "bebidas" || v === "drinks") return "drink";

  return null;
}

function matchesSearch(p: Product, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const name = (p.name ?? "").toLowerCase();
  const desc = (p.description ?? "").toLowerCase();
  const tags = (p.tags ?? []).join(" ").toLowerCase();

  return name.includes(q) || desc.includes(q) || tags.includes(q);
}

export function useCatalog() {
  const [selectedCategory, setSelectedCategory] = useState<string>("burger");
  const [search, setSearch] = useState<string>("");

  const products = mockProducts;

  const filteredProducts = useMemo(() => {
    const normalized = normalizeCategory(selectedCategory);

    return products.filter((p) => {
      const okCategory = !normalized ? true : p.category === normalized;
      const okSearch = matchesSearch(p, search);
      return okCategory && okSearch;
    });
  }, [products, selectedCategory, search]);

  return {
    // estado
    selectedCategory,
    search,

    // setters
    setSelectedCategory,
    setSearch,

    // dados
    products,
    filteredProducts,
    categories: TABS,
  };
}