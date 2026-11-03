'use client';
/** R246 Admin: explicit per-product removal allowlist. Does not turn on combo checkout. */
import type {ChangeEvent} from 'react';
import type {CatalogRemovableIngredient} from '@/lib/catalogRemovableIngredients';
import {removableIngredientCandidates,parseCatalogRemovableIngredients} from '@/lib/catalogRemovableIngredients';
import styles from './CatalogRemovalOptions.module.css';
type Props=Readonly<{
 detailsItems:string;category:string;hasBundle:boolean;value:readonly CatalogRemovableIngredient[];
 onChange:(next:CatalogRemovableIngredient[])=>void;
}>;
export function CatalogRemovalOptions({detailsItems,category,hasBundle,value,onChange}:Props){
 const isEligible=category!=='bebidas'&&!hasBundle;
 let choices:readonly CatalogRemovableIngredient[]=[];
 let issue='';
 try{
  choices=removableIngredientCandidates(detailsItems.split('\n').map(s=>s.trim()).filter(Boolean));
  if(value.length)parseCatalogRemovableIngredients(value,choices.map(c=>c.label),category,hasBundle?[{}]:[]);
 }catch{issue='Revise os ingredientes e a seleção: há um nome duplicado, alterado ou inválido.';}
 if(!isEligible)return <section className={styles.root} aria-label="Ingredientes removíveis"><strong>Retirada de ingredientes</strong><small>Indisponível para bebidas e produtos que são combos. Configure nos lanches que compõem o combo.</small>{value.length>0&&<p role="alert" className={styles.warning}>Remova as permissões anteriores antes de salvar. <button type="button" onClick={()=>onChange([])}>Limpar seleção</button></p>}</section>;
 const selected=new Set(value.map(v=>v.id));
 return <section className={styles.root} aria-label="Ingredientes removíveis do produto">
  <div className={styles.heading}><strong>Ingredientes que o cliente poderá retirar</strong><span>{value.length} selecionado(s)</span></div>
  <p>Marque apenas o que a cozinha realmente consegue remover. Descrição do lanche não autoriza a retirada automaticamente.</p>
  {choices.length?<div className={styles.list}>{choices.map(item=><label key={item.id} className={styles.choice} data-selected={selected.has(item.id)}>
   <input type="checkbox" checked={selected.has(item.id)} onChange={(e:ChangeEvent<HTMLInputElement>)=>onChange(e.target.checked?[...value,item]:value.filter(v=>v.id!==item.id))}/>
   <span>{item.label}</span>
  </label>)}</div>:<small>Cadastre primeiro a composição, com um ingrediente por linha.</small>}
  {issue&&<p role="alert" className={styles.warning}>{issue}</p>}
  <small>As remoções não geram desconto. Personalização individual de combos ainda está desativada.</small>
 </section>;
}
