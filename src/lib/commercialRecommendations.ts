import type { Product } from "@/data/products";
import type { CartItem } from "@/store/cart.store";
import { resolveBundleItems } from "@/lib/catalogComposition";

const norm=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const drinkRx=/\b(bebida|refrigerante|refri|kuat|coca|guarana|suco|agua|fanta|2l|2 l|1l|1 l|600ml|600 ml|lata)\b/;
export const isDrinkProduct=(p:Product)=>drinkRx.test(norm(`${p.category} ${p.name} ${p.description}`));
const words=(p:Product)=>norm(p.name).split(/[^a-z0-9]+/).filter(w=>w.length>=4&&!new Set(["combo","burger","burgers","lanche","lanches","familia","tradicional","artesanal","promocao","oferta"]).has(w));
const textualComposition=(p:Product)=>norm([...(p.detailsItems??[]),p.includedExtras??"",p.description??""].join(" "));

function includedIds(source:Product,products:Product[]){return new Set(resolveBundleItems(source,products).map(x=>x.product?.id).filter(Boolean) as string[])}
function alreadyIncluded(source:Product,candidate:Product,products:Product[]){
  if(includedIds(source,products).has(candidate.id)) return true;
  const text=textualComposition(source), name=norm(candidate.name);
  if(name.length>=4&&text.includes(name)) return true;
  if(isDrinkProduct(candidate)&&drinkRx.test(text)){
    const cwords=words(candidate); if(cwords.some(w=>text.includes(w))) return true;
  }
  return false;
}
function hasDrink(source:Product,products:Product[],cart:CartItem[]){
  if(isDrinkProduct(source)||drinkRx.test(textualComposition(source))) return true;
  if(resolveBundleItems(source,products).some(x=>x.product&&isDrinkProduct(x.product))) return true;
  return cart.some(x=>isDrinkProduct(x));
}
function containsProduct(candidate:Product,source:Product,products:Product[]){
  return resolveBundleItems(candidate,products).some(x=>x.product?.id===source.id) || words(source).some(w=>words(candidate).includes(w));
}
export type CommercialRecommendation={product:Product;eyebrow:string;reason:string;score:number;kind:"drink"|"upgrade"|"more"|"complement"};
const stableHash=(value:string)=>[...value].reduce((hash,char)=>((hash*31)+char.charCodeAt(0))>>>0,7);
export function getCommercialRecommendations(source:Product,products:Product[],cart:CartItem[]=[]):CommercialRecommendation[]{
  const cartIds=new Set(cart.map(x=>x.id)); const sourceDrink=hasDrink(source,products,cart); const sourceWords=words(source);
  const cartIncluded=new Set(cart.flatMap((item)=>{const owner=products.find((p)=>p.id===item.id);return owner?[...includedIds(owner,products)]:[]}));
  const cartSignature=cart
    .map((item)=>`${item.id}:${item.quantity}`)
    .sort()
    .join("|");

  const contextKey=[
    source.id,
    source.category,
    cartSignature,
  ].join("|");
  const scored=products.filter(p=>p.id!==source.id&&p.disponivel!==false&&!cartIds.has(p.id)&&!cartIncluded.has(p.id)&&!alreadyIncluded(source,p,products)).map((p):CommercialRecommendation|null=>{
    const drink=isDrinkProduct(p); const same=sourceWords.some(w=>words(p).includes(w)); const upgrade=containsProduct(p,source,products)&&Boolean(p.bundleItems?.length||p.detailsItems?.length);
    let score=0,eyebrow="VAI BEM COM SEU PEDIDO",reason="Uma opção para completar o pedido.",kind:CommercialRecommendation["kind"]="complement";
    if(drink){
      if(sourceDrink||cartIds.has(p.id)) return null;

      score=118;
      eyebrow="COMPLETE SEU PEDIDO";
      reason="Seu pedido ainda não tem bebida.";
      kind="drink";

      if(p.isSuggestion) score+=14;

      if(
        typeof p.oldPrice==="number" &&
        p.oldPrice>p.price
      ) score+=12;

      score+=stableHash(
        `${source.id}|drink|${p.id}`
      )%23;
    }
    else if(upgrade){
      score=132;
      eyebrow="LEVE MAIS";
      reason="Uma versão maior para compartilhar.";
      kind="upgrade";
    }
    else if(same){
      score=66;
      eyebrow="PARA DIVIDIR COM A GALERA";
      reason="Mais uma opção do mesmo estilo, sem repetir o que já vem no combo.";
      kind="more";
    }
    else if(p.isSuggestion){
      score=42;
      eyebrow="SUGESTÃO DA CASA";
      reason="Uma escolha que combina com seu pedido.";
    }

    if(
      p.category===source.category &&
      !drink
    ) score+=12;

    if(
      typeof p.oldPrice==="number" &&
      p.oldPrice>p.price &&
      !drink
    ) score+=18;

    score+=(
      stableHash(
        `${contextKey}|${kind}|${p.id}`
      )%29
    )/100;
    if(score<30) return null;
    return {product:p,eyebrow,reason,score,kind};
  }).filter((x):x is CommercialRecommendation=>Boolean(x)).sort((a,b)=>b.score-a.score||stableHash(contextKey+a.product.id)-stableHash(contextKey+b.product.id));
  const out:CommercialRecommendation[]=[];
  const kinds=new Set<CommercialRecommendation["kind"]>();
  const categories=new Set<string>();

  // Prioriza variedade de intenção e categoria.
  for(const item of scored){
    if(out.length>=3)break;

    if(
      kinds.has(item.kind) ||
      categories.has(item.product.category) ||
      out.some(
        x=>x.product.id===item.product.id
      )
    ) continue;

    out.push(item);
    kinds.add(item.kind);
    categories.add(item.product.category);
  }

  // Depois mantém pelo menos variedade de categoria.
  for(const item of scored){
    if(out.length>=3)break;

    if(
      categories.has(item.product.category) ||
      out.some(
        x=>x.product.id===item.product.id
      )
    ) continue;

    out.push(item);
    categories.add(item.product.category);
  }

  // Fallback para catálogos pequenos.
  for(const item of scored){
    if(out.length>=3)break;

    if(
      !out.some(
        x=>x.product.id===item.product.id
      )
    ) out.push(item);
  }

  return out;
}
