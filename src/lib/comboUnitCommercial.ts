/**
 * DFL SITE R238 — contrato comercial de personalização por unidade (SOMENTE SIMULAÇÃO).
 * Não é consumido pelo carrinho, checkout, API, Firestore ou DFL Entregas.
 * A tabela de adicionais e seus preços, quando houver integração futura, deverá vir
 * do catálogo autorizado no servidor; cliente nunca será autoridade de preço.
 */
import {parseComboUnitPlan, type ComboBlueprint, type ComboUnitPlanV2} from "./comboUnitPlan";

export const COMBO_UNIT_COMMERCE_ENABLED = false as const;
export const COMBO_UNIT_COMMERCE_SCHEMA = 1 as const;

const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const MAX_PRICE_CENTS = 5_000_000;
const MAX_TOTAL_CENTS = 150_000_000;
const MAX_UNIT_CHOICES = 20;

function guard(value: unknown, code: string): asserts value {
  if (!value) throw new Error(`COMBO_COMMERCE_${code}`);
}
function obj(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function validIds(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= MAX_UNIT_CHOICES &&
    value.every(id => typeof id === "string" && ID.test(id)) &&
    new Set(value).size === value.length;
}
function cents(value: unknown, code: string, max = MAX_PRICE_CENTS): number {
  guard(typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= max, code);
  return value;
}

export type ComboUnitCommercialGroup = Readonly<{
  id: string; min: number; max: number; addonIds: readonly string[];
}>;
export type ComboUnitCommercialRule = Readonly<{
  allowedAddonIds: readonly string[];
  removableIngredientIds: readonly string[];
  addonPriceCents: Readonly<Record<string, number>>;
  minAddonsPerUnit: number;
  maxAddonsPerUnit: number;
  maxRemovalsPerUnit: number;
  groups: readonly ComboUnitCommercialGroup[];
}>;
export type ComboUnitCommercialDraft = Readonly<{
  version: 1;
  status: "draft";
  billing: "per_selected_unit";
  removalDiscount: "none";
  productId: string;
  blueprintFingerprint: string;
  baseComboPriceCents: number;
  rulesByProductId: Readonly<Record<string, ComboUnitCommercialRule>>;
}>;
export type ComboCommercialUnitLine = Readonly<{
  unitKey: string;
  productId: string;
  unitNumber: number;
  groupQuantity: number;
  addons: readonly Readonly<{id: string; priceCents: number}>[];
  removals: readonly string[];
  note: string;
  extrasCents: number;
}>;
export type ComboUnitCommercialResult =
  | Readonly<{state:"blocked"; reason:"POLICY_REQUIRED" | "ADDON_PRICE_MISSING"; addonId?:string; productId?:string; totalCents:null}>
  | Readonly<{
    state:"draft_preview_only";
    isPayable:false;
    version:1;
    productId:string;
    blueprintFingerprint:string;
    baseComboPriceCents:number;
    extrasPerComboCents:number;
    quantity:number;
    extrasForOrderCents:number;
    totalCents:number;
    chargedAddonUnits:number;
    units:readonly ComboCommercialUnitLine[];
  }>;

/**
 * Parse *estrito* de política draft: recusa outro combo, composição desatualizada,
 * preço fracionário, IDs duplicados e limites comerciais inconsistentes.
 */
export function parseComboUnitCommercialDraft(raw:unknown, blueprint:ComboBlueprint):ComboUnitCommercialDraft {
  guard(obj(raw), "POLICY_INVALID");
  guard(raw.version === 1 && raw.status === "draft" && raw.billing === "per_selected_unit" && raw.removalDiscount === "none", "POLICY_MODE_INVALID");
  guard(raw.productId === blueprint.productId && raw.blueprintFingerprint === blueprint.fingerprint, "POLICY_STALE_OR_FOREIGN");
  const baseComboPriceCents = cents(raw.baseComboPriceCents, "BASE_PRICE_INVALID");
  guard(obj(raw.rulesByProductId), "COMPONENT_RULES_INVALID");
  const uniqueProducts = [...new Set(blueprint.units.map(unit => unit.productId))];
  guard(Object.keys(raw.rulesByProductId).length === uniqueProducts.length &&
    Object.keys(raw.rulesByProductId).every(id => uniqueProducts.includes(id)), "COMPONENT_RULES_MISMATCH");
  const rulesByProductId:Record<string,ComboUnitCommercialRule> = Object.create(null) as Record<string,ComboUnitCommercialRule>;
  for (const productId of uniqueProducts) {
    guard(Object.prototype.hasOwnProperty.call(raw.rulesByProductId, productId), "COMPONENT_RULE_MISSING");
    const source = raw.rulesByProductId[productId];
    guard(obj(source), "COMPONENT_RULE_MISSING");
    const allowedAddonIds=source.allowedAddonIds;
    const removableIngredientIds=source.removableIngredientIds;
    guard(validIds(allowedAddonIds) && validIds(removableIngredientIds), "OPTION_IDS_INVALID");
    guard(obj(source.addonPriceCents), "PRICE_TABLE_INVALID");
    guard(Object.keys(source.addonPriceCents).every(id => allowedAddonIds.includes(id)), "PRICE_TABLE_UNEXPECTED_ID");
    const addonPriceCents:Record<string,number> = Object.create(null) as Record<string,number>;
    for (const id of Object.keys(source.addonPriceCents)) {
      addonPriceCents[id] = cents(source.addonPriceCents[id], "ADDON_PRICE_INVALID", 1_000_000);
    }
    const min = cents(source.minAddonsPerUnit, "MIN_ADDONS_INVALID", MAX_UNIT_CHOICES);
    const max = cents(source.maxAddonsPerUnit, "MAX_ADDONS_INVALID", MAX_UNIT_CHOICES);
    const maxRemovals = cents(source.maxRemovalsPerUnit, "MAX_REMOVALS_INVALID", MAX_UNIT_CHOICES);
    guard(min <= max && max <= allowedAddonIds.length && maxRemovals <= removableIngredientIds.length, "OPTION_LIMITS_INVALID");
    guard(Array.isArray(source.groups) && source.groups.length <= 8, "GROUPS_INVALID");
    const groups:ComboUnitCommercialGroup[]=[];
    const usedIds = new Set<string>();
    const usedAddonIds = new Set<string>();
    for (const entry of source.groups) {
      guard(obj(entry), "GROUP_INVALID");
      guard(typeof entry.id === "string" && ID.test(entry.id) && !usedIds.has(entry.id), "GROUP_ID_INVALID");
      usedIds.add(entry.id);
      guard(validIds(entry.addonIds) && entry.addonIds.length > 0, "GROUP_ADDONS_INVALID");
      const groupMin=cents(entry.min, "GROUP_MIN_INVALID", MAX_UNIT_CHOICES);
      const groupMax=cents(entry.max, "GROUP_MAX_INVALID", MAX_UNIT_CHOICES);
      guard(groupMin<=groupMax && groupMax<=entry.addonIds.length, "GROUP_LIMITS_INVALID");
      for (const id of entry.addonIds) {
        guard(allowedAddonIds.includes(id) && !usedAddonIds.has(id), "GROUP_CONFLICT_OR_FOREIGN_ADDON");
        usedAddonIds.add(id);
      }
      groups.push({id:entry.id,min:groupMin,max:groupMax,addonIds:[...entry.addonIds]});
    }
    guard(groups.reduce((sum, group) => sum + group.min, 0) <= max, "GROUPS_EXCEED_GLOBAL_MAX");
    rulesByProductId[productId] = {
      allowedAddonIds:[...allowedAddonIds],
      removableIngredientIds:[...removableIngredientIds],
      addonPriceCents,
      minAddonsPerUnit:min,
      maxAddonsPerUnit:max,
      maxRemovalsPerUnit:maxRemovals,
      groups,
    };
  }
  return {version:1,status:"draft",billing:"per_selected_unit",removalDiscount:"none",
    productId:blueprint.productId,blueprintFingerprint:blueprint.fingerprint,
    baseComboPriceCents,rulesByProductId};
}

/**
 * Simulação apenas: nem status de aprovação nem qualquer campo aqui são aceitos
 * para pagamento. Não altera o contrato v1 de carrinho e checkout.
 */
export function reviewComboUnitCommercialDraft(
  blueprint:ComboBlueprint,
  rawPlan:ComboUnitPlanV2 | unknown,
  quantity:number,
  rawDraft?:unknown,
):ComboUnitCommercialResult {
  const plan=parseComboUnitPlan(rawPlan, blueprint);
  guard(Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= 30, "QUANTITY_INVALID");
  if (rawDraft === undefined) return {state:"blocked",reason:"POLICY_REQUIRED",totalCents:null};
  const draft=parseComboUnitCommercialDraft(rawDraft, blueprint);
  const byKey=new Map(plan.choices.map(choice=>[choice.unitKey,choice]));
  const units:ComboCommercialUnitLine[]=[];
  let extrasPerComboCents=0;
  let chargedAddonUnits=0;
  for (const unit of blueprint.units) {
    const rule=draft.rulesByProductId[unit.productId];
    const choice=byKey.get(unit.key);
    const addonIds=choice?.addonIds??[];
    const removalIds=choice?.removedIngredientIds??[];
    guard(addonIds.every(id=>rule.allowedAddonIds.includes(id)), "UNIT_ADDON_NOT_ALLOWED");
    guard(removalIds.every(id=>rule.removableIngredientIds.includes(id)), "UNIT_REMOVAL_NOT_ALLOWED");
    guard(addonIds.length>=rule.minAddonsPerUnit && addonIds.length<=rule.maxAddonsPerUnit, "UNIT_ADDON_LIMIT");
    guard(removalIds.length<=rule.maxRemovalsPerUnit, "UNIT_REMOVAL_LIMIT");
    for (const group of rule.groups) {
      const count=addonIds.filter(id=>group.addonIds.includes(id)).length;
      guard(count>=group.min && count<=group.max, "UNIT_ADDON_GROUP_LIMIT");
    }
    let unitExtrasCents=0;
    const addons:{id:string;priceCents:number}[]=[];
    for (const id of addonIds) {
      const price=Object.prototype.hasOwnProperty.call(rule.addonPriceCents,id)
        ? rule.addonPriceCents[id] : undefined;
      if (price===undefined) return {state:"blocked",reason:"ADDON_PRICE_MISSING",addonId:id,productId:unit.productId,totalCents:null};
      const priceCents=cents(price,"ADDON_PRICE_INVALID",1_000_000);
      unitExtrasCents+=priceCents;
      guard(Number.isSafeInteger(unitExtrasCents) && unitExtrasCents<=MAX_TOTAL_CENTS,"TOTAL_INVALID");
      addons.push({id,priceCents});
      chargedAddonUnits++;
    }
    extrasPerComboCents+=unitExtrasCents;
    guard(Number.isSafeInteger(extrasPerComboCents) && extrasPerComboCents<=MAX_TOTAL_CENTS,"TOTAL_INVALID");
    units.push({unitKey:unit.key,productId:unit.productId,unitNumber:unit.unitNumber,
      groupQuantity:unit.groupQuantity,addons,removals:[...removalIds],note:choice?.note??"",extrasCents:unitExtrasCents});
  }
  const extrasForOrderCents=extrasPerComboCents*quantity;
  const totalCents=(draft.baseComboPriceCents+extrasPerComboCents)*quantity;
  guard(Number.isSafeInteger(totalCents) && totalCents<=MAX_TOTAL_CENTS,"TOTAL_INVALID");
  return {state:"draft_preview_only",isPayable:false,version:1,productId:blueprint.productId,
    blueprintFingerprint:blueprint.fingerprint,baseComboPriceCents:draft.baseComboPriceCents,
    extrasPerComboCents,quantity,extrasForOrderCents,totalCents,chargedAddonUnits:chargedAddonUnits*quantity,units};
}

/** Prévia textual para QA, nunca substitui a ordem de produção ou o cupom fiscal. */
export function previewComboUnitCommercialReceipt(result:ComboUnitCommercialResult):readonly string[] {
  if (result.state!=="draft_preview_only") return ["SIMULAÇÃO BLOQUEADA — nenhuma cobrança autorizada"];
  const money=(v:number)=>`R$ ${(v/100).toFixed(2).replace(".",",")}`;
  return [
    `SIMULAÇÃO — NÃO COBRAR / NÃO ENVIAR À COZINHA`,
    `${result.quantity} combo(s) ${result.productId}: ${money(result.totalCents)}`,
    `Base por combo ${money(result.baseComboPriceCents)} · extras por combo ${money(result.extrasPerComboCents)}`,
    ...result.units.map(unit=>{
      const extras=unit.addons.map(item=>`+ ${item.id} (${money(item.priceCents)})`);
      const removals=unit.removals.map(id=>`sem ${id} (sem desconto)`);
      return `${unit.productId} ${unit.unitNumber}/${unit.groupQuantity}: ${[...extras,...removals,unit.note].filter(Boolean).join(" · ")||"padrão"}`;
    }),
  ];
}
