/**
 * DFL SITE R239 — staged cart/checkout handoff for per-unit combo customization.
 * This is intentionally NOT a payable cart item and must never be submitted.
 * The live cart and order API continue to use the v1 item contract.
 * Pure/deterministic: no network, Firebase, storage, time, or side effects.
 */
import {
  parseComboUnitPlan,
  previewComboKitchenInstructions,
  type ComboBlueprint,
  type ComboUnitPlanV2,
} from "./comboUnitPlan";
import {
  reviewComboUnitCommercialDraft,
  previewComboUnitCommercialReceipt,
  type ComboUnitCommercialDraft,
  type ComboUnitCommercialResult,
} from "./comboUnitCommercial";

export const COMBO_UNIT_CART_DRAFT_ENABLED = false as const;
export const COMBO_UNIT_CART_DRAFT_SCHEMA = 1 as const;

const NON_LEGACY_FIELDS = [
  "comboUnitPlan", "unitCustomization", "comboCustomization",
  "comboUnitCartDraft", "unitPlan", "unitSelections", "unitOverrides",
] as const;

const hasOwn = (record: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(record, key);
const isObject = (input: unknown): input is Record<string, unknown> =>
  Boolean(input) && typeof input === "object" && !Array.isArray(input);
function requireDraft(value: unknown, code: string): asserts value {
  if (!value) throw new Error(`COMBO_CART_${code}`);
}

/**
 * A persisted/future field must never be silently stripped by v1 serialization.
 * Inspect the raw cart, not a mapped subset of its fields.
 */
export function inspectLegacyCartForUnitDraft(items: unknown):
  | Readonly<{safe: true}>
  | Readonly<{safe: false; itemIndex: number; reason: "CART_INVALID" | "UNIT_DRAFT_NOT_RELEASED"}> {
  if (!Array.isArray(items)) return {safe:false,itemIndex:-1,reason:"CART_INVALID"};
  for (let index=0; index<items.length; index+=1) {
    if (!isObject(items[index])) return {safe:false,itemIndex:index,reason:"CART_INVALID"};
    const item = items[index];
    if (NON_LEGACY_FIELDS.some(field => hasOwn(item,field)))
      return {safe:false,itemIndex:index,reason:"UNIT_DRAFT_NOT_RELEASED"};
  }
  return {safe:true};
}

function deterministicDraftId(text: string): string {
  // Local draft identity only; hashes are NOT authorization, signatures or price authority.
  let a=2166136261, b=5381;
  for(let i=0;i<text.length;i+=1){
    const char=text.charCodeAt(i);
    a=Math.imul(a ^ char,16777619) >>> 0;
    b=(Math.imul(b,33) ^ char) >>> 0;
  }
  return `draft-${a.toString(16).padStart(8,"0")}-${b.toString(16).padStart(8,"0")}`;
}

export type ComboUnitCartDraft = Readonly<{
  schema:1;
  status:"preview_only";
  payable:false;
  productId:string;
  blueprintFingerprint:string;
  comboQuantity:number;
  draftId:string;
  unitPlan:ComboUnitPlanV2;
  quote:ComboUnitCommercialResult;
  kitchenPreview:readonly string[];
  receiptPreview:readonly string[];
}>;

/**
 * Builds a repeatable PREVIEW. No fallback to legacy selectedAddons or notes.
 * The quote, when present, remains a non-payable commercial simulation.
 */
export function prepareComboUnitCartDraft(
  blueprint:ComboBlueprint,
  rawPlan:ComboUnitPlanV2,
  comboQuantity:number,
  draftPolicy?:ComboUnitCommercialDraft,
):ComboUnitCartDraft {
  requireDraft(Number.isInteger(comboQuantity) && comboQuantity>=1 && comboQuantity<=30,"QUANTITY_INVALID");
  const unitPlan=parseComboUnitPlan(rawPlan,blueprint);
  const quote=reviewComboUnitCommercialDraft(blueprint,unitPlan,comboQuantity,draftPolicy);
  const draftId=deterministicDraftId(JSON.stringify({schema:1,productId:blueprint.productId,fingerprint:blueprint.fingerprint,choices:unitPlan.choices}));
  return {
    schema:1,status:"preview_only",payable:false,
    productId:blueprint.productId,blueprintFingerprint:blueprint.fingerprint,
    comboQuantity,draftId,unitPlan,
    quote,kitchenPreview:previewComboKitchenInstructions(blueprint,unitPlan),
    receiptPreview:previewComboUnitCommercialReceipt(quote),
  };
}

/**
 * Parse a local draft with recomputation; never trust supplied totals/IDs.
 * A mutated preview cannot become a checkout authorization.
 */
export function revalidateComboUnitCartDraft(
  raw:unknown,
  blueprint:ComboBlueprint,
  draftPolicy?:ComboUnitCommercialDraft,
):ComboUnitCartDraft {
  requireDraft(isObject(raw),"DRAFT_INVALID");
  requireDraft(raw.schema===1 && raw.status==="preview_only" && raw.payable===false,"DRAFT_STATUS_INVALID");
  requireDraft(raw.productId===blueprint.productId && raw.blueprintFingerprint===blueprint.fingerprint,"DRAFT_STALE");
  const recomputed=prepareComboUnitCartDraft(blueprint,raw.unitPlan as ComboUnitPlanV2,raw.comboQuantity as number,draftPolicy);
  requireDraft(raw.draftId===recomputed.draftId,"DRAFT_ID_MISMATCH");
  return recomputed;
}

/**
 * Diagnostic handoff ONLY. Not an API payload and intentionally cannot be
 * converted to a v1 order item or used for real payment.
 */
export function previewComboUnitCheckoutHandoff(draft:ComboUnitCartDraft): Readonly<{
  state:"blocked_for_checkout";
  reason:"FEATURE_NOT_RELEASED";
  draftId:string;
  productId:string;
  comboQuantity:number;
  containsUnitChoices:boolean;
  payable:false;
}> {
  requireDraft(draft.status==="preview_only" && draft.payable===false,"DRAFT_STATUS_INVALID");
  return {state:"blocked_for_checkout",reason:"FEATURE_NOT_RELEASED",draftId:draft.draftId,
    productId:draft.productId,comboQuantity:draft.comboQuantity,
    containsUnitChoices:draft.unitPlan.choices.length>0,payable:false};
}
