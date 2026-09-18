// src/components/admin/CatalogOrganizerAdmin.tsx
"use client";
import{useMemo,useState}from"react";
import{doc,serverTimestamp,writeBatch}from"firebase/firestore";
import{db}from"@/lib/firebase";
import{useCatalog}from"@/hooks/useCatalog";
import{useCatalogCategories}from"@/hooks/useCatalogCategories";
import{CATALOG_PRODUCTS_COLLECTION}from"@/lib/catalog";
import styles from"./CatalogOrganizerAdmin.module.css";
import { CategoryOrderAdmin } from "@/components/admin/CategoryOrderAdmin";
type SortMode="manual"|"price-asc"|"price-desc"|"alpha";
export function CatalogOrganizerAdmin(){
 const{products}=useCatalog();const{categories}=useCatalogCategories();const[category,setCategory]=useState(""),[mode,setMode]=useState<SortMode>("manual"),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 const active=category||categories.find(c=>c.active)?.id||categories[0]?.id||"";
 const rows=useMemo(()=>[...products.filter(p=>p.category===active)].sort((a,b)=>mode==="price-asc"?a.price-b.price||a.name.localeCompare(b.name,"pt-BR"):mode==="price-desc"?b.price-a.price||a.name.localeCompare(b.name,"pt-BR"):mode==="alpha"?a.name.localeCompare(b.name,"pt-BR"):(a.sortOrder??Number.MAX_SAFE_INTEGER)-(b.sortOrder??Number.MAX_SAFE_INTEGER)||a.name.localeCompare(b.name,"pt-BR")),[products,active,mode]);
 const persist=async(next=rows)=>{if(!active||!next.length)return;setBusy(true);setMsg("");try{const batch=writeBatch(db);next.forEach((p,i)=>batch.set(doc(db,CATALOG_PRODUCTS_COLLECTION,p.id),{sortOrder:(i+1)*10,updatedAt:serverTimestamp()},{merge:true}));await batch.commit();setMode("manual");setMsg("Ordem pública salva nesta categoria.")}catch(e){console.error(e);setMsg("Falha ao salvar a ordem.")}finally{setBusy(false)}};
 const move=(id:string,dir:-1|1)=>{const i=rows.findIndex(p=>p.id===id),j=i+dir;if(i<0||j<0||j>=rows.length)return;const next=[...rows];[next[i],next[j]]=[next[j],next[i]];void persist(next)};
 return <section className={styles.root}><CategoryOrderAdmin /><header><span>ORGANIZAÇÃO DO CARDÁPIO</span><h3>Sequência por categoria</h3><p>A Home continua separada por categoria. Aqui você controla a ordem dentro de cada grupo.</p></header>
 <div className={styles.controls}><label>Categoria<select value={active} onChange={e=>{setCategory(e.target.value);setMode("manual")}}>{categories.map(c=><option key={c.id} value={c.id}>{c.label}{c.active?"":" · oculta"}</option>)}</select></label>
 <label>Organizar<select value={mode} onChange={e=>setMode(e.target.value as SortMode)}><option value="manual">Ordem atual</option><option value="price-asc">Mais barato → mais caro</option><option value="price-desc">Mais caro → mais barato</option><option value="alpha">A → Z</option></select></label><button disabled={busy||mode==="manual"} onClick={()=>void persist()}>{busy?"Salvando…":"Aplicar ordem"}</button></div>
 <div className={styles.list}>{rows.map((p,i)=><article key={p.id} data-paused={!p.disponivel}><b>{i+1}</b><img src={p.image} alt=""/><div><strong>{p.name}</strong><span>{p.price.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})} · {p.disponivel?"Ativo":"Pausado"}</span></div><nav><button disabled={busy||i===0} onClick={()=>move(p.id,-1)}>↑</button><button disabled={busy||i===rows.length-1} onClick={()=>move(p.id,1)}>↓</button></nav></article>)}</div>{msg&&<div className={styles.msg}>{msg}</div>}</section>
}
