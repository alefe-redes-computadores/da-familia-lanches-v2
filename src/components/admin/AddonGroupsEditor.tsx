"use client";
import type { Addon } from "@/data/addons";
import type { AddonChoiceGroup } from "@/lib/catalogModifierGroups";
import { parseAddonGroups } from "@/lib/catalogModifierGroups";
import styles from "./AddonGroupsEditor.module.css";

type Props={value:AddonChoiceGroup[];addons:Addon[];onChange:(value:AddonChoiceGroup[])=>void};
export function AddonGroupsEditor({value,addons,onChange}:Props){
 const update=(index:number,patch:Partial<AddonChoiceGroup>)=>onChange(value.map((g,i)=>i===index?{...g,...patch}:g));
 const used=new Set(value.flatMap(g=>g.addonIds));
 const check=parseAddonGroups(value);
 return <section className={styles.root} aria-label="Grupos de escolhas do produto">
  <div className={styles.top}><div><strong>Grupos de escolhas</strong><p>Bebida obrigatória, molho opcional ou extras com limites próprios. Reutiliza os adicionais existentes e seus preços oficiais.</p></div>
   <button type="button" disabled={value.length>=8} onClick={()=>{const suffix=typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID().slice(0,12):`${Date.now()}${value.length}`;onChange([...value,{id:`grupo-${suffix}`,title:"Novo grupo",min:0,max:1,addonIds:[]}]);}}>+ Grupo</button>
  </div>
  {value.map((group,index)=><div className={styles.group} key={group.id}>
    <div className={styles.head}><strong>Grupo {index+1}</strong><button type="button" onClick={()=>onChange(value.filter((_,i)=>i!==index))}>Remover</button></div>
    <label className={styles.title}>Nome do grupo<input maxLength={70} value={group.title} onChange={event=>update(index,{title:event.target.value})} placeholder="Ex.: Escolha a bebida"/></label>
    <div className={styles.limits}><label>Mínimo<input aria-label={`Mínimo para ${group.title}`} type="number" inputMode="numeric" min="0" max="20" value={group.min} onChange={event=>update(index,{min:event.target.value===""?-1:Number(event.target.value)})}/></label><label>Máximo<input aria-label={`Máximo para ${group.title}`} type="number" inputMode="numeric" min="1" max="20" value={group.max} onChange={event=>update(index,{max:event.target.value===""?-1:Number(event.target.value)})}/></label></div>
    <small>Inclua opções que já existem em Adicionais. Cada opção pode integrar apenas um grupo.</small>
    <div className={styles.options}>{addons.map(addon=>{const selected=group.addonIds.includes(addon.id);const taken=used.has(addon.id)&&!selected;return <label key={addon.id} data-selected={selected} data-disabled={taken||addon.disponivel===false}><input type="checkbox" disabled={taken||addon.disponivel===false} checked={selected} onChange={()=>update(index,{addonIds:selected?group.addonIds.filter(id=>id!==addon.id):[...group.addonIds,addon.id]})}/><span>{addon.name}</span><small>{addon.price.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</small></label>})}</div>
    {group.min>group.addonIds.length&&<p className={styles.warning}>O mínimo é maior que as opções disponíveis neste grupo.</p>}
  </div>)}
  {!check.valid&&value.length>0&&<p role="alert" className={styles.warning}>{check.reason}</p>}
  {!value.length&&<p className={styles.empty}>Sem grupos: o produto mantém a escolha livre com as regras gerais da R4.</p>}
 </section>;
}
