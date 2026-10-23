"use client";
import type { Addon } from "@/data/addons";
import type { AddonChoiceGroup } from "@/lib/catalogModifierGroups";
import styles from "./AddonGroupsChoices.module.css";
const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
export function AddonGroupsChoices({groups,addons,selected,onToggle}:{groups:AddonChoiceGroup[];addons:Addon[];selected:readonly string[];onToggle:(addon:Addon)=>void}){
 const included=new Set(groups.flatMap(g=>g.addonIds));
 const renderOption=(a:Addon)=>{const active=selected.includes(a.id);return <button type="button" aria-pressed={active} key={a.id} className={styles.choice} data-on={active} onClick={()=>onToggle(a)}><span aria-hidden="true">{active?"✓":"+"}</span><strong>{a.name}</strong><small>+ {money(a.price)}</small></button>};
 return <div className={styles.root}>
  {groups.map(group=>{const list=addons.filter(addon=>group.addonIds.includes(addon.id));const count=selected.filter(id=>group.addonIds.includes(id)).length;return <section key={group.id} className={styles.group} data-complete={count>=group.min&&count<=group.max}><header><div><strong>{group.title}</strong><small>{group.min>0?`Obrigatório · ${group.min} a ${group.max}`:`Opcional · até ${group.max}`}</small></div><span>{count}/{group.max}</span></header><div className={styles.options}>{list.map(renderOption)}</div>{count<group.min&&<p role="status">Escolha mais {group.min-count} opção(ões) neste grupo.</p>}</section>})}
  {addons.some(a=>!included.has(a.id))&&<section className={styles.group}><header><div><strong>Adicionais extras</strong><small>Opcionais · sujeitos ao limite geral</small></div></header><div className={styles.options}>{addons.filter(a=>!included.has(a.id)).map(renderOption)}</div></section>}
 </div>;
}
