import type { Product } from "@/data/products";
function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
export function productLeadDescription(product: Product): string {
  const description=String(product.description??"").trim(); const details=product.detailsItems??[];
  if(!description||!details.length||product.bundleItems?.length)return description;
  const normalizedDescription=normalize(description); const meaningful=details.map(item=>normalize(String(item))).filter(item=>item.length>=3);
  if(!meaningful.length)return description;
  const hits=meaningful.filter(item=>normalizedDescription.includes(item)).length;
  const looksLikeIngredientList=hits>=Math.min(3,meaningful.length)&&hits/meaningful.length>=0.55;
  return looksLikeIngredientList?"":description;
}
