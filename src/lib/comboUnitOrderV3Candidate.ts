/**
 * DFL SITE R249 — contract candidate for a future commercially authorized order V3.
 * All amounts must originate from evaluateServerComboQuote in an authenticated server path.
 * NEVER import this into live checkout, order writer, outbox, relay or thermal printer.
 * This is an acceptance document, not an integration envelope or payment authorization.
 */
import type {ComboServerQuote, ComboServerQuoteRow} from './comboUnitServerQuote';

export const COMBO_V3_PUBLIC_CHECKOUT_ENABLED = false as const;
export const COMBO_V3_ORDERS_ENABLED = false as const;
export const COMBO_V3_ENTREGAS_ACCEPTANCE_ENABLED = false as const;
export const COMBO_V3_LIVE_PRINT_ENABLED = false as const;
export const COMBO_V3_CONTRACT = 'dfl_site_combo_order_v3_candidate' as const;
export const COMBO_V3_SCHEMA = 3 as const;

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const KEY = /^c([1-9][0-9]*):([1-9][0-9]*):([1-9][0-9]*)$/;
const SAFE_TEXT = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/;
const safeMoney = (value:unknown,max=150_000_000):value is number =>
  typeof value==='number' && Number.isSafeInteger(value) && value>=0 && value<=max;
const safeText = (value:unknown,max=140):value is string =>
  typeof value==='string' && value.trim().length>0 && value.length<=max && !SAFE_TEXT.test(value);
function guard(ok:unknown,code:string):asserts ok { if(!ok)throw Error(`COMBO_V3_${code}`); }

export type ComboV3UnitCandidate = Readonly<{
  key:string; comboNumber:number; componentId:string; componentLabel:string;
  unitNumber:number; groupQuantity:number;
  addons:readonly Readonly<{id:string;label:string;priceCents:number}>[];
  removals:readonly Readonly<{id:string;label:string}>[];
  note:string; extrasCents:number;
}>;
export type ComboOrderV3Candidate = Readonly<{
  contract:typeof COMBO_V3_CONTRACT;
  orderSchemaVersion:typeof COMBO_V3_SCHEMA;
  state:'certification_only';
  authorization:Readonly<{
    checkout:false; payment:false; persist:false; relay:false; print:false; production:false;
  }>;
  orderId:null; eventId:null; idempotencyKey:null;
  source:'admin_authenticated_server_quote';
  productId:string; blueprintFingerprint:string;
  comboCount:number; unitCount:number; customizedUnitCount:number;
  item:Readonly<{
    productId:string; quantity:number; lineKind:'combo_with_independent_units';
    basePricePerComboCents:number; baseForOrderCents:number;
    extrasForOrderCents:number; totalCents:number;
    units:readonly ComboV3UnitCandidate[];
  }>;
  receiptPreview:Readonly<{widths:readonly [58,80];printAuthorized:false;preview58:readonly string[];preview80:readonly string[]}>;
  acceptance:Readonly<{
    priceRecomputedOnServer:true; perUnitIdentityReconciled:true; legacyCheckoutIntact:true;
    receiverV3Supported:false; canonicalOrderPersistenceTested:false;
    signedRelayWithUnitFieldsTested:false; physicalPrinterTested:false;
    liveCheckoutReleased:false;
    status:'blocked'; blockers:readonly string[];
  }>;
}>;

/** Fail closed, including duplicate IDs, altered cent totals and unknown schema. */
export function prepareComboOrderV3Candidate(quote:ComboServerQuote):ComboOrderV3Candidate {
  guard(quote?.schema===1 && quote.status==='review_only' && quote.source==='server_catalog_snapshot' &&
    quote.quoteIsPayable===false && quote.authorization &&
    Object.keys(quote.authorization).sort().join(',')==='checkout,order,payment,print,production,relay' &&
    Object.values(quote.authorization).every(x=>x===false),'QUOTE_NOT_READ_ONLY');
  guard(typeof quote.productId==='string'&&ID.test(quote.productId) &&
    /^v2-[a-f0-9]{8}$/.test(quote.blueprintFingerprint),'IDENTITY_INVALID');
  guard(Number.isInteger(quote.comboCount)&&quote.comboCount>=1&&quote.comboCount<=30 &&
    Number.isInteger(quote.unitCount)&&quote.unitCount>=quote.comboCount&&quote.unitCount<=1800 &&
    Number.isInteger(quote.customizedUnitCount)&&quote.customizedUnitCount>=0&&
    quote.customizedUnitCount<=quote.unitCount,'QUANTITY_INVALID');
  guard(safeMoney(quote.basePricePerComboCents,5_000_000) &&
    safeMoney(quote.extrasForOrderCents) && safeMoney(quote.totalCents) &&
    quote.basePricePerComboCents*quote.comboCount+quote.extrasForOrderCents===quote.totalCents,
    'TOTAL_INVALID');
  guard(Array.isArray(quote.combos)&&quote.combos.length===quote.comboCount &&
    Array.isArray(quote.rows)&&quote.rows.length===quote.unitCount,'STRUCTURE_INVALID');
  const seen=new Set<string>(); const units:ComboV3UnitCandidate[]=[];
  const groupMap=new Map<string,{id:string;label:string;quantity:number}>();
  let countedExtras=0,countedCustomized=0;
  for(const row of quote.rows){
    guard(Boolean(row)&&typeof row.key==='string'&&KEY.test(row.key)&&!seen.has(row.key),'UNIT_KEY_INVALID');
    seen.add(row.key);const match=KEY.exec(row.key)!;
    guard(row.comboNumber===Number(match[1])&&row.comboNumber<=quote.comboCount &&
      row.unitNumber===Number(match[3])&&row.unitNumber>=1 &&
      Number.isInteger(row.groupQuantity)&&row.groupQuantity>=row.unitNumber&&row.groupQuantity<=30 &&
      typeof row.componentId==='string'&&ID.test(row.componentId)&&safeText(row.productLabel,100),
      'UNIT_IDENTITY_INVALID');
    const groupKey=`${row.comboNumber}:${match[2]}`;
    const previous=groupMap.get(groupKey);
    if(previous)guard(previous.id===row.componentId && previous.label===row.productLabel && previous.quantity===row.groupQuantity,
      'GROUP_IDENTITY_INVALID');
    else groupMap.set(groupKey,{id:row.componentId,label:row.productLabel,quantity:row.groupQuantity});
    guard(Array.isArray(row.addons)&&row.addons.length<=20 && Array.isArray(row.removals)&&row.removals.length<=20 &&
      typeof row.note==='string'&&row.note.length<=140&&!SAFE_TEXT.test(row.note)&&safeMoney(row.extrasCents),
      'UNIT_FIELDS_INVALID');
    const aIds=new Set<string>(),rIds=new Set<string>();let extras=0;
    const addons=row.addons.map((addon:ComboServerQuoteRow["addons"][number])=>{
      guard(Boolean(addon)&&ID.test(addon.id)&&!aIds.has(addon.id)&&safeText(addon.label,100)&&
        safeMoney(addon.priceCents,1_000_000),'ADDON_INVALID');
      aIds.add(addon.id); extras+=addon.priceCents;
      return {id:addon.id,label:addon.label,priceCents:addon.priceCents};
    });
    const removals=row.removals.map((removal:ComboServerQuoteRow["removals"][number])=>{
      guard(Boolean(removal)&&ID.test(removal.id)&&!rIds.has(removal.id)&&safeText(removal.label,100),
        'REMOVAL_INVALID');
      rIds.add(removal.id);return {id:removal.id,label:removal.label};
    });
    guard(extras===row.extrasCents,'UNIT_PRICE_MISMATCH');
    countedExtras+=extras;
    if(addons.length||removals.length||row.note.length)countedCustomized++;
    units.push({key:row.key,comboNumber:row.comboNumber,componentId:row.componentId,
      componentLabel:row.productLabel,unitNumber:row.unitNumber,groupQuantity:row.groupQuantity,
      addons,removals,note:row.note,extrasCents:extras});
  }
  guard(countedExtras===quote.extrasForOrderCents && countedCustomized===quote.customizedUnitCount,
    'UNIT_TOTAL_RECONCILIATION_FAILED');
  for(let c=1;c<=quote.comboCount;c++){
    const grouped=units.filter(unit=>unit.comboNumber===c);
    guard(grouped.length===quote.unitCount/quote.comboCount,'COMBO_UNITS_MISMATCH');
    const combo=quote.combos[c-1];
    guard(Boolean(combo)&&combo.number===c&&safeMoney(combo.totalCents)&&safeMoney(combo.extrasCents),
      'COMBO_PRICE_INVALID');
    const extra=grouped.reduce((sum,row)=>sum+row.extrasCents,0);
    guard(combo.extrasCents===extra&&combo.totalCents===extra+quote.basePricePerComboCents,
      'COMBO_RECONCILIATION_FAILED');
    for(const [groupKey,group] of groupMap){
      if(!groupKey.startsWith(`${c}:`))continue;
      const groupIndex=Number(groupKey.split(':')[1]);
      const seq=grouped.filter(unit=>unit.key.startsWith(`c${c}:${groupIndex}:`)).map(x=>x.unitNumber).sort((a,b)=>a-b);
      guard(seq.length===group.quantity&&seq.every((x,i)=>x===i+1),'COMPONENT_GAP');
    }
  }
  guard(Array.isArray(quote.kitchenPreview58)&&Array.isArray(quote.kitchenPreview80)&&
    quote.kitchenPreview58.length>0&&quote.kitchenPreview80.length>0&&
    quote.kitchenPreview58.every(line=>typeof line==='string'&&Array.from(line).length<=30)&&
    quote.kitchenPreview80.every(line=>typeof line==='string'&&Array.from(line).length<=42)&&
    quote.kitchenPreview58.some(line=>line.includes('NAO IMPRIMIR'))&&
    quote.kitchenPreview80.some(line=>line.includes('NAO IMPRIMIR')),'RECEIPT_PREVIEW_INVALID');
  const blockers=[
    'SITE_ORDER_API_V2_REJECTS_UNIT_LINES',
    'ENTREGAS_RECEIVER_V1_REJECTS_ORDER_V3',
    'SERVER_TRANSACTIONAL_PERSISTENCE_V3_NOT_CERTIFIED',
    'SIGNED_RELAY_AND_IDEMPOTENCY_V3_NOT_CERTIFIED',
    'PHYSICAL_KITCHEN_PRINT_V3_NOT_CERTIFIED',
  ] as const;
  return {
    contract:COMBO_V3_CONTRACT,orderSchemaVersion:3,state:'certification_only',
    authorization:{checkout:false,payment:false,persist:false,relay:false,print:false,production:false},
    orderId:null,eventId:null,idempotencyKey:null,source:'admin_authenticated_server_quote',
    productId:quote.productId,blueprintFingerprint:quote.blueprintFingerprint,
    comboCount:quote.comboCount,unitCount:quote.unitCount,customizedUnitCount:quote.customizedUnitCount,
    item:{productId:quote.productId,quantity:quote.comboCount,lineKind:'combo_with_independent_units',
      basePricePerComboCents:quote.basePricePerComboCents,
      baseForOrderCents:quote.basePricePerComboCents*quote.comboCount,
      extrasForOrderCents:countedExtras,totalCents:quote.totalCents,units},
    receiptPreview:{widths:[58,80],printAuthorized:false,
      preview58:[...quote.kitchenPreview58],preview80:[...quote.kitchenPreview80]},
    acceptance:{priceRecomputedOnServer:true,perUnitIdentityReconciled:true,legacyCheckoutIntact:true,
      receiverV3Supported:false,canonicalOrderPersistenceTested:false,
      signedRelayWithUnitFieldsTested:false,physicalPrinterTested:false,
      liveCheckoutReleased:false,status:'blocked',blockers},
  };
}
