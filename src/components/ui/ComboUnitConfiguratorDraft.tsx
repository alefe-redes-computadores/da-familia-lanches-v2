"use client";
/**
 * R243 — bancada VISUAL, nao montada no fluxo do cliente.
 * Ao conectar no futuro, exigir homologacao de regras comerciais, Site, Entregas e cozinha.
 * NUNCA usar este componente como etapa de checkout ou fonte de preco.
 */
import {useMemo,useState,type ChangeEvent} from "react";
import type {ComboBlueprint,ComboUnitCapabilities,ComboUnitPlanV2,ComboScope} from "@/lib/comboUnitPlan";
import type {ComboUnitCommercialDraft} from "@/lib/comboUnitCommercial";
import {
  COMBO_UNIT_EDITOR_ENABLED,
  changeComboEditorUnits,
  emptyComboEditor,
  listComboEditorGroups,
  noteComboEditorUnit,
  readComboEditorPreview,
} from "@/lib/comboUnitEditorDraft";
import styles from "./ComboUnitConfiguratorDraft.module.css";

export type ComboEditorLabels = Readonly<{
  products:Readonly<Record<string,string>>;
  addons:Readonly<Record<string,string>>;
  ingredients:Readonly<Record<string,string>>;
}>;
export type ComboUnitConfiguratorDraftProps = Readonly<{
  blueprint:ComboBlueprint;
  capabilities:ComboUnitCapabilities;
  labels:ComboEditorLabels;
  commercialPolicy?:ComboUnitCommercialDraft;
  comboQuantity?:number;
}>;

type Selection = {mode:"all"|"one"|"selected";keys:string[]};
const label=(dictionary:Readonly<Record<string,string>>,id:string)=>
  Object.prototype.hasOwnProperty.call(dictionary,id) ? dictionary[id] : id;
const formatCents=(amount:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(amount/100);

/** A interface compoe rascunhos; nao guarda estado persistente nem produz um pedido. */
export function ComboUnitConfiguratorDraft({
  blueprint,capabilities,labels,commercialPolicy,comboQuantity=1,
}:ComboUnitConfiguratorDraftProps){
  const [plan,setPlan]=useState<ComboUnitPlanV2>(()=>emptyComboEditor(blueprint));
  const [selection,setSelection]=useState<Record<number,Selection>>({});
  const [error,setError]=useState("");
  const groups=useMemo(()=>listComboEditorGroups(blueprint),[blueprint]);
  const summary=useMemo(()=>{
    try{return readComboEditorPreview(blueprint,plan,comboQuantity,commercialPolicy);}
    catch{return null;}
  },[blueprint,plan,comboQuantity,commercialPolicy]);
  const units=summary?.rows??[];
  const choose=(groupIndex:number,next:Selection)=>{
    setSelection(prev=>({...prev,[groupIndex]:next}));setError("");
  };
  const groupScope=(index:number,keys:string[]):ComboScope|null=>{
    const current=selection[index]??{mode:"one",keys:[keys[0]]};
    const choice=current.mode==="all"?[]:current.keys.filter(key=>keys.includes(key));
    if(current.mode!=="all" && !choice.length){setError("Selecione pelo menos um lanche desse grupo.");return null;}
    return {groupIndex:index,mode:current.mode,...(current.mode==="all"?{}:{unitKeys:current.mode==="one"?choice.slice(0,1):choice})};
  };
  const toggle=(index:number,keys:string[],field:"addon"|"removal",id:string)=>{
    const scope=groupScope(index,keys);if(!scope)return;
    try{
      const selected=scope.mode==="all"?keys:scope.unitKeys??[];
      const state=units.filter(unit=>selected.includes(unit.unitKey));
      const enabled=!state.every(unit=>(field==="addon"?unit.addonIds:unit.removedIngredientIds).includes(id));
      setPlan(changeComboEditorUnits(blueprint,plan,scope,{field,id,enabled},capabilities));
      setError("");
    }catch{setError("Esta alteração não é permitida para as unidades selecionadas.");}
  };
  const note=(unitKey:string,value:string)=>{
    try{setPlan(noteComboEditorUnit(blueprint,plan,unitKey,value));setError("");}
    catch{setError("Não foi possível atualizar esta observação.");}
  };
  const reset=()=>{setPlan(emptyComboEditor(blueprint));setSelection({});setError("");};
  // A flag desabilitada NAO bloqueia o laboratorio de rascunho, mas impede promover o plano a carrinho.
  const labOnly=COMBO_UNIT_EDITOR_ENABLED===false;
  return <section className={styles.root} aria-label="Prévia de personalização individual dos combos" data-release="preview-only">
    <header className={styles.hero}>
      <span className={styles.kicker}>DFL LAB · R243</span>
      <h2>Monte cada lanche do seu jeito</h2>
      <p>Simulação de personalização. Não altera pedidos, não envia para a cozinha e não permite cobrança.</p>
    </header>
    {groups.map(group=>{
      const keys=group.units.map(unit=>unit.key);
      const selected=selection[group.index]??{mode:"one" as const,keys:[keys[0]]};
      const addonIds=capabilities.addonIdsByProduct[group.productId]??[];
      const ingredientIds=capabilities.removableIdsByProduct[group.productId]??[];
      const selectedKeys=selected.mode==="all"?keys:selected.keys.filter(key=>keys.includes(key));
      return <section className={styles.group} key={group.index} aria-label={`Grupo ${group.index+1}`}>
        <div className={styles.groupTitle}><div><strong>{label(labels.products,group.productId)}</strong><small>{group.units.length} unidade(s) neste combo</small></div><span>{group.index+1}</span></div>
        <div className={styles.selectModes} role="group" aria-label={`Aplicar em quais unidades de ${label(labels.products,group.productId)}?`}>
          {(["one","selected","all"] as const).map(mode=><button key={mode} type="button" aria-pressed={selected.mode===mode}
            onClick={()=>choose(group.index,{mode,keys:mode==="one"?[selected.keys[0]??keys[0]]:mode==="selected"?selected.keys.length?selected.keys:[keys[0]]:[]})}>
            {mode==="one"?"Um":mode==="selected"?"Selecionados":"Todos"}
          </button>)}
        </div>
        {selected.mode==="one"&&<label className={styles.unitPicker}>Escolha a unidade
          <select value={selected.keys[0]??keys[0]} onChange={(event:ChangeEvent<HTMLSelectElement>)=>choose(group.index,{mode:"one",keys:[event.target.value]})}>
            {group.units.map(unit=><option key={unit.key} value={unit.key}>Unidade {unit.unitNumber}</option>)}
          </select>
        </label>}
        {selected.mode==="selected"&&<div className={styles.multi} role="group" aria-label="Unidades selecionadas">
          {group.units.map(unit=><label key={unit.key}><input type="checkbox" checked={selected.keys.includes(unit.key)}
            onChange={(event:ChangeEvent<HTMLInputElement>)=>choose(group.index,{mode:"selected",keys:event.target.checked?[...selected.keys,unit.key]:selected.keys.filter(key=>key!==unit.key)})}/>{unit.unitNumber}</label>)}
        </div>}
        {addonIds.length>0&&<div className={styles.options}><h3>Adicionar</h3><div className={styles.chips}>
          {addonIds.map(id=>{
            const target=units.filter(unit=>selectedKeys.includes(unit.unitKey));
            const active=target.length>0&&target.every(unit=>unit.addonIds.includes(id));
            const partial=target.some(unit=>unit.addonIds.includes(id))&&!active;
            return <button type="button" key={id} aria-pressed={active} data-partial={partial} disabled={!selectedKeys.length}
              onClick={()=>toggle(group.index,keys,"addon",id)}>{label(labels.addons,id)}{active?" ✓":partial?" · parcial":""}</button>;
          })}
        </div></div>}
        {ingredientIds.length>0&&<div className={styles.options}><h3>Retirar ingrediente</h3><div className={styles.chips}>
          {ingredientIds.map(id=>{
            const target=units.filter(unit=>selectedKeys.includes(unit.unitKey));
            const active=target.length>0&&target.every(unit=>unit.removedIngredientIds.includes(id));
            const partial=target.some(unit=>unit.removedIngredientIds.includes(id))&&!active;
            return <button type="button" key={id} aria-pressed={active} data-partial={partial} disabled={!selectedKeys.length}
              onClick={()=>toggle(group.index,keys,"removal",id)}>Sem {label(labels.ingredients,id)}{active?" ✓":partial?" · parcial":""}</button>;
          })}
        </div></div>}
        {!addonIds.length&&!ingredientIds.length&&<p className={styles.muted}>Sem modificações individuais permitidas neste componente.</p>}
        <div className={styles.units}>
          {group.units.map(unit=>{
            const row=units.find(entry=>entry.unitKey===unit.key);
            return <details key={unit.key} className={styles.unit}>
              <summary><span>Unidade {unit.unitNumber}</span><small>{row?.customized?"Personalizada":"Padrão"}</small></summary>
              {row&&<div className={styles.unitDetail}>
                <p>{[...row.addonIds.map(id=>`+ ${label(labels.addons,id)}`),...row.removedIngredientIds.map(id=>`Sem ${label(labels.ingredients,id)}`)].join(" · ")||"Sem alterações de ingredientes"}</p>
                <label>Observação exclusiva desta unidade
                  <textarea rows={2} maxLength={140} value={row.note} placeholder="Ex.: molho separado" onChange={(event:ChangeEvent<HTMLTextAreaElement>)=>note(unit.key,event.target.value)}/>
                </label>
              </div>}
            </details>;
          })}
        </div>
      </section>;
    })}
    {error&&<p className={styles.error} role="alert">{error}</p>}
    <div className={styles.summary} aria-live="polite">
      <strong>Resumo da simulação</strong>
      <p>{summary?`${summary.customizedUnitsPerCombo} unidade(s) personalizada(s) por combo${comboQuantity>1?` · mesmo padrão nos ${comboQuantity} combos`:""}.`:"Confira a composição: o rascunho está inválido."}</p>
      <span>{summary?.amountStatus==="preview_only"&&summary.amountCents!==null?`Total ilustrativo: ${formatCents(summary.amountCents)}`:"Preço indisponível até aprovação da política comercial."}</span>
      <small>Valores, quando calculados, são demonstrativos e não autorizam cobrança.</small>
      <div className={styles.footer}><button type="button" onClick={reset}>Limpar simulação</button><button type="button" disabled aria-disabled="true">Adicionar ao carrinho (indisponível)</button></div>
    </div>
    {labOnly&&<p className={styles.guard}>Modo laboratório: personalização por unidade desligada para clientes.</p>}
  </section>;
}
