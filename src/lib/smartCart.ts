import type { Product } from "@/data/products";
import type { CartItem } from "@/store/cart.store";
import { resolveBundleItems } from "@/lib/catalogComposition";

export type SmartCartSuggestion = {
  kind: "upsell" | "drink" | "combo" | "complement";
  product: Product;
  eyebrow: string;
  title: string;
  description: string;
  saving?: number;
  upsellSourceId?: string;
  explicitUnitPrice?: number;
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

function includedProductIds(items: CartItem[], products: Product[]) {
  const ids=new Set<string>();
  for(const item of items){
    const owner=products.find(product=>product.id===item.id);
    if(!owner) continue;
    for(const part of resolveBundleItems(owner,products)){
      if(part.product) ids.add(part.product.id);
    }
  }
  return ids;
}

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
  const included=includedProductIds(items,products);
  const available=products.filter((product)=>product.disponivel!==false && !items.some((item)=>item.id===product.id));
  const result: SmartCartSuggestion[]=[];
  for(const sourceItem of items){
    const source=products.find(p=>p.id===sourceItem.id);
    if(!source?.upsellProductId || source.upsellUnitPrice==null) continue;
    const target=products.find(p=>p.id===source.upsellProductId && p.disponivel!==false);
    if(!target || source.upsellUnitPrice<0 || source.upsellUnitPrice>=target.price) continue;
    const used=items.filter(i=>i.id===target.id&&i.upsellSourceId===source.id).reduce((n,i)=>n+i.quantity,0);
    if(used>=sourceItem.quantity) continue;
    result.push({kind:"upsell",product:target,eyebrow:"PREÇO ESPECIAL COM SEU COMBO",title:"+1 "+target.name+" por "+source.upsellUnitPrice.toLocaleString("pt-BR",{style:"currency",currency:"BRL"}),description:"Oferta vinculada a "+source.name+".",saving:target.price-source.upsellUnitPrice,upsellSourceId:source.id,explicitUnitPrice:source.upsellUnitPrice});
    break;
  }

  const combos=available.filter(isCombo)
    .map((product)=>({product,match:matchingCombo(product,items,products)}))
    .filter((entry): entry is {product:Product;match:{saving:number}}=>Boolean(entry.match))
    .sort((a,b)=>b.match.saving-a.match.saving);
  if(combos[0]) result.push({
    kind:"combo",product:combos[0].product,eyebrow:"PODE COMPENSAR MAIS",
    title:combos[0].product.name,description:"Os mesmos itens aparecem neste combo por um valor menor.",
    saving:combos[0].match.saving
  });

  if(!hasDrink(items,products)){
    const drink=available.filter(product=>isDrink(product) && !included.has(product.id))
      .sort((a,b)=>Number(Boolean(b.isSuggestion))-Number(Boolean(a.isSuggestion)) || a.price-b.price)[0];
    if(drink) result.push({
      kind:"drink",product:drink,eyebrow:"FALTOU A BEBIDA?",title:drink.name,
      description:"Seu pedido ainda não tem bebida. Esta opção combina com o carrinho."
    });
  }

  if(result.length<limit){
    const extra=available.find((product)=>product.isSuggestion && !isCombo(product) && !isDrink(product) &&
      !included.has(product.id) && !result.some((entry)=>entry.product.id===product.id));
    if(extra) result.push({
      kind:"complement",product:extra,eyebrow:"PARA COMPLETAR",title:extra.name,
      description:"Uma sugestão da casa para completar seu pedido."
    });
  }
  const priority:Record<SmartCartSuggestion["kind"],number>={upsell:0,combo:1,drink:2,complement:3};
  return result
    .filter((entry,index,list)=>list.findIndex(candidate=>candidate.kind===entry.kind&&candidate.product.id===entry.product.id)===index)
    .sort((a,b)=>priority[a.kind]-priority[b.kind])
    .slice(0,limit);
}
