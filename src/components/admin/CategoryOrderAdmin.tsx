"use client";

import { useMemo, useState } from "react";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { ArrowDown, ArrowUp, Save, GripVertical } from "lucide-react";
import { db } from "@/lib/firebase";
import { useCatalogCategories } from "@/hooks/useCatalogCategories";
import { CATALOG_CATEGORIES_COLLECTION } from "@/lib/catalogCategories";
import { haptic } from "@/lib/haptics";
import styles from "./CategoryOrderAdmin.module.css";

export function CategoryOrderAdmin() {
  const { categories } = useCatalogCategories();
  const initial = useMemo(
    () => [...categories].sort((a,b)=>(a.sortOrder??999)-(b.sortOrder??999)||a.label.localeCompare(b.label,"pt-BR")),
    [categories],
  );
  const [order,setOrder]=useState<string[]>([]);
  const [busy,setBusy]=useState(false);
  const [feedback,setFeedback]=useState("");
  const ids=order.length?order:initial.map(x=>x.id);
  const map=new Map(initial.map(x=>[x.id,x]));

  const move=(id:string,delta:number)=>{
    const next=[...ids],i=next.indexOf(id),j=i+delta;
    if(i<0||j<0||j>=next.length)return;
    [next[i],next[j]]=[next[j],next[i]];
    setOrder(next);
    haptic("step");
  };

  const save=async()=>{
    if(!order.length||busy)return;
    setBusy(true);setFeedback("");
    try{
      const batch=writeBatch(db);
      ids.forEach((id,index)=>batch.set(doc(db,CATALOG_CATEGORIES_COLLECTION,id),{sortOrder:index,updatedAt:serverTimestamp()},{merge:true}));
      await batch.commit();
      setOrder([]);
      setFeedback("Ordem pública das categorias atualizada.");
      haptic("success");
    }catch(error){
      console.error("[admin/category-order]",error);
      setFeedback("Não foi possível salvar a ordem.");
      haptic("error");
    }finally{setBusy(false)}
  };

  return <section className={styles.root}>
    <header>
      <div>
        <span>ORDEM DA HOME</span>
        <strong>Categorias do cardápio</strong>
        <p>A sequência salva aqui vira a ordem pública. Produtos continuam dentro da própria categoria.</p>
      </div>
      <GripVertical size={19}/>
    </header>

    <div className={styles.list}>
      {ids.map((id,index)=>{
        const c=map.get(id);if(!c)return null;
        return <article key={id} data-inactive={c.active===false}>
          <b>{index+1}</b>
          <div>
            <strong>{c.label}</strong>
            <small>{c.active===false?"Categoria inativa":"Visível no catálogo"}</small>
          </div>
          <nav>
            <button type="button" disabled={busy||index===0} onClick={()=>move(id,-1)} aria-label={`Mover ${c.label} para cima`}><ArrowUp size={15}/></button>
            <button type="button" disabled={busy||index===ids.length-1} onClick={()=>move(id,1)} aria-label={`Mover ${c.label} para baixo`}><ArrowDown size={15}/></button>
          </nav>
        </article>
      })}
    </div>

    {feedback&&<div className={styles.feedback}>{feedback}</div>}

    <button className={styles.save} type="button" disabled={busy||!order.length} onClick={()=>void save()}>
      <Save size={15}/>{busy?"Salvando…":"Salvar ordem das categorias"}
    </button>
  </section>;
}
