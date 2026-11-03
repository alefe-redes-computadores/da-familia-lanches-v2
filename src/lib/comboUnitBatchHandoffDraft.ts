/** R245 — lossless, read-only batch reconciliation across R237–R244 and the Entregas R242 reader.
 * One R241 draft PER physical combo: R242 correctly refuses different configurations
 * collapsed as if they were repeated identical combos in one R241 draft.
 * No actual order, API payload, invoice, relay event or print authorization is created.
 */
import type {ComboCatalogLab} from './comboUnitCatalogDraft';
import {parseComboBatchDraft,type ComboBatchDraft} from './comboUnitBatchDraft';
import {prepareComboUnitCartDraft} from './comboUnitCartDraft';
import {previewComboUnitOperationalHandoff} from './comboUnitOperationalDraft';
import {projectComboUnitReceiverDraft,reviewComboUnitReceiverCompatibility,type ComboReceiverDraftV1} from './comboUnitReceiverDraft';

export const COMBO_UNIT_BATCH_HANDOFF_ENABLED=false as const;
export const COMBO_UNIT_BATCH_HANDOFF_SCHEMA=1 as const;
export const COMBO_UNIT_BATCH_HANDOFF_CONTRACT='dfl_site_combo_batch_preview_v1' as const;
const MAX_CENTS=150_000_000;
function requireValid(ok:unknown,reason:string):asserts ok {if(!ok)throw new Error(`COMBO_BATCH_HANDOFF_${reason}`);}
const plain=(s:string)=>s.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g,' ').replace(/\s+/g,' ').trim();
export type BatchHandoffUnit = ComboReceiverDraftV1['units'][number] & Readonly<{batchUnitKey:string;batchComboNumber:number}>;
export type BatchHandoffSegment=Readonly<{
  number:number;identity:string;totalCents:number;extrasCents:number;
  receiverDraft:ComboReceiverDraftV1;
}>;
export type ComboBatchHandoffPreview=Readonly<{
  schema:1;contract:typeof COMBO_UNIT_BATCH_HANDOFF_CONTRACT;status:'preview_only';
  authorized:Readonly<{checkout:false;charge:false;print:false;relay:false;production:false}>;
  productId:string;blueprintFingerprint:string;comboCount:number;unitCount:number;
  segments:readonly BatchHandoffSegment[];
  units:readonly BatchHandoffUnit[];
  totalPreviewCents:number;extrasForOrderCents:number;canSend:false;
  kitchenPreviewLines:readonly string[];
}>;
function requireLab(lab:ComboCatalogLab){
  requireValid(lab?.schema===1&&lab.status==='preview_only'&&lab.payable===false&&lab.catalogAuthority===false,'LAB_INVALID');
  requireValid(lab.policy?.status==='draft'&&lab.policy.productId===lab.blueprint.productId&&lab.policy.blueprintFingerprint===lab.blueprint.fingerprint,'POLICY_INVALID');
}
/** Recompute every physical combo from the original plan and catalog-derived draft policy.
 * Individual R241 segments are directly consumable by the read-only R242 parser,
 * unlike a flattened whole-batch R241 packet. */
export function prepareComboBatchHandoffPreview(lab:ComboCatalogLab,raw:ComboBatchDraft):ComboBatchHandoffPreview{
  requireLab(lab);
  const batch=parseComboBatchDraft(raw,lab.blueprint);
  const segments:BatchHandoffSegment[]=[];
  const units:BatchHandoffUnit[]=[];
  const kitchenPreviewLines:string[]=['R245 - SIMULACAO. NAO PRODUZIR, NAO IMPRIMIR, NAO COBRAR, NAO ENVIAR'];
  const keys=new Set<string>();
  let total=0,extras=0;
  for(let index=0;index<batch.plans.length;index++){
    const number=index+1;
    const cartDraft=prepareComboUnitCartDraft(lab.blueprint,batch.plans[index],1,lab.policy);
    const operational=previewComboUnitOperationalHandoff(lab.blueprint,cartDraft,lab.policy,lab.labels);
    requireValid(operational.authorization.relay===false&&operational.totals.chargeAuthorized===false,'OPERATIONAL_GATE_INVALID');
    const receiver=projectComboUnitReceiverDraft(operational);
    const compatibility=reviewComboUnitReceiverCompatibility(receiver);
    requireValid(receiver.sendAllowed===false&&compatibility.sendAllowed===false,'RECEIVER_GATE_INVALID');
    requireValid(receiver.source.quantity===1&&receiver.units.length===lab.blueprint.units.length,'SEGMENT_UNITS_INVALID');
    requireValid(receiver.accounting.previewTotalCents>=receiver.accounting.extrasForOrderCents,'SEGMENT_TOTAL_INVALID');
    const identity=`combo-${number}-${receiver.diagnosticId}`;
    requireValid(!segments.some(segment=>segment.identity===identity),'SEGMENT_IDENTITY_DUPLICATED');
    segments.push({number,identity,totalCents:receiver.accounting.previewTotalCents,extrasCents:receiver.accounting.extrasForOrderCents,receiverDraft:receiver});
    total+=receiver.accounting.previewTotalCents;extras+=receiver.accounting.extrasForOrderCents;
    requireValid(Number.isSafeInteger(total)&&total<=MAX_CENTS&&Number.isSafeInteger(extras)&&extras<=MAX_CENTS,'TOTAL_OVERFLOW');
    kitchenPreviewLines.push(`COMBO ${number}/${batch.plans.length} - ${lab.blueprint.productId} - SOMENTE PREVIA`);
    for(const unit of receiver.units){
      const key=`c${number}:${unit.componentKey}`;
      requireValid(!keys.has(key),'UNIT_KEY_DUPLICATED');keys.add(key);
      const line:BatchHandoffUnit={...unit,batchUnitKey:key,batchComboNumber:number};units.push(line);
      const changes=[...unit.addons.map(a=>`+ ${plain(a.label)}`),...unit.removals.map(r=>`SEM ${plain(r.label)}`),...(unit.note?[`OBS: ${plain(unit.note)}`]:[])];
      kitchenPreviewLines.push(`${key} - ${plain(unit.productLabel)} ${unit.unitNumber}/${unit.groupQuantity}: ${changes.join(' | ')||'PADRAO'}`);
    }
  }
  requireValid(units.length===lab.blueprint.units.length*batch.plans.length&&units.length<=1800,'BATCH_UNIT_COUNT_INVALID');
  requireValid(segments.reduce((v,x)=>v+x.totalCents,0)===total&&segments.reduce((v,x)=>v+x.extrasCents,0)===extras,'TOTAL_RECONCILIATION_FAILED');
  requireValid(kitchenPreviewLines.length<=5500,'PREVIEW_LINES_LIMIT');
  return {schema:1,contract:COMBO_UNIT_BATCH_HANDOFF_CONTRACT,status:'preview_only',
    authorized:{checkout:false,charge:false,print:false,relay:false,production:false},
    productId:lab.blueprint.productId,blueprintFingerprint:lab.blueprint.fingerprint,comboCount:batch.plans.length,unitCount:units.length,
    segments,units,totalPreviewCents:total,extrasForOrderCents:extras,canSend:false,kitchenPreviewLines};
}
/** Reject edited snapshots: preview data cannot become evidence of permission. */
export function revalidateComboBatchHandoffPreview(raw:unknown,lab:ComboCatalogLab,batch:ComboBatchDraft):ComboBatchHandoffPreview{
  requireValid(Boolean(raw)&&typeof raw==='object'&&!Array.isArray(raw),'RAW_INVALID');
  const calculated=prepareComboBatchHandoffPreview(lab,batch);
  requireValid(JSON.stringify(raw)===JSON.stringify(calculated),'DRAFT_MODIFIED_OR_STALE');
  return calculated;
}
export type BatchConsumerGate=Readonly<{state:'blocked';reason:'JOINT_HOMOLOGATION_REQUIRED';canSend:false;segmentCount:number}>;
export function reviewBatchReceiverCompatibility(preview:ComboBatchHandoffPreview,_claimedCapability?:unknown):BatchConsumerGate{
  requireValid(preview.schema===1&&preview.contract===COMBO_UNIT_BATCH_HANDOFF_CONTRACT&&preview.status==='preview_only'&&
    preview.canSend===false&&preview.authorized.relay===false,'SENDER_NOT_OFF');
  requireValid(preview.segments.length===preview.comboCount&&preview.units.length===preview.unitCount,'BATCH_COUNT_INVALID');
  for(const part of preview.segments){
    requireValid(part.receiverDraft.status==='preview_only'&&part.receiverDraft.sendAllowed===false&&part.receiverDraft.orderId===null&&part.receiverDraft.eventId===null,'SEGMENT_NOT_OFF');
  }
  return {state:'blocked',reason:'JOINT_HOMOLOGATION_REQUIRED',canSend:false,segmentCount:preview.segments.length};
}
/** Safe inert HTML for QA only. No print triggers and all text is escaped. */
export function previewComboBatchAuditHtml(preview:ComboBatchHandoffPreview):string{
  const gate=reviewBatchReceiverCompatibility(preview);
  requireValid(gate.canSend===false&&preview.authorized.print===false,'HTML_GATE_INVALID');
  const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  return '<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>R245 laboratorio</title><body><h1>SIMULACAO - NAO IMPRIMIR</h1><pre>'+esc(preview.kitchenPreviewLines.join('\n'))+'</pre></body></html>';
}
