/**
 * DFL SITE R248 — reconciliação de combos independentes com um catálogo recebido
 * exclusivamente do servidor. READ ONLY. Nem a conferência nem seu total são
 * tokens de pagamento ou autorização para criar pedidos ou emitir impressões.
 */
import type {Product} from '@/data/products';
import type {Addon} from '@/data/addons';
import {prepareComboCatalogLab} from './comboUnitCatalogDraft';
import {parseComboBatchDraft, type ComboBatchDraft} from './comboUnitBatchDraft';
import {prepareComboBatchHandoffPreview} from './comboUnitBatchHandoffDraft';
import {buildComboBatchThermalLab} from './comboUnitBatchThermalLab';

export const COMBO_SERVER_QUOTE_CHECKOUT_ENABLED = false as const;
export const COMBO_SERVER_QUOTE_VERSION = 1 as const;

export type ComboServerQuoteRow = Readonly<{
  key:string;comboNumber:number;componentId:string;productLabel:string;
  unitNumber:number;groupQuantity:number;
  addons:readonly Readonly<{id:string;label:string;priceCents:number}>[];
  removals:readonly Readonly<{id:string;label:string}>[];
  note:string;extrasCents:number;
}>;
export type ComboServerQuote = Readonly<{
  schema:1;status:'review_only';source:'server_catalog_snapshot';
  authorization:Readonly<{checkout:false;payment:false;order:false;print:false;relay:false;production:false}>;
  quoteIsPayable:false;productId:string;blueprintFingerprint:string;
  comboCount:number;unitCount:number;customizedUnitCount:number;
  basePricePerComboCents:number;extrasForOrderCents:number;totalCents:number;
  combos:readonly Readonly<{number:number;totalCents:number;extrasCents:number}>[];
  rows:readonly ComboServerQuoteRow[];
  kitchenPreview58:readonly string[];kitchenPreview80:readonly string[];
}>;

const safeInt=(value:number)=>Number.isSafeInteger(value)&&value>=0&&value<=150_000_000;
function guard(valid:unknown,code:string):asserts valid {if(!valid)throw Error(`COMBO_SERVER_QUOTE_${code}`);}
/**
 * catalogProducts / catalogAddons devem ser obtidos pelo servidor após verificar
 * a permissão administrativa. NENHUM produto, preço ou regra vem do body HTTP.
 */
export function evaluateServerComboQuote(
  comboId:string, untrustedBatch:unknown,
  catalogProducts:readonly Product[], catalogAddons:readonly Addon[],
):ComboServerQuote {
  guard(typeof comboId==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(comboId),'COMBO_ID_INVALID');
  const lab=prepareComboCatalogLab(comboId,catalogProducts,catalogAddons);
  const batch:ComboBatchDraft=parseComboBatchDraft(untrustedBatch,lab.blueprint);
  guard(batch.plans.length>=1&&batch.plans.length<=30,'COUNT_INVALID');
  const preview=prepareComboBatchHandoffPreview(lab,batch);
  guard(preview.status==='preview_only'&&preview.canSend===false&&
    Object.values(preview.authorized).every(value=>value===false),'UNEXPECTED_AUTHORIZATION');
  guard(preview.segments.length===batch.plans.length&&
    preview.unitCount===lab.blueprint.units.length*batch.plans.length,'UNIT_COUNT_INVALID');
  guard(safeInt(preview.totalPreviewCents)&&safeInt(preview.extrasForOrderCents),'PRICE_INVALID');
  const base=lab.policy.baseComboPriceCents;
  guard(safeInt(base)&&preview.totalPreviewCents===base*batch.plans.length+preview.extrasForOrderCents,
    'TOTAL_RECONCILIATION_FAILED');
  const rows:ComboServerQuoteRow[]=preview.units.map(unit=>({
    key:unit.batchUnitKey,comboNumber:unit.batchComboNumber,
    componentId:unit.productId,productLabel:unit.productLabel,
    unitNumber:unit.unitNumber,groupQuantity:unit.groupQuantity,
    addons:unit.addons.map(addon=>({id:addon.id,label:addon.label,priceCents:addon.priceCents})),
    removals:unit.removals.map(removal=>({id:removal.id,label:removal.label})),
    note:unit.note,extrasCents:unit.extrasCents,
  }));
  guard(new Set(rows.map(row=>row.key)).size===rows.length,'DUPLICATE_UNIT');
  guard(rows.reduce((sum,row)=>sum+row.extrasCents,0)===preview.extrasForOrderCents,
    'EXTRAS_RECONCILIATION_FAILED');
  const columns58=buildComboBatchThermalLab(preview,'58');
  const columns80=buildComboBatchThermalLab(preview,'80');
  guard(columns58.canPrint===false&&columns80.canPrint===false&&
    columns58.canCharge===false&&columns80.canCharge===false,'PRINT_GATE_INVALID');
  return {
    schema:1,status:'review_only',source:'server_catalog_snapshot',
    authorization:{checkout:false,payment:false,order:false,print:false,relay:false,production:false},
    quoteIsPayable:false,productId:comboId,blueprintFingerprint:lab.blueprint.fingerprint,
    comboCount:preview.comboCount,unitCount:preview.unitCount,
    customizedUnitCount:rows.filter(row=>Boolean(row.addons.length||row.removals.length||row.note)).length,
    basePricePerComboCents:base,extrasForOrderCents:preview.extrasForOrderCents,totalCents:preview.totalPreviewCents,
    combos:preview.segments.map(segment=>({number:segment.number,totalCents:segment.totalCents,extrasCents:segment.extrasCents})),
    rows,kitchenPreview58:columns58.lines,kitchenPreview80:columns80.lines,
  };
}
