export type CatalogCategory = "burger" | "hotdog" | "combo" | "promo" | "drink";

export type ProductTag = string;

export interface Product {
  id: string;
  name: string;
  category: CatalogCategory;
  price: number;

  description?: string;
  tags?: ProductTag[];

  /**
   * Promoções (opcional)
   * - oldPrice: preço riscado
   * - image: caminho relativo em /public
   */
  oldPrice?: number;
  image?: string;
}