/** R244 — individual configurations for several copies of the SAME combo.
 * No checkout line, persistence, outbox, print or server authority is produced.
 * Unlike R243's comboQuantity multiplier, each physical combo has its OWN plan.
 */
import {
  emptyComboUnitPlan,parseComboUnitPlan,applyComboUnitChange,setComboUnitNote,
  type ComboBlueprint,type ComboUnitPlanV2,type ComboScope,type ComboChange,type ComboUnitCapabilities,
} from "./comboUnitPlan";
import {reviewComboUnitCommercialDraft,type ComboUnitCommercialDraft} from "./comboUnitCommercial";
import {readComboEditorUnits,type ComboEditorUnit} from "./comboUnitEditorDraft";

export const COMBO_UNIT_BATCH_LAB_ENABLED=false as const;
export const COMBO_UNIT_BATCH_SCHEMA=1 as const;
function guard(x:unknown,code:string):asserts x {if(!x)throw new Error(`COMBO_BATCH_${code}`);}
export type ComboBatchDraft=Readonly<{
  schema:1;status:"preview_only";payable:false;
  productId:string;blueprintFingerprint:string;
  plans:readonly ComboUnitPlanV2[];
}>;
export type ComboBatchRow=Readonly<ComboEditorUnit & {comboNumber:number;key:string}>;
export type ComboBatchPreview=Readonly<{
  schema:1;status:"preview_only";canCheckout:false;canPrint:false;canRelay:false;canSubmit:false;
  comboCount:number;unitCount:number;customizedUnits:number;
  rows:readonly ComboBatchRow[];
  combos:readonly Readonly<{number:number;customizedUnits:number;totalCents:number|null;status:"preview_only"|"POLICY_REQUIRED"|"ADDON_PRICE_MISSING"}>[];
  amountStatus:"preview_only"|"POLICY_REQUIRED"|"ADDON_PRICE_MISSING";
  amountCents:number|null;
  kitchenPreview:readonly string[];
}>;
export function createComboBatchDraft(blueprint:ComboBlueprint,quantity:number):ComboBatchDraft{
  guard(Number.isSafeInteger(quantity)&&quantity>=1&&quantity<=30,"QUANTITY_INVALID");
  return {schema:1,status:"preview_only",payable:false,productId:blueprint.productId,
    blueprintFingerprint:blueprint.fingerprint,
    plans:Array.from({length:quantity},()=>emptyComboUnitPlan(blueprint))};
}
export function parseComboBatchDraft(raw:unknown,blueprint:ComboBlueprint):ComboBatchDraft {
  guard(Boolean(raw)&&typeof raw==="object"&&!Array.isArray(raw),"DRAFT_INVALID");
  const val=raw as Record<string,unknown>;
  guard(val.schema===1&&val.status==="preview_only"&&val.payable===false&&
    val.productId===blueprint.productId&&val.blueprintFingerprint===blueprint.fingerprint,"DRAFT_STALE_OR_UNSAFE");
  guard(Array.isArray(val.plans)&&val.plans.length>=1&&val.plans.length<=30,"PLANS_INVALID");
  return {...val,schema:1,status:"preview_only",payable:false,productId:blueprint.productId,
    blueprintFingerprint:blueprint.fingerprint,
    plans:val.plans.map(plan=>parseComboUnitPlan(plan,blueprint))} as ComboBatchDraft;
}
function requireIndex(draft:ComboBatchDraft,number:number){
  guard(Number.isInteger(number)&&number>=1&&number<=draft.plans.length,"COMBO_INDEX_INVALID");
  return number-1;
}
export function replaceComboBatchPlan(blueprint:ComboBlueprint,raw:ComboBatchDraft,number:number,plan:ComboUnitPlanV2):ComboBatchDraft {
  const draft=parseComboBatchDraft(raw,blueprint);
  const idx=requireIndex(draft,number);
  const valid=parseComboUnitPlan(plan,blueprint);
  return {...draft,plans:draft.plans.map((p,i)=>i===idx?valid:p)};
}
export function copyComboBatchPlan(blueprint:ComboBlueprint,raw:ComboBatchDraft,source:number,target:number):ComboBatchDraft {
  const draft=parseComboBatchDraft(raw,blueprint);
  const from=requireIndex(draft,source);requireIndex(draft,target);
  return replaceComboBatchPlan(blueprint,draft,target,draft.plans[from]);
}
export function resizeComboBatchDraft(blueprint:ComboBlueprint,raw:ComboBatchDraft,count:number):ComboBatchDraft {
  const draft=parseComboBatchDraft(raw,blueprint);
  guard(Number.isInteger(count)&&count>=1&&count<=30,"QUANTITY_INVALID");
  return {...draft,plans:Array.from({length:count},(_,i)=>draft.plans[i]??emptyComboUnitPlan(blueprint))};
}
export function changeComboBatchUnits(blueprint:ComboBlueprint,raw:ComboBatchDraft,number:number,scope:ComboScope,
  change:ComboChange,capabilities:ComboUnitCapabilities):ComboBatchDraft {
  const draft=parseComboBatchDraft(raw,blueprint);const idx=requireIndex(draft,number);
  const next=applyComboUnitChange(blueprint,draft.plans[idx],scope,change,capabilities);
  return replaceComboBatchPlan(blueprint,draft,number,next);
}
export function noteComboBatchUnit(blueprint:ComboBlueprint,raw:ComboBatchDraft,number:number,unitKey:string,note:string):ComboBatchDraft{
  const draft=parseComboBatchDraft(raw,blueprint);const idx=requireIndex(draft,number);
  return replaceComboBatchPlan(blueprint,draft,number,setComboUnitNote(blueprint,draft.plans[idx],unitKey,note));
}
export function readComboBatchPreview(blueprint:ComboBlueprint,raw:ComboBatchDraft,policy?:ComboUnitCommercialDraft):ComboBatchPreview {
  const draft=parseComboBatchDraft(raw,blueprint);
  const rows:ComboBatchRow[]=[];
  const kitchen:string[]=["R244 · SIMULACAO · NAO PREPARAR / NAO COBRAR / NAO IMPRIMIR"];
  let total=0;let customized=0;let status:ComboBatchPreview["amountStatus"]="preview_only";
  const combos=draft.plans.map((plan,index)=>{
    const number=index+1;
    const unitRows=readComboEditorUnits(blueprint,plan);
    const quote=reviewComboUnitCommercialDraft(blueprint,plan,1,policy);
    const amount=quote.state==="draft_preview_only"?quote.totalCents:null;
    const quoteStatus:ComboBatchPreview["amountStatus"]=quote.state==="draft_preview_only"?"preview_only":quote.reason;
    if(quoteStatus!=="preview_only")status=quoteStatus;
    if(amount!==null)total+=amount;
    for(const unit of unitRows){
      const key=`c${number}:${unit.unitKey}`;
      rows.push({...unit,comboNumber:number,key});
      if(unit.customized)customized++;
      const changes=[...unit.addonIds.map(x=>`+${x}`),...unit.removedIngredientIds.map(x=>`SEM ${x}`),...(unit.note?[unit.note]:[])];
      kitchen.push(`${key} (${unit.productId} ${unit.unitNumber}/${unit.groupQuantity}): ${changes.length?changes.join(" · ").replace(/[\r\n]/g," ").slice(0,380):"PADRAO"}`);
    }
    return {number,customizedUnits:unitRows.filter(u=>u.customized).length,totalCents:amount,status:quoteStatus};
  });
  guard(rows.length===blueprint.units.length*draft.plans.length&&rows.length<=1800,"ROW_LIMIT");
  guard(new Set(rows.map(r=>r.key)).size===rows.length,"DUPLICATE_UNIT_KEYS");
  guard(Number.isSafeInteger(total)&&total>=0&&total<=150_000_000,"TOTAL_INVALID");
  return {schema:1,status:"preview_only",canCheckout:false,canPrint:false,canRelay:false,canSubmit:false,
    comboCount:draft.plans.length,unitCount:rows.length,customizedUnits:customized,rows,combos,
    amountStatus:status,amountCents:status==="preview_only"?total:null,kitchenPreview:kitchen};
}
