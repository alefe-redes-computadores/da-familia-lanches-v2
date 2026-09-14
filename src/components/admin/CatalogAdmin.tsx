"use client";

import { useMemo, useState } from "react";
import { doc, serverTimestamp, setDoc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { products as fallbackProducts, type Product, type ProductCategory } from "@/data/products";
import { ADDONS as fallbackAddons, type Addon } from "@/data/addons";
import { useCatalog } from "@/hooks/useCatalog";
import { CATALOG_ADDONS_COLLECTION, CATALOG_PRODUCTS_COLLECTION } from "@/lib/catalog";
import styles from "./CatalogAdmin.module.css";

const CATEGORIES: Array<{ value: ProductCategory; label: string }> = [
  { value: "promocoes", label: "Promoções" }, { value: "combos", label: "Combos" },
  { value: "tradicionais", label: "Tradicionais" }, { value: "artesanais", label: "Artesanais" },
  { value: "hotdogs", label: "Hot dogs" }, { value: "bebidas", label: "Bebidas" },
];

type Draft = {
  name:string; description:string; price:string; oldPrice:string; image:string;
  category:ProductCategory; disponivel:boolean; isSuggestion:boolean; sortOrder:string; addonIds?:string[];
};

const draftFrom=(p:Product):Draft=>({name:p.name,description:p.description,price:String(p.price),oldPrice:p.oldPrice==null?"":String(p.oldPrice),image:p.image,category:p.category,disponivel:p.disponivel,isSuggestion:Boolean(p.isSuggestion),sortOrder:p.sortOrder==null?"":String(p.sortOrder),addonIds:p.addonIds});
const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

export function CatalogAdmin(){
  const {products,addons,source,remoteProducts,remoteAddons,loading}=useCatalog();
  const [editing,setEditing]=useState<Product|null>(null);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [addonDraft,setAddonDraft]=useState<Addon|null>(null);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");
  const [search,setSearch]=useState("");

  const filtered=useMemo(()=>{const t=search.trim().toLocaleLowerCase("pt-BR");return products.filter(p=>!t||p.name.toLocaleLowerCase("pt-BR").includes(t)||p.category.includes(t))},[products,search]);

  const saveProduct=async()=>{
    if(!editing||!draft)return;
    const price=Number(draft.price.replace(",","."));
    const oldPrice=draft.oldPrice.trim()?Number(draft.oldPrice.replace(",",".")):null;
    const sortOrder=draft.sortOrder.trim()?Number(draft.sortOrder):null;
    if(!draft.name.trim()||!draft.description.trim()||!draft.image.trim()||!Number.isFinite(price)||price<0){setMessage("Revise nome, descrição, imagem e preço.");return}
    if(oldPrice!==null&&(!Number.isFinite(oldPrice)||oldPrice<0)){setMessage("Preço anterior inválido.");return}
    setBusy(editing.id);
    try{
      await setDoc(doc(db,CATALOG_PRODUCTS_COLLECTION,editing.id),{
        id:editing.id,name:draft.name.trim(),description:draft.description.trim(),price,oldPrice,
        image:draft.image.trim(),category:draft.category,disponivel:draft.disponivel,isSuggestion:draft.isSuggestion,
        sortOrder:sortOrder!==null&&Number.isFinite(sortOrder)?sortOrder:null,
        addonIds:draft.category==="bebidas"?[]:draft.addonIds??null,updatedAt:serverTimestamp()
      },{merge:true});
      setEditing(null);setDraft(null);setMessage("Produto salvo no catálogo remoto.");
    }catch(e){console.error(e);setMessage("Não foi possível salvar. Confirme se as regras do Firestore foram publicadas.");}
    finally{setBusy("")}
  };

  const toggleProduct=async(p:Product)=>{
    setBusy(p.id);
    try{
      await setDoc(doc(db,CATALOG_PRODUCTS_COLLECTION,p.id),{
        id:p.id,name:p.name,description:p.description,price:p.price,oldPrice:p.oldPrice??null,image:p.image,category:p.category,
        disponivel:!p.disponivel,isSuggestion:Boolean(p.isSuggestion),sortOrder:p.sortOrder??null,addonIds:p.addonIds??null,updatedAt:serverTimestamp()
      },{merge:true});
      setMessage(p.disponivel?"Produto pausado.":"Produto reativado.");
    }catch(e){console.error(e);setMessage("Falha ao alterar disponibilidade. Verifique as regras publicadas.");}
    finally{setBusy("")}
  };

  const seed=async()=>{
    setBusy("seed");setMessage("");
    try{
      const batch=writeBatch(db);
      fallbackProducts.forEach((p,i)=>batch.set(doc(db,CATALOG_PRODUCTS_COLLECTION,p.id),{...p,oldPrice:p.oldPrice??null,isSuggestion:Boolean(p.isSuggestion),sortOrder:p.sortOrder??i,addonIds:p.addonIds??null,migratedFromFallback:true,updatedAt:serverTimestamp()},{merge:true}));
      fallbackAddons.forEach((a,i)=>batch.set(doc(db,CATALOG_ADDONS_COLLECTION,a.id),{...a,disponivel:a.disponivel!==false,sortOrder:a.sortOrder??i,migratedFromFallback:true,updatedAt:serverTimestamp()},{merge:true}));
      await batch.commit();setMessage("Catálogo atual sincronizado. O fallback local continua preservado.");
    }catch(e){console.error(e);setMessage("Migração não executada. Publique primeiro as regras do Firestore.");}
    finally{setBusy("")}
  };

  const saveAddon=async()=>{
    if(!addonDraft)return;
    const price=Number(addonDraft.price);
    if(!addonDraft.name.trim()||!Number.isFinite(price)||price<0){setMessage("Revise nome e preço do adicional.");return}
    setBusy("addon");
    try{
      await setDoc(doc(db,CATALOG_ADDONS_COLLECTION,addonDraft.id),{id:addonDraft.id,name:addonDraft.name.trim(),price,disponivel:addonDraft.disponivel!==false,sortOrder:addonDraft.sortOrder??null,updatedAt:serverTimestamp()},{merge:true});
      setAddonDraft(null);setMessage("Adicional atualizado.");
    }catch(e){console.error(e);setMessage("Não foi possível salvar o adicional.");}
    finally{setBusy("")}
  };

  if(loading)return <div className={styles.state}>Carregando catálogo...</div>;

  return <div className={styles.root}>
    <section className={styles.summary}>
      <div><span>FONTE ATUAL</span><strong>{source==="hybrid"?"Catálogo híbrido ativo":"Fallback local ativo"}</strong><p>{remoteProducts} produtos e {remoteAddons} adicionais com versão remota.</p></div>
      <button onClick={seed} disabled={busy==="seed"}>{busy==="seed"?"Sincronizando...":"Sincronizar catálogo atual"}</button>
    </section>
    {message&&<div className={styles.message}>{message}<button onClick={()=>setMessage("")}>×</button></div>}
    <div className={styles.toolbar}><div><span>PRODUTOS</span><strong>{products.length} itens no cardápio</strong></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar produto"/></div>
    <div className={styles.products}>{filtered.map(p=><article className={styles.product} key={p.id} data-off={!p.disponivel}>
      <img src={p.image} alt=""/>
      <div className={styles.productInfo}><div className={styles.productTitle}><div><strong>{p.name}</strong><span>{CATEGORIES.find(c=>c.value===p.category)?.label}</span></div>{p.isSuggestion&&<b>Sugestão</b>}</div><p>{p.description}</p><div className={styles.productBottom}><strong>{money(p.price)}</strong><span>{p.disponivel?"Disponível":"Indisponível"}</span></div></div>
      <div className={styles.actions}><button onClick={()=>toggleProduct(p)} disabled={busy===p.id}>{p.disponivel?"Pausar":"Ativar"}</button><button className={styles.primary} onClick={()=>{setEditing(p);setDraft(draftFrom(p));setAddonDraft(null);setMessage("")}}>Editar</button></div>
    </article>)}</div>

    <section className={styles.addonsPanel}><div className={styles.toolbar}><div><span>ADICIONAIS</span><strong>{addons.length} adicionais ativos</strong></div></div><div className={styles.addonGrid}>{addons.map(a=><button key={a.id} className={styles.addonCard} onClick={()=>setAddonDraft({...a})}><span>{a.name}</span><b>{money(a.price)}</b></button>)}</div></section>

    {editing&&draft&&<div className={styles.overlay} onMouseDown={e=>e.target===e.currentTarget&&setEditing(null)}><section className={styles.editor}>
      <div className={styles.editorHead}><div><span>EDITAR PRODUTO</span><h3>{editing.name}</h3></div><button onClick={()=>setEditing(null)}>×</button></div>
      <div className={styles.form}>
        <label className={styles.full}>Nome<input value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
        <label className={styles.full}>Descrição<textarea value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
        <label>Preço<input inputMode="decimal" value={draft.price} onChange={e=>setDraft({...draft,price:e.target.value})}/></label>
        <label>Preço anterior<input inputMode="decimal" value={draft.oldPrice} onChange={e=>setDraft({...draft,oldPrice:e.target.value})}/></label>
        <label>Categoria<select value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value as ProductCategory})}>{CATEGORIES.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label>
        <label>Ordem<input inputMode="numeric" value={draft.sortOrder} onChange={e=>setDraft({...draft,sortOrder:e.target.value})} placeholder="Automática"/></label>
        <label className={styles.full}>Imagem / caminho<input value={draft.image} onChange={e=>setDraft({...draft,image:e.target.value})}/></label>
      </div>
      <div className={styles.switches}><button data-on={draft.disponivel} onClick={()=>setDraft({...draft,disponivel:!draft.disponivel})}><i/>Disponível</button><button data-on={draft.isSuggestion} onClick={()=>setDraft({...draft,isSuggestion:!draft.isSuggestion})}><i/>Sugestão da casa</button></div>
      {draft.category!=="bebidas"&&<div className={styles.addonPicker}><div><strong>Adicionais permitidos</strong><span>{draft.addonIds===undefined?"Modo legado: todos":`${draft.addonIds.length} selecionados`}</span></div><button className={styles.legacy} onClick={()=>setDraft({...draft,addonIds:undefined})}>Permitir todos</button><div className={styles.checks}>{addons.map(a=>{const checked=draft.addonIds===undefined||draft.addonIds.includes(a.id);return <label key={a.id}><input type="checkbox" checked={checked} onChange={()=>{const base=draft.addonIds===undefined?addons.map(x=>x.id):draft.addonIds;setDraft({...draft,addonIds:checked?base.filter(id=>id!==a.id):[...base,a.id]})}}/>{a.name}</label>})}</div></div>}
      <div className={styles.editorActions}><button onClick={()=>setEditing(null)}>Cancelar</button><button className={styles.save} onClick={saveProduct} disabled={busy===editing.id}>{busy===editing.id?"Salvando...":"Salvar produto"}</button></div>
    </section></div>}

    {addonDraft&&<div className={styles.overlay} onMouseDown={e=>e.target===e.currentTarget&&setAddonDraft(null)}><section className={styles.smallEditor}>
      <div className={styles.editorHead}><div><span>ADICIONAL</span><h3>Editar adicional</h3></div><button onClick={()=>setAddonDraft(null)}>×</button></div>
      <label>Nome<input value={addonDraft.name} onChange={e=>setAddonDraft({...addonDraft,name:e.target.value})}/></label>
      <label>Preço<input inputMode="decimal" value={addonDraft.price} onChange={e=>setAddonDraft({...addonDraft,price:Number(e.target.value.replace(",","."))||0})}/></label>
      <button className={styles.availability} data-on={addonDraft.disponivel!==false} onClick={()=>setAddonDraft({...addonDraft,disponivel:addonDraft.disponivel===false})}>{addonDraft.disponivel===false?"Reativar adicional":"Marcar indisponível"}</button>
      <div className={styles.editorActions}><button onClick={()=>setAddonDraft(null)}>Cancelar</button><button className={styles.save} onClick={saveAddon} disabled={busy==="addon"}>Salvar</button></div>
    </section></div>}
  </div>;
}
