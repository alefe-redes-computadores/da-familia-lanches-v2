"use client";
/** R244: staged catalog-backed component. NOT mounted in public checkout. */
import {useMemo,useState,type ChangeEvent} from "react";
import type {Product} from "@/data/products";
import type {Addon} from "@/data/addons";
import {prepareComboCatalogLab,type ComboCatalogLabOptions,type ComboCatalogLab} from "@/lib/comboUnitCatalogDraft";
import {readComboEditorUnits,listComboEditorGroups} from "@/lib/comboUnitEditorDraft";
import {
  createComboBatchDraft,resizeComboBatchDraft,copyComboBatchPlan,changeComboBatchUnits,
  noteComboBatchUnit,readComboBatchPreview,
} from "@/lib/comboUnitBatchDraft";
import type {ComboScope} from "@/lib/comboUnitPlan";
import {prepareComboBatchHandoffPreview} from "@/lib/comboUnitBatchHandoffDraft";
import {buildComboBatchThermalLab,type ThermalLabSize} from "@/lib/comboUnitBatchThermalLab";
import {ComboUnitBatchAuditDraft} from "./ComboUnitBatchAuditDraft";
import {ComboUnitServerQuotePanel} from "@/components/admin/ComboUnitServerQuotePanel";
import styles from "./ComboUnitBatchConfiguratorDraft.module.css";

export type ComboUnitBatchLabProps=Readonly<{
  comboId:string;products:readonly Product[];addons:readonly Addon[];
  initialQuantity?:number;options?:ComboCatalogLabOptions;
}>;
type Selection=Readonly<{mode:"one"|"selected"|"all";keys:readonly string[]}>;
const formatBRL=(cents:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(cents/100);
/** Catalog is *passed* from existing hook by a future lab mount. No new reads. */
export function ComboUnitBatchConfiguratorDraft(props:ComboUnitBatchLabProps){
  const catalog=useMemo(()=>{
    try{return prepareComboCatalogLab(props.comboId,props.products,props.addons,props.options);}
    catch{return null;}
  },[props.comboId,props.products,props.addons,props.options]);
  if(!catalog)return <div role="status" className={styles.error}>Prévia indisponível: confira composição, disponibilidade e política do catálogo.</div>;
  return <ComboBatchLabEditor key={catalog.blueprint.fingerprint} catalog={catalog} initialQuantity={props.initialQuantity??1}/>;
}
function ComboBatchLabEditor({catalog,initialQuantity}:{catalog:ComboCatalogLab;initialQuantity:number}){
  const blueprint=catalog.blueprint;
  const [batch,setBatch]=useState(()=>createComboBatchDraft(blueprint,Math.min(30,Math.max(1,Math.trunc(initialQuantity||1)))));
  const [current,setCurrent]=useState(1);
  const [selection,setSelection]=useState<Record<number,Selection>>({});
  const [error,setError]=useState("");
  const [paper,setPaper]=useState<ThermalLabSize>("58");
  const [serverQuoteRevision,setServerQuoteRevision]=useState(0);
  const groups=useMemo(()=>listComboEditorGroups(blueprint),[blueprint]);
  const preview=useMemo(()=>{try{return readComboBatchPreview(blueprint,batch,catalog.policy);}catch{return null;}},[blueprint,batch,catalog.policy]);
  const audit=useMemo(()=>{try{return prepareComboBatchHandoffPreview(catalog,batch);}catch{return null;}},[catalog,batch]);
  const rows=useMemo(()=>readComboEditorUnits(blueprint,batch.plans[current-1]),[blueprint,batch,current]);
  const ticket=useMemo(()=>{try{return audit?buildComboBatchThermalLab(audit,paper):null;}catch{return null;}},[audit,paper]);
  const act=(run:()=>ReturnType<typeof createComboBatchDraft>)=>{
    try{setBatch(run());setServerQuoteRevision(v=>v+1);setError("");}catch{setError("Não foi possível aplicar esta mudança. Confira os limites.");}
  };
  const quantity=batch.plans.length;
  const selectedFor=(index:number,keys:readonly string[]):Selection=>selection[index]??{mode:"one",keys:[keys[0]]};
  const scopeFor=(index:number,keys:readonly string[]):ComboScope|null=>{
    const s=selectedFor(index,keys);
    const selected=s.mode==="all"?keys:s.keys.filter(k=>keys.includes(k));
    if(s.mode!=="all"&&!selected.length){setError("Selecione ao menos uma unidade.");return null;}
    return {groupIndex:index,mode:s.mode,...(s.mode==="all"?{}:{unitKeys:s.mode==="one"?selected.slice(0,1):selected})};
  };
  const change=(index:number,keys:readonly string[],field:"addon"|"removal",id:string)=>{
    const scope=scopeFor(index,keys);if(!scope)return;
    const targets=scope.mode==="all"?keys:scope.unitKeys??[];
    const selected=rows.filter(u=>targets.includes(u.unitKey));
    const enabled=!selected.every(row=>(field==="addon"?row.addonIds:row.removedIngredientIds).includes(id));
    act(()=>changeComboBatchUnits(blueprint,batch,current,scope,{field,id,enabled},catalog.capabilities));
  };
  return <section className={styles.root} data-release="preview-only" aria-label="Laboratório de combos individuais">
    <header className={styles.head}><span>✦ DFL LAB · PRÉVIA PREMIUM</span><h2>Cada combo, do seu jeito</h2><p>Personalize cada lanche separadamente. Veja o resultado na cozinha sem alterar qualquer pedido real.</p></header>
    <div className={styles.quantity} role="group" aria-label="Quantidade de combos">
      <strong>Combos na simulação</strong>
      <button type="button" disabled={quantity<=1} aria-label="Retirar um combo" onClick={()=>{act(()=>resizeComboBatchDraft(blueprint,batch,quantity-1));setCurrent(Math.min(current,quantity-1));}}>−</button>
      <b>{quantity}</b>
      <button type="button" disabled={quantity>=30} aria-label="Adicionar um combo" onClick={()=>act(()=>resizeComboBatchDraft(blueprint,batch,quantity+1))}>+</button>
    </div>
    <div className={styles.tabs} role="group" aria-label="Selecione qual combo modificar">
      {batch.plans.map((_,i)=><button type="button" key={i} aria-pressed={current===i+1} data-active={current===i+1}
        onClick={()=>{setCurrent(i+1);setSelection({});setError("");}}>Combo {i+1} {preview?.combos[i]?.customizedUnits?`· ${preview.combos[i].customizedUnits} alt.`:""}</button>)}
    </div>
    {current>1&&<button type="button" className={styles.copy} onClick={()=>act(()=>copyComboBatchPlan(blueprint,batch,1,current))}>
      Copiar escolhas do Combo 1 para o Combo {current}
    </button>}
    {groups.map(group=>{
      const keys=group.units.map(u=>u.key);const selected=selectedFor(group.index,keys);
      const addons=catalog.capabilities.addonIdsByProduct[group.productId]??[];
      const removals=catalog.capabilities.removableIdsByProduct[group.productId]??[];
      return <div key={group.index} className={styles.group}>
        <div className={styles.groupTitle}><strong>{catalog.labels.products[group.productId]??group.productId}</strong><small>{keys.length} unidade(s)</small></div>
        <div className={styles.mode} role="group" aria-label="Escolher unidades">
          {(["one","selected","all"] as const).map(m=><button type="button" key={m} aria-pressed={selected.mode===m} onClick={()=>setSelection(prev=>({...prev,[group.index]:{mode:m,keys:m==="all"?[]:selected.keys.length?selected.keys:[keys[0]]}}))}>{m==="one"?"Um":m==="selected"?"Vários":"Todos"}</button>)}
        </div>
        {selected.mode==="one"&&<label className={styles.picker}>Unidade
          <select value={selected.keys[0]??keys[0]} onChange={(e:ChangeEvent<HTMLSelectElement>)=>setSelection(prev=>({...prev,[group.index]:{mode:"one",keys:[e.target.value]}}))}>
            {group.units.map(u=><option value={u.key} key={u.key}>{u.unitNumber}</option>)}
          </select></label>}
        {selected.mode==="selected"&&<div className={styles.multiselect} role="group" aria-label="Escolha as unidades">
          {group.units.map(u=><label key={u.key}><input type="checkbox" checked={selected.keys.includes(u.key)} onChange={(e:ChangeEvent<HTMLInputElement>)=>setSelection(prev=>({...prev,[group.index]:{mode:"selected",keys:e.target.checked?[...selected.keys,u.key]:selected.keys.filter(x=>x!==u.key)}}))}/>{u.unitNumber}</label>)}
        </div>}
        {!!addons.length&&<div className={styles.optionSet}><strong>Adicionais</strong><div className={styles.chips}>
          {addons.map(id=>{const selectedKeys=selected.mode==="all"?keys:selected.keys.filter(k=>keys.includes(k));const targets=rows.filter(row=>selectedKeys.includes(row.unitKey));const count=targets.filter(row=>row.addonIds.includes(id)).length;const active=targets.length>0&&count===targets.length;return <button type="button" key={id} aria-pressed={active} data-active={active} data-partial={count>0&&!active} onClick={()=>change(group.index,keys,"addon",id)}>
            {active?"✓ ":"+ "}{catalog.labels.addons[id]??id} · {formatBRL(catalog.additionPricesCents[id])}{count>0&&!active?" · parcial":""}
          </button>;})}
        </div></div>}
        {!!removals.length&&<div className={styles.optionSet}><strong>Retirar</strong><div className={styles.chips}>
          {removals.map(id=>{const selectedKeys=selected.mode==="all"?keys:selected.keys.filter(k=>keys.includes(k));const targets=rows.filter(row=>selectedKeys.includes(row.unitKey));const count=targets.filter(row=>row.removedIngredientIds.includes(id)).length;const active=targets.length>0&&count===targets.length;return <button type="button" key={id} aria-pressed={active} data-active={active} data-partial={count>0&&!active} onClick={()=>change(group.index,keys,"removal",id)}>{active?"✓ ":""}Sem {catalog.labels.ingredients[id]??id}{count>0&&!active?" · parcial":""}</button>;})}
        </div></div>}
        {!addons.length&&!removals.length&&<small className={styles.muted}>Sem alterações liberadas para este componente.</small>}
        <div className={styles.units}>{group.units.map(u=>{
          const row=rows.find(r=>r.unitKey===u.key);
          return <details key={u.key}><summary>Unidade {u.unitNumber} <b>{row?.customized?"Personalizada":"Padrão"}</b></summary>
            <small>{row?.addonIds.map(id=>`+ ${catalog.labels.addons[id]??id}`).join(", ")||"Sem adicionais"}</small>
            <label>Observação para esta unidade
              <textarea maxLength={140} rows={2} value={row?.note??""} onChange={(e:ChangeEvent<HTMLTextAreaElement>)=>act(()=>noteComboBatchUnit(blueprint,batch,current,u.key,e.target.value))}/>
            </label>
          </details>;
        })}</div>
      </div>;
    })}
    {error&&<p role="alert" className={styles.error}>{error}</p>}
    {audit?<ComboUnitBatchAuditDraft preview={audit}/>:<p role="status" className={styles.error}>Conferência de cozinha indisponível: revise o catálogo e os adicionais.</p>}
    <section className={styles.thermalSection} aria-label="Bobina simulada para conferência">
      <div className={styles.thermalHead}><div><span>COZINHA · SOMENTE PRÉVIA</span><strong>Como sai na bobina</strong></div><div className={styles.thermalModes} role="group" aria-label="Largura de bobina">
        <button type="button" aria-pressed={paper==="58"} onClick={()=>setPaper("58")}>58 mm</button><button type="button" aria-pressed={paper==="80"} onClick={()=>setPaper("80")}>80 mm</button>
      </div></div>
      {ticket?<div className={styles.ticketSurface}><div className={styles.ticket}><pre>{ticket.lines.join("\n")}</pre></div></div>:<p className={styles.error} role="status">Prévia térmica indisponível: confira os itens e a composição.</p>}
      <small>Prévia local. Nenhum comando de impressão é enviado e nenhuma entrega é criada.</small>
    </section>
    <ComboUnitServerQuotePanel key={serverQuoteRevision} comboId={blueprint.productId} batch={batch} localTotalCents={preview?.amountCents??null} localUnitCount={preview?.unitCount??0} localFingerprint={blueprint.fingerprint}/>
    <footer className={styles.total} aria-live="polite">
      <strong>{preview?.unitCount??0} unidades · {preview?.customizedUnits??0} personalizadas</strong>
      <span>{preview?.amountStatus==="preview_only"&&preview.amountCents!=null?`Total apenas ilustrativo: ${formatBRL(preview.amountCents)}`:"Prévia indisponível: confira a política de adicionais."}</span>
      <small>Não cobre, não imprima e não envie esta simulação ao Entregas.</small>
      <button disabled type="button">Adicionar ao carrinho — não liberado</button>
    </footer>
  </section>;
}
