/**
 * DFL SITE R237 — motor isolado para futura personalização por unidade de combo.
 * NÃO é o contrato de preço, carrinho, checkout ou Entregas em produção.
 * Ativação depende de regra comercial explícita + integração homologada ponta a ponta.
 * Sem Firestore, network, relógio, session/localStorage ou efeitos colaterais.
 */
export const COMBO_UNIT_CUSTOMIZATION_ENABLED = false as const;
export const COMBO_UNIT_PLAN_VERSION = 2 as const;

const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const MAX_GROUPS = 20;
const MAX_UNITS = 60;
const MAX_PER_GROUP = 30;
const MAX_CHOICES = 20;
const MAX_NOTE = 140;

function requireValid(valid: unknown, error: string): asserts valid {
  if (!valid) throw new Error(`COMBO_UNIT_${error}`);
}

export type ComboComponentSpec = Readonly<{ productId: string; quantity: number }>;
export type ComboUnit = Readonly<{
  key: string;
  groupIndex: number;
  productId: string;
  unitNumber: number;
  groupQuantity: number;
}>;
export type ComboBlueprint = Readonly<{
  productId: string;
  fingerprint: string;
  units: readonly ComboUnit[];
}>;
export type ComboUnitChoice = Readonly<{
  unitKey: string;
  addonIds: readonly string[];
  removedIngredientIds: readonly string[];
  note: string;
}>;
export type ComboUnitPlanV2 = Readonly<{
  version: 2;
  productId: string;
  blueprintFingerprint: string;
  choices: readonly ComboUnitChoice[];
}>;
export type ComboScope = Readonly<{
  groupIndex: number;
  mode: "all" | "one" | "selected";
  unitKeys?: readonly string[];
}>;
export type ComboChange = Readonly<{
  field: "addon" | "removal";
  id: string;
  enabled: boolean;
}>;
export type ComboUnitCapabilities = Readonly<{
  addonIdsByProduct: Readonly<Record<string, readonly string[]>>;
  removableIdsByProduct: Readonly<Record<string, readonly string[]>>;
}>;

function signature(input: string): string {
  // Determinístico para detectar mudança de composição, sem dados pessoais.
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(i), 16777619) >>> 0;
  }
  return `v2-${hash.toString(16).padStart(8, "0")}`;
}

export function buildComboBlueprint(productId: string, components: readonly ComboComponentSpec[]): ComboBlueprint {
  requireValid(ID.test(productId), "PRODUCT_ID_INVALID");
  requireValid(Array.isArray(components) && components.length > 0 && components.length <= MAX_GROUPS, "COMPOSITION_INVALID");
  const units: ComboUnit[] = [];
  for (let groupIndex = 0; groupIndex < components.length; groupIndex += 1) {
    const component = components[groupIndex];
    requireValid(component && ID.test(component.productId), "COMPONENT_ID_INVALID");
    requireValid(Number.isInteger(component.quantity) && component.quantity >= 1 && component.quantity <= MAX_PER_GROUP, "QUANTITY_INVALID");
    requireValid(units.length + component.quantity <= MAX_UNITS, "TOO_MANY_UNITS");
    for (let unitNumber = 1; unitNumber <= component.quantity; unitNumber += 1) {
      units.push({key: `${groupIndex + 1}:${unitNumber}`, groupIndex, productId: component.productId, unitNumber, groupQuantity: component.quantity});
    }
  }
  const compositionSignature = components.map((component, index) => `${index}:${component.productId}:${component.quantity}`).join("|");
  return {productId, fingerprint:signature(`${productId}|${compositionSignature}`), units};
}

export function emptyComboUnitPlan(blueprint: ComboBlueprint): ComboUnitPlanV2 {
  return {version:2, productId:blueprint.productId, blueprintFingerprint:blueprint.fingerprint, choices:[]};
}

const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isValidIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length <= MAX_CHOICES && value.every(item => typeof item === "string" && ID.test(item)) && new Set(value).size === value.length;

/** Parse estrito: dados antigos, adulterados ou ligados a outra composição nunca são reusados. */
export function parseComboUnitPlan(raw: unknown, blueprint: ComboBlueprint): ComboUnitPlanV2 {
  requireValid(isObject(raw), "PLAN_INVALID");
  requireValid(raw.version === 2, "PLAN_VERSION_INVALID");
  requireValid(raw.productId === blueprint.productId, "PLAN_PRODUCT_MISMATCH");
  requireValid(raw.blueprintFingerprint === blueprint.fingerprint, "PLAN_STALE_COMPOSITION");
  requireValid(Array.isArray(raw.choices) && raw.choices.length <= blueprint.units.length, "CHOICES_INVALID");
  const allowedUnits = new Set(blueprint.units.map(unit => unit.key));
  const used = new Set<string>();
  const choices: ComboUnitChoice[] = [];
  for (const rawChoice of raw.choices) {
    requireValid(isObject(rawChoice), "CHOICE_INVALID");
    const unitKey = rawChoice.unitKey;
    requireValid(typeof unitKey === "string" && allowedUnits.has(unitKey) && !used.has(unitKey), "UNIT_UNKNOWN_OR_REPEATED");
    requireValid(isValidIdList(rawChoice.addonIds) && isValidIdList(rawChoice.removedIngredientIds), "ITEM_IDS_INVALID");
    requireValid(typeof rawChoice.note === "string" && rawChoice.note.length <= MAX_NOTE, "NOTE_INVALID");
    used.add(unitKey);
    const note = rawChoice.note.trim();
    if (rawChoice.addonIds.length || rawChoice.removedIngredientIds.length || note) {
      choices.push({
        unitKey,
        addonIds:[...rawChoice.addonIds].sort(),
        removedIngredientIds:[...rawChoice.removedIngredientIds].sort(),
        note,
      });
    }
  }
  choices.sort((a,b) => blueprint.units.findIndex(unit => unit.key === a.unitKey) - blueprint.units.findIndex(unit => unit.key === b.unitKey));
  return {version:2,productId:blueprint.productId,blueprintFingerprint:blueprint.fingerprint,choices};
}

function chosenUnits(blueprint: ComboBlueprint, scope: ComboScope): readonly ComboUnit[] {
  requireValid(Number.isInteger(scope.groupIndex) && scope.groupIndex >= 0, "SCOPE_GROUP_INVALID");
  const group = blueprint.units.filter(unit => unit.groupIndex === scope.groupIndex);
  requireValid(group.length > 0, "SCOPE_GROUP_UNKNOWN");
  if (scope.mode === "all") {
    requireValid(!scope.unitKeys?.length, "SCOPE_ALL_KEYS_INVALID");
    return group;
  }
  requireValid(scope.mode === "one" || scope.mode === "selected", "SCOPE_MODE_INVALID");
  requireValid(Array.isArray(scope.unitKeys) && scope.unitKeys.length > 0 && new Set(scope.unitKeys).size === scope.unitKeys.length, "SCOPE_KEYS_INVALID");
  if (scope.mode === "one") requireValid(scope.unitKeys.length === 1, "SCOPE_SINGLE_INVALID");
  const allowed = new Set(group.map(unit => unit.key));
  requireValid(scope.unitKeys.every(key => allowed.has(key)), "SCOPE_CROSSES_COMPONENTS");
  return group.filter(unit => scope.unitKeys?.includes(unit.key));
}

/** Ações 1 / todos / seleção, restritas ao MESMO componente (nunca aplicam bacon a bebida). */
export function applyComboUnitChange(
  blueprint: ComboBlueprint,
  rawPlan: ComboUnitPlanV2,
  scope: ComboScope,
  change: ComboChange,
  capabilities: ComboUnitCapabilities,
): ComboUnitPlanV2 {
  const plan = parseComboUnitPlan(rawPlan, blueprint);
  const targets = chosenUnits(blueprint, scope);
  requireValid(ID.test(change.id) && typeof change.enabled === "boolean", "CHANGE_INVALID");
  const componentId = targets[0].productId;
  const allowed = change.field === "addon" ? capabilities.addonIdsByProduct[componentId] :
    change.field === "removal" ? capabilities.removableIdsByProduct[componentId] : undefined;
  requireValid(Array.isArray(allowed) && allowed.includes(change.id), "CHANGE_NOT_ALLOWED_FOR_COMPONENT");
  const targetSet = new Set(targets.map(unit => unit.key));
  const original = new Map(plan.choices.map(choice => [choice.unitKey, choice]));
  const updated = blueprint.units.flatMap<ComboUnitChoice>(unit => {
    const previous = original.get(unit.key);
    if (!targetSet.has(unit.key)) return previous ? [previous] : [];
    const addonIds = new Set(previous?.addonIds ?? []);
    const removedIngredientIds = new Set(previous?.removedIngredientIds ?? []);
    const active = change.field === "addon" ? addonIds : removedIngredientIds;
    if (change.enabled) active.add(change.id);
    else active.delete(change.id);
    requireValid(addonIds.size <= MAX_CHOICES && removedIngredientIds.size <= MAX_CHOICES, "CHOICE_LIMIT_EXCEEDED");
    if (!addonIds.size && !removedIngredientIds.size && !previous?.note) return [];
    return [{unitKey:unit.key,addonIds:[...addonIds].sort(),removedIngredientIds:[...removedIngredientIds].sort(),note:previous?.note ?? ""}];
  });
  return {version:2,productId:blueprint.productId,blueprintFingerprint:blueprint.fingerprint,choices:updated};
}

export function setComboUnitNote(blueprint: ComboBlueprint, rawPlan: ComboUnitPlanV2, unitKey: string, note: string): ComboUnitPlanV2 {
  const plan = parseComboUnitPlan(rawPlan, blueprint);
  requireValid(blueprint.units.some(unit => unit.key === unitKey), "NOTE_UNIT_UNKNOWN");
  requireValid(typeof note === "string" && note.length <= MAX_NOTE, "NOTE_INVALID");
  const normalized = note.trim();
  const existing = new Map(plan.choices.map(choice => [choice.unitKey, choice]));
  const choices = blueprint.units.flatMap<ComboUnitChoice>(unit => {
    const old = existing.get(unit.key);
    if (unit.key !== unitKey) return old ? [old] : [];
    if (!normalized && !old?.addonIds.length && !old?.removedIngredientIds.length) return [];
    return [{unitKey,addonIds:[...(old?.addonIds ?? [])],removedIngredientIds:[...(old?.removedIngredientIds ?? [])],note:normalized}];
  });
  return {version:2,productId:blueprint.productId,blueprintFingerprint:blueprint.fingerprint,choices};
}

/** Prévia SOMENTE de instruções; o fluxo de produção não consome este retorno. */
export function previewComboKitchenInstructions(blueprint: ComboBlueprint, rawPlan: ComboUnitPlanV2): string[] {
  const plan = parseComboUnitPlan(rawPlan, blueprint);
  const byKey = new Map(plan.choices.map(choice => [choice.unitKey, choice]));
  return blueprint.units.map(unit => {
    const choice = byKey.get(unit.key);
    const actions = [
      ...(choice?.addonIds ?? []).map(id => `+ ${id}`),
      ...(choice?.removedIngredientIds ?? []).map(id => `sem ${id}`),
      ...(choice?.note ? [choice.note] : []),
    ];
    return `${unit.productId} ${unit.unitNumber}/${unit.groupQuantity}: ${actions.length ? actions.join(" · ") : "padrão"}`;
  });
}

export type ComboUnitPricePolicy = Readonly<{
  billing: "per_customized_unit";
  removalDiscount: "none";
  addonPriceCents: Readonly<Record<string, number>>;
}>;
export type ComboUnitPricePreview =
  | Readonly<{state:"requires_commercial_approval";totalCents:null}>
  | Readonly<{state:"missing_price";totalCents:null;addonId:string}>
  | Readonly<{state:"preview_only";baseCents:number;extrasPerComboCents:number;quantity:number;totalCents:number}>;

/** Sem política comercial explícita, NÃO fornece preço nem autoriza finalizar pedido. */
export function previewComboUnitPrice(
  blueprint: ComboBlueprint,
  rawPlan: ComboUnitPlanV2,
  baseCents: number,
  comboQuantity: number,
  policy?: ComboUnitPricePolicy,
): ComboUnitPricePreview {
  const plan = parseComboUnitPlan(rawPlan, blueprint);
  requireValid(Number.isSafeInteger(baseCents) && baseCents >= 0 && baseCents <= 5_000_000, "BASE_PRICE_INVALID");
  requireValid(Number.isSafeInteger(comboQuantity) && comboQuantity >= 1 && comboQuantity <= 30, "CART_QUANTITY_INVALID");
  if (!policy) return {state:"requires_commercial_approval",totalCents:null};
  requireValid(policy.billing === "per_customized_unit" && policy.removalDiscount === "none", "PRICE_POLICY_INVALID");
  let extrasPerComboCents = 0;
  for (const choice of plan.choices) {
    for (const addonId of choice.addonIds) {
      const cents = policy.addonPriceCents[addonId];
      if (cents === undefined) return {state:"missing_price",totalCents:null,addonId};
      requireValid(Number.isSafeInteger(cents) && cents >= 0 && cents <= 1_000_000, "ADDON_PRICE_INVALID");
      extrasPerComboCents += cents;
    }
  }
  const totalCents = (baseCents + extrasPerComboCents) * comboQuantity;
  requireValid(Number.isSafeInteger(totalCents) && totalCents <= 150_000_000, "TOTAL_INVALID");
  return {state:"preview_only",baseCents,extrasPerComboCents,quantity:comboQuantity,totalCents};
}
