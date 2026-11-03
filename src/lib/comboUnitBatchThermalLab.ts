/**
 * R246 — inert thermal preview for 58/80 mm. It is NOT a print driver.
 * The source is the read-only R245 multi-combo packet, never a paid order.
 */
import type {ComboBatchHandoffPreview} from './comboUnitBatchHandoffDraft';
export const COMBO_BATCH_THERMAL_LAB_ENABLED=false as const;
export type ThermalLabSize='58'|'80';
export type ComboBatchThermalPreview=Readonly<{
 state:'preview_only';paperMm:58|80;columns:30|42;canPrint:false;
 canCharge:false;canRelay:false;lines:readonly string[];html:string;
}>;
const CONTROL=/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;
const clean=(s:string)=>s.normalize('NFC').replace(CONTROL,' ').replace(/\s+/g,' ').trim();
const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
function guard(v:unknown,reason:string):asserts v{if(!v)throw Error('COMBO_THERMAL_'+reason);}
const money=(n:number)=>'R$ '+(n/100).toFixed(2).replace('.',',');
function wrap(raw:string,width:number):string[]{
 const text=clean(raw);
 if(!text)return [''];
 const out:string[]=[];let line='';
 for(const word of text.split(' ')){
  const chunk=Array.from(word);
  if(line&&Array.from(line).length+1+chunk.length>width){out.push(line);line='';}
  if(chunk.length>width){
   if(line){out.push(line);line='';}
   for(let i=0;i<chunk.length;i+=width){const part=chunk.slice(i,i+width).join('');if(part.length===width||i+width<chunk.length)out.push(part);else line=part;}
  }else line+=(line?' ':'')+word;
 }
 if(line)out.push(line);
 return out;
}
export function buildComboBatchThermalLab(packet:ComboBatchHandoffPreview,paper:ThermalLabSize):ComboBatchThermalPreview{
 const columns=paper==='58'?30:paper==='80'?42:0;
 guard(columns!==0,'PAPER_INVALID');
 guard(packet?.schema===1&&packet.contract==='dfl_site_combo_batch_preview_v1'&&packet.status==='preview_only'&&packet.canSend===false,'PACKET_INVALID');
 guard(packet.authorized.checkout===false&&packet.authorized.charge===false&&packet.authorized.print===false&&packet.authorized.relay===false&&packet.authorized.production===false,'PERMISSION_INVALID');
 guard(Number.isInteger(packet.comboCount)&&packet.comboCount>=1&&packet.comboCount<=30&&packet.segments.length===packet.comboCount,'SEGMENTS_INVALID');
 guard(packet.units.length===packet.unitCount&&packet.unitCount>=1&&packet.unitCount<=1800&&Number.isSafeInteger(packet.totalPreviewCents)&&packet.totalPreviewCents>=0,'UNITS_OR_PRICE_INVALID');
 guard(packet.segments.reduce((n,s)=>n+s.totalCents,0)===packet.totalPreviewCents&&packet.segments.reduce((n,s)=>n+s.extrasCents,0)===packet.extrasForOrderCents,'TOTAL_INVALID');
 const lines:string[]=[];const push=(s:string)=>{for(const l of wrap(s,columns))lines.push(l);};
 push('DFL LAB - SIMULACAO');push('NAO IMPRIMIR / NAO PRODUZIR');push('NAO COBRAR / NAO ENVIAR');
 const seen=new Set<string>();let count=0;
 for(const segment of packet.segments){
  guard(segment?.number===packet.segments.indexOf(segment)+1&&segment.receiverDraft?.status==='preview_only'&&segment.receiverDraft.sendAllowed===false,'SEGMENT_STATUS_INVALID');
  guard(segment.receiverDraft.authorization?.print===false&&segment.receiverDraft.authorization?.relay===false,'SEGMENT_PERMISSION_INVALID');
  guard(segment.receiverDraft.units.length>0&&segment.receiverDraft.units.length<=60,'SEGMENT_UNITS_INVALID');
  push('----------------');push(`COMBO ${segment.number}/${packet.comboCount}`);
  const subset=packet.units.filter(u=>u.batchComboNumber===segment.number);
  guard(subset.length===segment.receiverDraft.units.length,'SEGMENT_COUNT_MISMATCH');
  for(let i=0;i<subset.length;i++){
   const unit=subset[i],origin=segment.receiverDraft.units[i];
   guard(unit.batchUnitKey===`c${segment.number}:${origin.componentKey}`&&unit.componentKey===origin.componentKey&&unit.productId===origin.productId&&unit.extrasCents===origin.extrasCents&&unit.batchComboNumber===segment.number,'SEGMENT_UNIT_MISMATCH');
   guard(!seen.has(unit.batchUnitKey),'DUPLICATE_KEY');seen.add(unit.batchUnitKey);count++;
   push(`${unit.unitNumber}/${unit.groupQuantity} ${unit.productLabel} [${unit.batchUnitKey}]`);
   for(const a of unit.addons)push(`  + ${a.label}`);
   for(const r of unit.removals)push(`  SEM ${r.label}`);
   if(unit.note)push(`  OBS: ${unit.note}`);
   if(!unit.addons.length&&!unit.removals.length&&!unit.note)push('  PADRAO');
  }
  push('Extras ilustrativos: '+money(segment.extrasCents));
 }
 guard(count===packet.unitCount,'COUNT_MISMATCH');
 push('----------------');push('Total ilustrativo: '+money(packet.totalPreviewCents));
 push('VALORES NAO AUTORIZADOS');
 guard(lines.length<=9000&&lines.every(l=>Array.from(l).length<=columns),'OUTPUT_LIMIT');
 const paperMm=paper==='58'?58:80;
 const html='<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<title>DFL LAB - NAO IMPRIMIR</title><style>body{max-width:'+paperMm+'mm;margin:12px auto;padding:6px;color:#161616;background:#fff;font:11px/1.35 monospace;overflow-wrap:anywhere}pre{font:inherit;white-space:pre-wrap}h1{font:700 13px sans-serif}</style></head><body><h1>SIMULACAO - NAO IMPRIMIR</h1><pre>'+escape(lines.join('\n'))+'</pre></body></html>';
 return {state:'preview_only',paperMm,columns:columns as 30|42,canPrint:false,canCharge:false,canRelay:false,lines,html};
}
