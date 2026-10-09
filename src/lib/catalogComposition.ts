import type { Product } from "@/data/products";

export type ResolvedBundleItem = {
  key: string;
  quantity: number;
  label: string;
  note?: string;
  product?: Product;
};

const norm = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
  .replace(/\b(burgers?|hot\s*dogs?)\b/g, "").replace(/\s+/g, " ").trim();

function legacy(value: string) {
  const clean=value.trim();
  const m=clean.match(/^(\d+)\s*[x×]?\s+(.+)$/i);
  const quantity=m?Math.max(1,Number(m[1])||1):1;
  let label=(m?m[2]:clean).trim();
  const gift=/\(\s*brinde\s*\)/i.test(label);
  label=label.replace(/\(\s*brinde\s*\)/gi,"").trim();
  return {quantity,label,note:gift?"Brinde":undefined};
}

function find(label:string, products:Product[], owner:string) {
  const target=norm(label);
  const list=products.filter(p=>p.id!==owner);
  return list.find(p=>norm(p.name)===target) ??
    list.find(p=>target.includes(norm(p.name)) || norm(p.name).includes(target));
}

export function resolveBundleItems(product:Product, products:Product[]):ResolvedBundleItem[] {
  if(product.bundleItems?.length) return product.bundleItems.map((item,index)=>{
    const linked=products.find(p=>p.id===item.productId);
    return {key:`${item.productId}-${index}`,quantity:Math.max(1,Math.trunc(item.quantity||1)),label:linked?.name||item.productId,note:item.note,product:linked};
  });
  const isCombo = product.category === "combos" || product.category === "promocoes" || product.id.startsWith("combo-");
  const source = isCombo ? (product.detailsItems ?? []).filter(value => /^\s*\d+\s*[x×]?\s+\S/.test(value)) : (product.detailsItems ?? []);
  const parsed=source.map(legacy);
  const resolved=parsed.map((item,index)=>({key:`legacy-${index}`,...item,product:find(item.label,products,product.id)}));
  return resolved.some(item=>item.product) ? resolved : [];
}

/** V55: validates operational bundle composition. Text is never operational authority. */
export function validateBundleItems(
  bundleItems: Array<{ productId?: string; id?: string; quantity?: number }> | undefined,
  availableProductIds?: Set<string>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const [index, item] of (bundleItems ?? []).entries()) {
    const productId = String(item?.productId ?? item?.id ?? "").trim();
    const quantity = Number(item?.quantity ?? 0);
    if (!productId) errors.push(`Componente ${index + 1}: produto obrigatório.`);
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity))
      errors.push(`Componente ${index + 1}: quantidade deve ser um inteiro maior que zero.`);
    if (productId && availableProductIds && !availableProductIds.has(productId))
      errors.push(`Componente ${index + 1}: produto "${productId}" não existe no catálogo.`);
  }
  return { valid: errors.length === 0, errors };
}
