"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { brazilDate, chooseVisualCampaign, normalizeCampaignList, type VisualCampaign } from "@/lib/visualCampaigns";

const Context=createContext<VisualCampaign|null>(null);
const CACHE_KEY="dfl-visual-campaigns-r103";
const BASE_TITLE="Da Família Lanches";

function readCached(){
 try{
  const raw=sessionStorage.getItem(CACHE_KEY);
  if(!raw)return null;
  const data=JSON.parse(raw) as {until?:number;items?:unknown};
  return data.until && data.until>Date.now()?normalizeCampaignList(data.items):null;
 }catch{return null;}
}
function millisecondsToNextBrazilMidnight(){
 const today=brazilDate();
 const next=new Date(`${today}T12:00:00Z`);
 next.setUTCDate(next.getUTCDate()+1);
 const iso=next.toISOString().slice(0,10);
 return Math.max(500,Date.parse(`${iso}T03:00:02Z`)-Date.now());
}

export function VisualCampaignProvider({children}:{children:ReactNode}){
 const pathname=usePathname();
 // Nunca ativar campanha antes de ler a configuração real: evita exibir uma promoção pausada.
 const [items,setItems]=useState<VisualCampaign[]>([]);
 const [today,setToday]=useState(()=>brazilDate());
 const active=useMemo(()=>chooseVisualCampaign(items,today),[items,today]);
 useEffect(()=>{
   let mounted=true;
   const cache=readCached();if(cache)setItems(cache);
   const refresh=async()=>{
     if(!mounted)return;
     try{
       const response=await fetch("/api/public/visual-campaigns",{headers:{accept:"application/json"}});
       if(!response.ok)throw Error("CAMPAIGN_FETCH_UNAVAILABLE");
       const data=await response.json() as {items?:unknown};
       const list=normalizeCampaignList(data.items);
       if(!mounted)return;
       setItems(list);
       sessionStorage.setItem(CACHE_KEY,JSON.stringify({until:Date.now()+120000,items:list}));
     }catch{/* Identidade visual é opcional: mantém versão local ou padrão. */}
   };
   void refresh();
   const visible=()=>{if(document.visibilityState==="visible"){
     setToday(brazilDate());if(!readCached())void refresh();
   }};
   document.addEventListener("visibilitychange",visible);
   return()=>{mounted=false;document.removeEventListener("visibilitychange",visible)};
 },[]);
 useEffect(()=>{
   const timeout=window.setTimeout(()=>setToday(brazilDate()),millisecondsToNextBrazilMidnight());
   return()=>window.clearTimeout(timeout);
 },[today]);
 useEffect(()=>{
   const root=document.documentElement;
   const keys=["background","surface","text","muted","accent","accentText","button","buttonText","badge","badgeText"] as const;
   const scopes=["header","home","offers","catalog","checkout","footer"] as const;
   if(active){
     root.dataset.dflCampaign=active.id;
     for(const key of keys)root.style.setProperty(`--dfl-campaign-${key}`,active.palette[key]);
   }else delete root.dataset.dflCampaign;
   for(const scope of scopes){
     const attr=`dflCampaign${scope.charAt(0).toUpperCase()}${scope.slice(1)}` as keyof DOMStringMap;
     if(active?.scopes.includes(scope))root.dataset[attr]="true";else delete root.dataset[attr];
   }
   return()=>{
     delete root.dataset.dflCampaign;
     for(const scope of scopes)delete root.dataset[`dflCampaign${scope.charAt(0).toUpperCase()}${scope.slice(1)}` as keyof DOMStringMap];
     for(const key of keys)root.style.removeProperty(`--dfl-campaign-${key}`);
   };
 },[active]);
 useEffect(()=>{
   if(pathname!=="/")return;
   // Apenas o título da Home; páginas de produto continuam com seus metadados.
   const title=active?.seoTitle||BASE_TITLE;
   document.title=title;
   // Espelho apenas no navegador; a metadata SSR padrão segue preservada.
   const meta=document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
   const oldDescription=meta?.content;
   if(meta&&active?.seoDescription)meta.content=active.seoDescription;
   return()=>{if(document.title===title)document.title=BASE_TITLE;if(meta&&oldDescription!==undefined)meta.content=oldDescription};
 },[pathname,active]);
 return <Context.Provider value={active}>{children}</Context.Provider>;
}
export function useVisualCampaign(){return useContext(Context);}

export function campaignMatchesCatalogOffer(c:VisualCampaign, products:ReadonlyArray<{name:string;price:number;disponivel?:boolean}>):boolean{
 if(!c.requiredOfferName)return true;
 const clean=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
 const name=clean(c.requiredOfferName);
 return products.some(p=>p.disponivel!==false&&clean(p.name).includes(name)&&
   (c.requiredOfferPrice===null||Math.abs(p.price-c.requiredOfferPrice)<.005));
}
