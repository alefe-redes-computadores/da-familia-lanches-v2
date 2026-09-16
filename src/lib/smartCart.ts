import type { Product } from "@/data/products";
import type { CartItem } from "@/store/cart.store";
import { resolveBundleItems } from "@/lib/catalogComposition";

export type SmartCartSuggestion = {
  kind: "drink" | "combo" | "complement";
  product: Product;
  eyebrow: string;
  title: string;
  description: string;
  saving?: number;
};

const norm = (value: unknown) => String(value ?? "").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const isDrink = (product: Product) => {
  const text = norm(`${product.category} ${product.name} ${product.description ?? ""}`);
  return /\b(bebida|bebidas|refrigerante|refri|kuat|coca|guarana|suco|agua|2l|2 l|600ml|600 ml|lata)\b/.test(text);
};
const isCombo = (product: Product) => Boolean(product.bundleItems?.length);
const qty = (items: CartItem[], id: string) =>
  items.filter((item) => item.id === id).reduce((sum,item) => sum + item.quantity, 0);

function hasDrink(items: CartItem[], products: Product[]) {
  return items.some((item) => {
    if (isDrink(item)) return true;
    const owner=products.find((product)=>product.id===item.id);
    return owner ? resolveBundleItems(owner,products).some((part)=>part.product && isDrink(part.product)) : false;
  });
}

function matchingCombo(combo: Product, items: CartItem[], products: Product[]) {
  const parts=resolveBundleItems(combo,products).filter((part)=>part.product && norm(part.note)!=="brinde");
  if(!parts.length) return null;
  let separate=0;
  for(const part of parts){
    if(!part.product || qty(items,part.product.id)<part.quantity) return null;
    separate += part.product.price * part.quantity;
  }
  return separate>combo.price ? {saving:separate-combo.price} : null;
}

export function selectSmartCartSuggestions(items: CartItem[], products: Product[], limit=3): SmartCartSuggestion[] {
  if(!items.length) return [];
  const available=products.filter((product)=>product.disponivel!==false && !items.some((item)=>item.id===product.id));
  const result: SmartCartSuggestion[]=[];

  const combos=available.filter(isCombo)
    .map((product)=>({product,match:matchingCombo(product,items,products)}))
    .filter((entry): entry is {product:Product;match:{saving:number}}=>Boolean(entry.match))
    .sort((a,b)=>b.match.saving-a.match.saving);
  if(combos[0]) result.push({
    kind:"combo",product:combos[0].product,eyebrow:"PODE COMPENSAR MAIS",
    title:combos[0].product.name,description:"Os itens que você escolheu também aparecem neste combo.",
    saving:combos[0].match.saving
  });

  if(!hasDrink(items,products)){
    const drink=available.filter(isDrink)
      .sort((a,b)=>Number(Boolean(b.isSuggestion))-Number(Boolean(a.isSuggestion)) || a.price-b.price)[0];
    if(drink) result.push({
      kind:"drink",product:drink,eyebrow:"FALTOU A BEBIDA?",title:drink.name,
      description:"Seu pedido ainda não tem bebida. Esta opção combina com o carrinho."
    });
  }

  if(result.length<limit){
    const extra=available.find((product)=>product.isSuggestion && !isCombo(product) && !isDrink(product) &&
      !result.some((entry)=>entry.product.id===product.id));
    if(extra) result.push({
      kind:"complement",product:extra,eyebrow:"PARA COMPLETAR",title:extra.name,
      description:"Uma sugestão da casa para completar seu pedido."
    });
  }
  return result.slice(0,limit);
}
