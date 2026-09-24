import type { MetadataRoute } from "next";
import { products } from "@/data/products";
import { productHref } from "@/lib/productRoutes";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://dafamilialanches.com.br";
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    ...products.filter((product) => product.disponivel !== false).map((product) => ({
      url: `${base}${productHref(product)}`,
      changeFrequency: "weekly" as const,
      priority: product.promoPlacement === "home_showcase" ? 0.9 : 0.7,
    })),
  ];
}
