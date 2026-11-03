/**
 * DFL SITE R243 — modelo de interface de personalizacao individual (LAB / OFF).
 * Somente rascunho local: sem pagamento, carrinho, Firestore, backend, relay ou impressao.
 * Reaproveita as validacoes R237/R238/R239 sem recalcular a regra comercial por conta propria.
 */
import {
  applyComboUnitChange,
  emptyComboUnitPlan,
  parseComboUnitPlan,
  setComboUnitNote,
  type ComboBlueprint,
  type ComboScope,
  type ComboChange,
  type ComboUnitCapabilities,
  type ComboUnitPlanV2,
} from "./comboUnitPlan";
import {
  prepareComboUnitCartDraft,
  type ComboUnitCartDraft,
} from "./comboUnitCartDraft";
import type {ComboUnitCommercialDraft} from "./comboUnitCommercial";

export const COMBO_UNIT_EDITOR_ENABLED = false as const;
export const COMBO_UNIT_EDITOR_SCHEMA = 1 as const;

export type ComboEditorGroup = Readonly<{
  index: number;
  productId: string;
  units: ReadonlyArray<Readonly<{key:string;unitNumber:number;groupQuantity:number}>>;
}>;
export type ComboEditorUnit = Readonly<{
  unitKey: string;
  groupIndex: number;
  unitNumber: number;
  groupQuantity: number;
  productId: string;
  addonIds: readonly string[];
  removedIngredientIds: readonly string[];
  note: string;
  customized: boolean;
}>;

export type ComboEditorReadout = Readonly<{
  version: 1;
  status: "preview_only";
  canAddToCart: false;
  canPay: false;
  canSubmit: false;
  canPrint: false;
  canRelay: false;
  productId: string;
  comboQuantity: number;
  customizedUnitsPerCombo: number;
  customizedUnitsInOrder: number;
  rows: readonly ComboEditorUnit[];
  draft: ComboUnitCartDraft;
  amountCents: number | null;
  amountStatus: "POLICY_REQUIRED" | "ADDON_PRICE_MISSING" | "preview_only";
}>;

function guard(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(`COMBO_EDITOR_${code}`);
}

export function listComboEditorGroups(blueprint: ComboBlueprint): ComboEditorGroup[] {
  guard(Array.isArray(blueprint.units) && blueprint.units.length > 0, "BLUEPRINT_INVALID");
  const groups = new Map<number, ComboEditorGroup>();
  for (const unit of blueprint.units) {
    const previous = groups.get(unit.groupIndex);
    if (!previous) {
      groups.set(unit.groupIndex, {
        index:unit.groupIndex,
        productId:unit.productId,
        units:[{key:unit.key,unitNumber:unit.unitNumber,groupQuantity:unit.groupQuantity}],
      });
    } else {
      guard(previous.productId === unit.productId,"MIXED_GROUP_INVALID");
      groups.set(unit.groupIndex, {
        ...previous,
        units:[...previous.units,{key:unit.key,unitNumber:unit.unitNumber,groupQuantity:unit.groupQuantity}],
      });
    }
  }
  return [...groups.values()].sort((a,b)=>a.index-b.index);
}

export function readComboEditorUnits(blueprint:ComboBlueprint, rawPlan:ComboUnitPlanV2):ComboEditorUnit[] {
  const plan = parseComboUnitPlan(rawPlan,blueprint);
  const byKey = new Map(plan.choices.map(choice=>[choice.unitKey,choice]));
  return blueprint.units.map(unit=>{
    const choice=byKey.get(unit.key);
    const addonIds = choice?.addonIds ?? [];
    const removedIngredientIds = choice?.removedIngredientIds ?? [];
    const note = choice?.note ?? "";
    return {
      unitKey:unit.key,groupIndex:unit.groupIndex,unitNumber:unit.unitNumber,
      groupQuantity:unit.groupQuantity,productId:unit.productId,
      addonIds:[...addonIds],removedIngredientIds:[...removedIngredientIds],note,
      customized:Boolean(addonIds.length || removedIngredientIds.length || note),
    };
  });
}

export function changeComboEditorUnits(
  blueprint:ComboBlueprint,
  plan:ComboUnitPlanV2,
  scope:ComboScope,
  change:ComboChange,
  capabilities:ComboUnitCapabilities,
):ComboUnitPlanV2 {
  return applyComboUnitChange(blueprint,plan,scope,change,capabilities);
}

export function noteComboEditorUnit(
  blueprint:ComboBlueprint,plan:ComboUnitPlanV2,unitKey:string,note:string,
):ComboUnitPlanV2 {
  return setComboUnitNote(blueprint,plan,unitKey,note);
}

export function readComboEditorPreview(
  blueprint:ComboBlueprint,
  plan:ComboUnitPlanV2,
  comboQuantity:number,
  commercialPolicy?:ComboUnitCommercialDraft,
):ComboEditorReadout {
  guard(Number.isSafeInteger(comboQuantity) && comboQuantity>=1 && comboQuantity<=30,"QUANTITY_INVALID");
  const rows=readComboEditorUnits(blueprint,plan);
  const draft=prepareComboUnitCartDraft(blueprint,plan,comboQuantity,commercialPolicy);
  const quote=draft.quote;
  const amountCents=quote.state==="draft_preview_only"?quote.totalCents:null;
  const amountStatus=quote.state==="draft_preview_only"?"preview_only":quote.reason;
  const customizedUnitsPerCombo=rows.filter(unit=>unit.customized).length;
  return {
    version:1,status:"preview_only",canAddToCart:false,canPay:false,canSubmit:false,canPrint:false,canRelay:false,
    productId:blueprint.productId,comboQuantity,
    customizedUnitsPerCombo,customizedUnitsInOrder:customizedUnitsPerCombo*comboQuantity,
    rows,draft,amountCents,amountStatus,
  };
}

export function emptyComboEditor(blueprint:ComboBlueprint):ComboUnitPlanV2 {
  return emptyComboUnitPlan(blueprint);
}
