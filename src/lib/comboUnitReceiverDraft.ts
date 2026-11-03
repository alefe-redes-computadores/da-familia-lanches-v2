/**
 * DFL SITE R241 — versioned compatibility draft for future Site -> Entregas handoff.
 * READ ONLY, never an order event. No import into checkout, Firestore, outbox or print.
 *
 * Current Entregas receiver V1 flattens each commercial line into selected_addons
 * and observation, so unit-specific choices WOULD BE LOST. This contract refuses
 * to mistake the currently accepted envelope schema_version=1 for per-unit support.
 */
import type { ComboUnitOperationalPreview } from "./comboUnitOperationalDraft";

export const COMBO_UNIT_RECEIVER_ENABLED = false as const;
export const COMBO_UNIT_RECEIVER_DRAFT_VERSION = 1 as const;
export const COMBO_UNIT_RECEIVER_CONTRACT = "dfl_site_combo_units_preview_v1" as const;
export const REQUIRED_CONSUMER_CAPABILITY = "dfl_site_combo_unit_lines_v1" as const;

/** Frozen audit of the Entregas receiver, not a live capability check or deployment proof. */
export const OBSERVED_ENTREGAS_V1 = Object.freeze({
  source: "dfl_entregas/lib/integration/site-order.ts",
  integrationEnvelopeSchema: 1,
  commercialSnapshotSchema: 1,
  acceptsSiteOrderSchemaAtLeast: 1,
  canPreservePerUnitSelections: false,
  recognizesContract: false,
  identity: "site-order-v1__<orderId>",
} as const);

const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const UNIT_ID = /^c([1-9][0-9]*):([1-9][0-9]*):([1-9][0-9]*)$/;
const MAX_UNITS = 1800;
const MAX_CENTS = 150_000_000;
function guard(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(`COMBO_RECEIVER_${reason}`);
}
const goodCents = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= MAX_CENTS;
const goodLabel = (n: unknown): n is string => typeof n === "string" && n.trim().length > 0 && n.length <= 140 &&
  !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(n);
const safeRecord = (input: unknown): input is Record<string, unknown> =>
  Boolean(input) && typeof input === "object" && !Array.isArray(input);

export type ReceiverDraftAddon = Readonly<{ id: string; label: string; priceCents: number }>;
export type ReceiverDraftRemoval = Readonly<{ id: string; label: string }>;
export type ReceiverDraftUnit = Readonly<{
  unitKey: string;
  comboNumber: number;
  componentKey: string;
  productId: string;
  productLabel: string;
  unitNumber: number;
  groupQuantity: number;
  addons: readonly ReceiverDraftAddon[];
  removals: readonly ReceiverDraftRemoval[];
  note: string;
  extrasCents: number;
}>;
export type ComboReceiverDraftV1 = Readonly<{
  contract: typeof COMBO_UNIT_RECEIVER_CONTRACT;
  version: 1;
  status: "preview_only";
  authorization: Readonly<{order:false;checkout:false;payment:false;relay:false;print:false;production:false}>;
  producer: Readonly<{system:"dfl_site"; envelopeSchema:1; currentOrderSchema:2; proposedUnitOrderSchema:3}>;
  consumer: Readonly<{system:"dfl_entregas"; requiredCapability:typeof REQUIRED_CONSUMER_CAPABILITY; observedSchema:1; supportsUnits:false}>;
  source: Readonly<{productId:string; blueprintFingerprint:string; draftId:string; previewId:string; quantity:number}>;
  accounting: Readonly<{basePerComboCents:number; extrasPerComboCents:number; extrasForOrderCents:number; previewTotalCents:number; payable:false}>;
  units:readonly ReceiverDraftUnit[];
  safety: Readonly<{losslessForLegacyReceiver:false; requiresEntregasUpgrade:true; unitChoices:number; addonUnits:number; removedIngredients:number; annotatedUnits:number}>;
  diagnosticId:string;
  eventId:null;
  orderId:null;
  sendAllowed:false;
}>;

function hash(value: string): string {
  // Diagnostic checksum only. NOT an authorization token, MAC or event ID.
  let value32 = 2166136261;
  for (const char of value) value32 = Math.imul(value32 ^ char.charCodeAt(0), 16777619) >>> 0;
  return `diagnostic-${value32.toString(16).padStart(8,"0")}`;
}

function verifyOperational(packet: ComboUnitOperationalPreview): void {
  guard(safeRecord(packet), "PACKET_INVALID");
  guard(packet.schema === 1 && packet.state === "preview_only", "PACKET_SCHEMA_INVALID");
  guard(packet.authorization?.checkout === false && packet.authorization?.print === false &&
    packet.authorization?.relay === false && packet.authorization?.production === false,"PACKET_AUTH_INVALID");
  guard(packet.deliveriesPreview?.schema === "dfl_combo_unit_delivery_preview_v1" &&
    packet.deliveriesPreview.sendAllowed === false && packet.deliveriesPreview.orderId === null &&
    packet.deliveriesPreview.eventId === null,"PACKET_DELIVERY_AUTH_INVALID");
  guard(packet.totals?.chargeAuthorized === false && goodCents(packet.totals.basePerComboCents) &&
    goodCents(packet.totals.extrasPerComboCents) && goodCents(packet.totals.extrasForOrderCents) &&
    goodCents(packet.totals.previewTotalCents),"PACKET_PRICE_INVALID");
  guard(packet.resolvedLabels === true && Array.isArray(packet.missingLabels) && packet.missingLabels.length === 0,
    "LABELS_UNRESOLVED");
  guard(ID.test(packet.productId) && typeof packet.draftId === "string" && packet.draftId.length <= 100 &&
    packet.draftId.startsWith("draft-") && typeof packet.blueprintFingerprint === "string" &&
    /^v2-[a-f0-9]{8}$/.test(packet.blueprintFingerprint),"SOURCE_ID_INVALID");
  guard(Number.isInteger(packet.comboQuantity) && packet.comboQuantity > 0 && packet.comboQuantity <= 30,
    "QUANTITY_INVALID");
  guard(packet.previewId === `${packet.draftId}|q${packet.comboQuantity}|${packet.blueprintFingerprint}`,
    "PREVIEW_ID_MISMATCH");
  guard(Array.isArray(packet.units) && packet.units.length > 0 && packet.units.length <= MAX_UNITS &&
    packet.units.length % packet.comboQuantity === 0,"UNITS_INVALID");
  guard(packet.deliveriesPreview.lines.length === packet.units.length,
    "DELIVERY_UNIT_COUNT_MISMATCH");
  let extras = 0;
  const keys = new Set<string>();
  for (let i=0; i<packet.units.length; i++) {
    const unit = packet.units[i];
    guard(safeRecord(unit),"UNIT_INVALID");
    guard(typeof unit.key === "string" && UNIT_ID.test(unit.key) && !keys.has(unit.key),"UNIT_KEY_INVALID");
    keys.add(unit.key);
    const matched=UNIT_ID.exec(unit.key);
    guard(Boolean(matched) && unit.key === `c${unit.comboNumber}:${unit.componentKey}` &&
      unit.componentKey === `${matched![2]}:${matched![3]}` &&
      Number.isInteger(unit.comboNumber) && unit.comboNumber === Number(matched![1]) &&
      unit.comboNumber >= 1 && unit.comboNumber <= packet.comboQuantity &&
      typeof unit.unitNumber === "number" && Number.isInteger(unit.unitNumber) && unit.unitNumber === Number(matched![3]) &&
      typeof unit.groupQuantity === "number" && Number.isInteger(unit.groupQuantity) && unit.groupQuantity >= unit.unitNumber,
      "UNIT_IDENTITY_INVALID");
    guard(typeof unit.productId === "string" && ID.test(unit.productId) && goodLabel(unit.productLabel) &&
      typeof unit.note === "string" && unit.note.length <= 140 &&
      !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(unit.note),"UNIT_DESCRIPTION_INVALID");
    guard(Array.isArray(unit.addons) && Array.isArray(unit.removals) &&
      unit.addons.length <= 20 && unit.removals.length <= 20,"UNIT_CHOICES_INVALID");
    let unitExtras=0;
    const addIds = new Set<string>(); const removedIds = new Set<string>();
    for (const a of unit.addons) {
      guard(safeRecord(a) && typeof a.id === "string" && ID.test(a.id) && !addIds.has(a.id) &&
        goodLabel(a.label) && goodCents(a.priceCents),"ADDON_INVALID");
      addIds.add(a.id);unitExtras+=a.priceCents;
    }
    for (const r of unit.removals) {
      guard(safeRecord(r) && typeof r.id === "string" && ID.test(r.id) && !removedIds.has(r.id) &&
        goodLabel(r.label),"REMOVAL_INVALID");
      removedIds.add(r.id);
    }
    guard(goodCents(unit.extrasCents) && unitExtras === unit.extrasCents,"UNIT_EXTRA_MISMATCH");
    extras+=unitExtras;
    guard(packet.deliveriesPreview.lines[i]?.key === unit.key &&
      packet.deliveriesPreview.lines[i]?.productId === unit.productId &&
      packet.deliveriesPreview.lines[i]?.extrasCents === unit.extrasCents,
      "DELIVERY_UNIT_MISMATCH");
  }
  const perCombo=packet.units.length / packet.comboQuantity;
  for(let combo=0;combo<packet.comboQuantity;combo++){
    const sample=packet.units.slice(combo*perCombo,(combo+1)*perCombo);
    guard(sample.every((item,index)=>item.comboNumber===combo+1 &&
      (combo===0 || item.componentKey === packet.units[index].componentKey)),"COMBO_REPETITION_INVALID");
  }
  guard(extras === packet.totals.extrasForOrderCents &&
    packet.totals.extrasForOrderCents === packet.totals.extrasPerComboCents * packet.comboQuantity &&
    packet.totals.previewTotalCents ===
      packet.totals.basePerComboCents * packet.comboQuantity + extras,
    "TOTAL_RECONCILIATION_FAILED");
}

/**
 * Convert validated R240 operational preview into a versioned, transportable
 * *diagnostic*, preserving every unit. Never builds a live event/envelope.
 */
export function projectComboUnitReceiverDraft(packet: ComboUnitOperationalPreview): ComboReceiverDraftV1 {
  verifyOperational(packet);
  const units:ReceiverDraftUnit[]=packet.units.map(unit=>({
    unitKey:unit.key,comboNumber:unit.comboNumber,componentKey:unit.componentKey,
    productId:unit.productId,productLabel:unit.productLabel,unitNumber:unit.unitNumber,
    groupQuantity:unit.groupQuantity,
    addons:unit.addons.map(addon=>({id:addon.id,label:addon.label,priceCents:addon.priceCents})),
    removals:unit.removals.map(removal=>({id:removal.id,label:removal.label})),
    note:unit.note,extrasCents:unit.extrasCents,
  }));
  const accounting={
    basePerComboCents:packet.totals.basePerComboCents,
    extrasPerComboCents:packet.totals.extrasPerComboCents,
    extrasForOrderCents:packet.totals.extrasForOrderCents,
    previewTotalCents:packet.totals.previewTotalCents,payable:false as const,
  };
  const source={productId:packet.productId,blueprintFingerprint:packet.blueprintFingerprint,
    draftId:packet.draftId,previewId:packet.previewId,quantity:packet.comboQuantity};
  const safety={losslessForLegacyReceiver:false as const,requiresEntregasUpgrade:true as const,
    unitChoices:units.filter(u=>u.addons.length || u.removals.length || u.note.length).length,
    addonUnits:units.reduce((sum,u)=>sum+u.addons.length,0),
    removedIngredients:units.reduce((sum,u)=>sum+u.removals.length,0),
    annotatedUnits:units.filter(u=>u.note.length).length};
  const diagnosticId=hash(JSON.stringify({source,accounting,units}));
  return {
    contract:COMBO_UNIT_RECEIVER_CONTRACT,version:1,status:"preview_only",
    authorization:{order:false,checkout:false,payment:false,relay:false,print:false,production:false},
    producer:{system:"dfl_site",envelopeSchema:1,currentOrderSchema:2,proposedUnitOrderSchema:3},
    consumer:{system:"dfl_entregas",requiredCapability:REQUIRED_CONSUMER_CAPABILITY,observedSchema:1,supportsUnits:false},
    source,accounting,units,safety,diagnosticId,eventId:null,orderId:null,sendAllowed:false,
  };
}

/** JSON roundtrip is a future contract test, not an acceptance proof. */
export function revalidateComboUnitReceiverDraft(raw:unknown, source:ComboUnitOperationalPreview):ComboReceiverDraftV1 {
  guard(safeRecord(raw),"DRAFT_INVALID");
  const expected=projectComboUnitReceiverDraft(source);
  guard(raw.contract===COMBO_UNIT_RECEIVER_CONTRACT && raw.version===1 && raw.status==="preview_only" &&
    raw.sendAllowed===false && raw.eventId===null && raw.orderId===null,"DRAFT_STATUS_INVALID");
  guard(JSON.stringify(raw)===JSON.stringify(expected),"DRAFT_STALE_OR_MODIFIED");
  return expected;
}

export type ReceiverCompatibilityResult = Readonly<{
  status:"blocked";
  reason:"ENTREGAS_V1_DROPS_UNIT_CHOICES"|"JOINT_HOMOLOGATION_REQUIRED";
  sendAllowed:false;
  requiresCapability:typeof REQUIRED_CONSUMER_CAPABILITY;
  testedAgainst:"dfl_entregas_v1_source_audit";
}>;

/**
 * Even a claim of a future capability cannot enable a payment or relay.
 * Capability has to be certified against deployed Entregas, signature,
 * persistence, presentation, idempotency and kitchen output in later releases.
 */
export function reviewComboUnitReceiverCompatibility(
  draft:ComboReceiverDraftV1,
  advertisedCapabilities?:unknown,
):ReceiverCompatibilityResult {
  guard(draft.contract===COMBO_UNIT_RECEIVER_CONTRACT && draft.sendAllowed===false &&
    draft.status==="preview_only" && draft.authorization.relay===false &&
    draft.eventId===null && draft.orderId===null,"RECEIVER_DRAFT_INVALID");
  const claims=safeRecord(advertisedCapabilities) && Array.isArray(advertisedCapabilities.supports)
    ? advertisedCapabilities.supports : [];
  const declared=claims.includes(REQUIRED_CONSUMER_CAPABILITY);
  return {status:"blocked",reason:declared?"JOINT_HOMOLOGATION_REQUIRED":"ENTREGAS_V1_DROPS_UNIT_CHOICES",
    sendAllowed:false,requiresCapability:REQUIRED_CONSUMER_CAPABILITY,testedAgainst:"dfl_entregas_v1_source_audit"};
}

/** Read-only human audit, never a cooking ticket or signed integration event. */
export function describeComboUnitReceiverBlock(draft:ComboReceiverDraftV1):readonly string[] {
  const report=reviewComboUnitReceiverCompatibility(draft);
  return [
    "R241 - SIMULACAO. NAO ENVIAR AO ENTREGAS / NAO PRODUZIR / NAO COBRAR.",
    `Contrato ${draft.contract} (v${draft.version})`,
    `Unidades distintas: ${draft.units.length}; com modificacoes: ${draft.safety.unitChoices}`,
    `Extras contabilizados (centavos): ${draft.accounting.extrasForOrderCents}`,
    `Status: ${report.status} - ${report.reason}`,
    "Entregas V1 agrega adicionais e observacoes por LINHA; cada lanche exige receptor versionado.",
  ];
}
