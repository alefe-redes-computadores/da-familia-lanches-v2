"use client";
import { useMemo, useState } from "react";
import type { Product } from "@/data/products";
import { productGroupConfiguration } from "@/lib/catalogModifierGroups";
import type { CatalogCategory } from "@/lib/catalogCategories";
import { AlertTriangle, CheckCircle2, ChevronDown, Image as ImageIcon, ShieldCheck } from "lucide-react";
import styles from "./CatalogQualityPanel.module.css";

type Issue={id:string;name:string;category:string;severity:"attention"|"review";message:string};
function key(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\s+/g," ").trim()}
/** Diagnóstico read-only sobre catálogo já carregado; nenhuma consulta ou alteração Firebase. */
export function CatalogQualityPanel({products,categories}:{products:Product[];categories:CatalogCategory[]}){
 const [expanded,setExpanded]=useState(false);
 const [severity,setSeverity]=useState<"all"|"attention"|"review">("all");
 const [query,setQuery]=useState("");
 const [pageSize,setPageSize]=useState(25);
 const issues=useMemo(()=>{
  const out:Issue[]=[];const seen=new Set<string>();const categoryMap=new Map(categories.map(c=>[c.id,c]));
  const addPolicy=(p:Product,message:string)=>out.push({id:p.id,name:p.name,category:p.category,severity:"attention",message});
  const available=new Map(products.map(p=>[p.id,p]));
  for(const product of products){
   const min=product.minAddonSelections??0,max=product.maxAddonSelections??20;
   if(!Number.isInteger(min)||!Number.isInteger(max)||min<0||max>20||min>max)addPolicy(product,"Limites de adicionais inconsistentes");
   if(product.category==="bebidas"&&min>0)addPolicy(product,"Bebida exige adicionais, mas bebidas não aceitam extras");
   const add=(severity:Issue["severity"],message:string)=>out.push({id:product.id,name:product.name,category:product.category,severity,message});
   const groupCheck=productGroupConfiguration(product);
   if(!groupCheck.valid)add("attention",`Grupos de escolhas: ${groupCheck.reason}`);
   for(const group of groupCheck.groups){
     for(const addonId of group.addonIds){
       if(product.addonIds&&!product.addonIds.includes(addonId))add("attention",`${group.title}: opção não permitida para o produto (${addonId})`);
     }
   }
   const duplicate=`${product.category}:${key(product.name)}`;
   if(seen.has(duplicate))add("attention","Nome repetido na mesma categoria"); else seen.add(duplicate);
   if(!product.image?.trim())add("attention","Produto sem foto");
   if(!product.description?.trim())add("attention","Descrição ausente");
   else if(product.description.trim().length<18)add("review","Descrição muito curta");
   if(!Number.isFinite(product.price)||product.price<0)add("attention","Preço inválido");
   else if(product.price===0)add("review","Produto com preço zero — confirme se é intencional");
   if(product.oldPrice!=null&&product.oldPrice<=product.price)add("review","Preço antigo não supera o atual");
   if(product.disponivel!==false&&categoryMap.get(product.category)?.active===false)add("review","Produto disponível dentro de categoria oculta");
   if(!categoryMap.has(product.category))add("attention","Categoria não encontrada");
   if(product.promoPlacement==="home_showcase"&&!(product.oldPrice!=null&&product.oldPrice>product.price))add("review","Destaque em Ofertas sem economia exibível");
   for(const part of product.bundleItems??[]){
    if(!available.has(part.productId))add("attention",`Combo vinculado a item inexistente: ${part.productId}`);
    else if(available.get(part.productId)?.disponivel===false)add("review",`Combo contém item pausado: ${available.get(part.productId)?.name??part.productId}`);
   }
  }
  return out.sort((a,b)=>Number(b.severity==="attention")-Number(a.severity==="attention")||a.name.localeCompare(b.name,"pt-BR"));
 },[products,categories]);
 const attention=issues.filter(i=>i.severity==="attention").length;
 const filtered=useMemo(()=>{
   const terms=key(query).split(" ").filter(Boolean);
   return issues.filter(item=>(severity==="all"||item.severity===severity)&&terms.every(term=>key(item.name+" "+item.category+" "+item.message).includes(term)));
 },[issues,severity,query]);
 const visible=filtered.slice(0,pageSize);
 return <section className={styles.root} aria-label="Saúde do catálogo">
  <button type="button" className={styles.header} onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>
   <span className={styles.symbol}>{issues.length?<AlertTriangle size={19}/>:<ShieldCheck size={19}/>}</span>
   <span className={styles.copy}><small>QUALIDADE DO CARDÁPIO</small><strong>{issues.length?`${issues.length} pontos para revisar`:"Catálogo sem pendências detectadas"}</strong><em>{issues.length?`${attention} prioritários · análise local, sem alterar produtos`:"Fotos, preços e vínculos básicos conferidos"}</em></span>
   <ChevronDown className={styles.chevron} size={18} aria-hidden="true"/>
  </button>
  {expanded&&<div className={styles.content}>
   <p>Auditoria automática do conteúdo já carregado. Pode haver exceções legítimas; revise antes de editar. Nenhum item será alterado por este painel.</p>
   {issues.length>0&&<>
     <div className={styles.filters} role="group" aria-label="Filtrar pendências do catálogo">{([ ["all","Todos"], ["attention","Prioritários"], ["review","Revisar"] ] as const).map(([kind,label])=><button key={kind} type="button" aria-pressed={severity===kind} onClick={()=>{setSeverity(kind);setPageSize(25)}}>{label} <b>{kind==="all"?issues.length:kind==="attention"?attention:issues.length-attention}</b></button>)}</div>
     <label className={styles.searchLabel}>Buscar pendência<input value={query} onChange={event=>{setQuery(event.target.value);setPageSize(25)}} placeholder="Produto, categoria ou motivo" /></label>
     <small className={styles.resultCount} role="status">{filtered.length} pendência(s) encontradas</small>
   </>}
   {issues.length?<div className={styles.issues}>{visible.map((item,index)=><article key={`${item.id}-${index}`} data-severity={item.severity}>
    <span aria-hidden="true">{item.severity==="attention"?<AlertTriangle size={15}/>:<ImageIcon size={15}/>}</span>
    <div><strong>{item.name}</strong><small>{item.message}</small></div>
   </article>)}{filtered.length>visible.length&&<button className={styles.more} type="button" onClick={()=>setPageSize(current=>current+25)}>Exibir mais {Math.min(25,filtered.length-visible.length)} de {filtered.length-visible.length}</button>}{filtered.length===0&&<div className={styles.clean}>Nenhum problema com estes filtros.</div>}</div>:<div className={styles.clean}><CheckCircle2 size={18}/>Nenhuma inconsistência básica encontrada.</div>}
  </div>}
 </section>;
}
