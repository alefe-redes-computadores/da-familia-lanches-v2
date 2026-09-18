// src/components/admin/CategoryOrderAdmin.tsx
"use client";
import { useMemo, useState } from "react";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCatalogCategories } from "@/hooks/useCatalogCategories";
import { CATALOG_CATEGORIES_COLLECTION } from "@/lib/catalogCategories";

export function CategoryOrderAdmin() {
  const { categories } = useCatalogCategories();
  const initial = useMemo(
    () => [...categories].sort((a,b)=>(a.sortOrder??999)-(b.sortOrder??999)||a.label.localeCompare(b.label,"pt-BR")),
    [categories],
  );
  const [order,setOrder]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const ids=order.length?order:initial.map(x=>x.id);
  const map=new Map(initial.map(x=>[x.id,x]));
  const move=(id:string,delta:number)=>{
    const next=[...ids],i=next.indexOf(id),j=i+delta;
    if(i<0||j<0||j>=next.length)return;
    [next[i],next[j]]=[next[j],next[i]];
    setOrder(next);
  };
  const save=async()=>{
    setBusy(true);
    try{
      const batch=writeBatch(db);
      ids.forEach((id,index)=>batch.set(doc(db,CATALOG_CATEGORIES_COLLECTION,id),{sortOrder:index,updatedAt:serverTimestamp()},{merge:true}));
      await batch.commit();
      setOrder([]);
    }finally{setBusy(false)}
  };
  return <section style={{marginTop:12,padding:14,border:"1px solid rgba(127,127,127,.22)",borderRadius:16}}>
    <strong>Ordem das categorias na Home</strong>
    <p style={{fontSize:12,opacity:.7}}>A sequência salva aqui vira a sequência pública do cardápio. Produtos continuam dentro da própria categoria.</p>
    <div style={{display:"grid",gap:6}}>
      {ids.map((id,index)=>{const c=map.get(id);if(!c)return null;return <div key={id} style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:6,alignItems:"center",padding:8,border:"1px solid rgba(127,127,127,.18)",borderRadius:10}}>
        <span>{index+1}. {c.label}{c.active===false?" · inativa":""}</span>
        <button type="button" disabled={index===0} onClick={()=>move(id,-1)}>↑</button>
        <button type="button" disabled={index===ids.length-1} onClick={()=>move(id,1)}>↓</button>
      </div>})}
    </div>
    <button type="button" disabled={busy||!order.length} onClick={()=>void save()} style={{width:"100%",minHeight:42,marginTop:10}}>{busy?"Salvando…":"Salvar ordem das categorias"}</button>
  </section>;
}
