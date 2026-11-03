/**
 * DFL SITE R240 — contrato de EXIBICAO, exclusivamente para homologar cozinha,
 * pre-visualizacao termica e futura projecao para DFL Entregas.
 * NAO e um pedido, pagamento, evento de integracao ou autorizacao de impressao.
 * NUNCA incluir este objeto em Pedidos, outbox, impressora ou checkout v1.
 * O servidor continuara validando o catalogo e precos quando houver release futuro.
 */
import { type ComboBlueprint } from "./comboUnitPlan";
import { type ComboUnitCommercialDraft } from "./comboUnitCommercial";
import {
  revalidateComboUnitCartDraft,
  previewComboUnitCheckoutHandoff,
} from "./comboUnitCartDraft";

export const COMBO_UNIT_OPERATIONAL_ENABLED = false as const;
export const COMBO_UNIT_OPERATIONAL_SCHEMA = 1 as const;

const MAX_ROWS = 1800; // 60 componentes por combo x 30 combos (limites R237)
const MAX_LINES = 5500;
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
function requireSafe(value: unknown, code: string): asserts value {
  if (!value) throw new Error(`COMBO_OPERATIONAL_${code}`);
}
const plain = (value: string) => value.normalize("NFC")
  .replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, " ")
  .replace(/\s+/g, " ").trim();
const money = (cents: number) => `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const own = (obj: Readonly<Record<string, string>>, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key);

/** IDs e nomes devem ser resolvidos de um catalogo autorizado; sem correspondencia,
 * a previa exibe o ID e avisa que o nome nao foi resolvido. */
export type ComboOperationalLabels = Readonly<{
  products: Readonly<Record<string, string>>;
  addons: Readonly<Record<string, string>>;
  ingredients: Readonly<Record<string, string>>;
}>;
export type ComboOperationalAddon = Readonly<{ id: string; label: string; priceCents: number }>;
export type ComboOperationalRemoval = Readonly<{ id: string; label: string }>;
export type ComboOperationalUnit = Readonly<{
  key: string; // c1:1:3 = combo numero 1, primeiro grupo, unidade 3
  comboNumber: number;
  componentKey: string;
  productId: string;
  productLabel: string;
  unitNumber: number;
  groupQuantity: number;
  addons: readonly ComboOperationalAddon[];
  removals: readonly ComboOperationalRemoval[];
  note: string;
  extrasCents: number;
}>;
export type ComboUnitOperationalPreview = Readonly<{
  schema: 1;
  state: "preview_only";
  authorization: Readonly<{ checkout: false; print: false; relay: false; production: false }>;
  productId: string;
  blueprintFingerprint: string;
  draftId: string;
  previewId: string; // identidade diagnostica, nunca prova de autorizacao
  comboQuantity: number;
  resolvedLabels: boolean;
  missingLabels: readonly string[];
  totals: Readonly<{
    basePerComboCents: number;
    extrasPerComboCents: number;
    extrasForOrderCents: number;
    previewTotalCents: number;
    chargeAuthorized: false;
  }>;
  units: readonly ComboOperationalUnit[];
  kitchenLines: readonly string[];
  thermalPreviewLines: readonly string[];
  deliveriesPreview: Readonly<{
    schema: "dfl_combo_unit_delivery_preview_v1";
    sendAllowed: false;
    orderId: null;
    eventId: null;
    lines: readonly ComboOperationalUnit[];
  }>;
}>;

/** Normaliza labels para PREVIA, nao como autoridade de cadastro. */
function getLabel(ids: Set<string>, dictionary: Readonly<Record<string, string>>, id: string): string {
  requireSafe(ID.test(id), "LABEL_ID_INVALID");
  if (!own(dictionary, id)) { ids.add(id); return id; }
  const value=dictionary[id];
  requireSafe(typeof value === "string" && value.length > 0 && value.length <= 100, "LABEL_INVALID");
  const clean=plain(value);
  requireSafe(clean.length >= 1 && clean.length <= 100, "LABEL_INVALID");
  return clean;
}

/**
 * Revalidacao de TODAS as escolhas e dos precos de simulacao.
 * O caller deve fornecer a composicao e politica em draft conferidas no teste;
 * nenhum valor salvo no carrinho se torna automaticamente um valor autorizado.
 * Falha fechada se faltar politica, houver componente antigo, preco desconhecido etc.
 */
export function previewComboUnitOperationalHandoff(
  blueprint: ComboBlueprint,
  rawCartDraft: unknown,
  commercialPolicy?: ComboUnitCommercialDraft,
  labels?: ComboOperationalLabels,
): ComboUnitOperationalPreview {
  requireSafe(Boolean(commercialPolicy), "COMMERCIAL_POLICY_REQUIRED");
  requireSafe(Boolean(labels), "LABEL_CATALOG_REQUIRED");
  const draft=revalidateComboUnitCartDraft(rawCartDraft,blueprint,commercialPolicy);
  const gate=previewComboUnitCheckoutHandoff(draft);
  requireSafe(gate.state==="blocked_for_checkout" && gate.payable===false,"CHECKOUT_GATE_INVALID");
  const quote=draft.quote;
  requireSafe(quote.state === "draft_preview_only" && quote.isPayable===false,"PRICE_PREVIEW_BLOCKED");
  requireSafe(quote.productId===blueprint.productId && quote.blueprintFingerprint===blueprint.fingerprint,"QUOTE_IDENTITY_INVALID");
  requireSafe(quote.quantity===draft.comboQuantity && quote.units.length===blueprint.units.length,"QUOTE_UNITS_INVALID");
  requireSafe(blueprint.units.length*draft.comboQuantity<=MAX_ROWS,"ROW_LIMIT");
  const missing=new Set<string>();
  const allUnits: ComboOperationalUnit[]=[];
  let extrasSum=0;
  for(let comboNumber=1;comboNumber<=draft.comboQuantity;comboNumber++) {
    for(let index=0;index<blueprint.units.length;index++) {
      const src=blueprint.units[index], unit=quote.units[index];
      requireSafe(src.key===unit.unitKey && src.productId===unit.productId &&
        src.unitNumber===unit.unitNumber && src.groupQuantity===unit.groupQuantity,"UNIT_IDENTITY_MISMATCH");
      const addons=unit.addons.map(addon=>({id:addon.id,label:getLabel(missing,labels!.addons,addon.id),priceCents:addon.priceCents}));
      const removals=unit.removals.map(id=>({id,label:getLabel(missing,labels!.ingredients,id)}));
      const expectedExtras=addons.reduce((total,addon)=>total+addon.priceCents,0);
      requireSafe(expectedExtras===unit.extrasCents,"UNIT_EXTRA_MISMATCH");
      extrasSum+=expectedExtras;
      allUnits.push({
        key:`c${comboNumber}:${src.key}`,comboNumber,componentKey:src.key,
        productId:src.productId,productLabel:getLabel(missing,labels!.products,src.productId),
        unitNumber:src.unitNumber,groupQuantity:src.groupQuantity,
        addons,removals,note:plain(unit.note),extrasCents:expectedExtras,
      });
    }
  }
  requireSafe(extrasSum===quote.extrasForOrderCents &&
    extrasSum===quote.extrasPerComboCents*draft.comboQuantity &&
    quote.totalCents===(quote.baseComboPriceCents*draft.comboQuantity)+extrasSum,"TOTAL_RECONCILIATION_FAILED");
  const kitchenLines:string[]=[
    "R240 — PREVIA DE COZINHA — NAO PRODUZIR / NAO ENVIAR",
    `${draft.comboQuantity} combo(s) ${blueprint.productId}; ${allUnits.length} unidade(s)`,
  ];
  for(const unit of allUnits){
    kitchenLines.push(`COMBO ${unit.comboNumber}/${draft.comboQuantity} · ${unit.productLabel} ${unit.unitNumber}/${unit.groupQuantity} [${unit.key}]`);
    for(const addon of unit.addons) kitchenLines.push(`  + ${addon.label}`);
    for(const removal of unit.removals) kitchenLines.push(`  SEM ${removal.label}`);
    if(unit.note) kitchenLines.push(`  OBS: ${unit.note}`);
    if(!unit.addons.length && !unit.removals.length && !unit.note) kitchenLines.push("  PADRAO");
  }
  if(missing.size) kitchenLines.push(`ATENCAO: ${missing.size} nome(s) nao resolvido(s); IDs exibidos na previa`);
  requireSafe(kitchenLines.length<=MAX_LINES,"LINE_LIMIT");
  const thermalPreviewLines=[
    "SIMULACAO — NAO IMPRIMIR / NAO COBRAR",
    ...kitchenLines,
    `Base por combo: ${money(quote.baseComboPriceCents)}`,
    `Extras por combo: ${money(quote.extrasPerComboCents)}`,
    `Total apenas para simulacao: ${money(quote.totalCents)}`,
  ];
  const previewId=`${draft.draftId}|q${draft.comboQuantity}|${blueprint.fingerprint}`;
  return {
    schema:1,state:"preview_only",authorization:{checkout:false,print:false,relay:false,production:false},
    productId:blueprint.productId,blueprintFingerprint:blueprint.fingerprint,
    draftId:draft.draftId,previewId,comboQuantity:draft.comboQuantity,
    resolvedLabels:missing.size===0,missingLabels:[...missing].sort(),
    totals:{basePerComboCents:quote.baseComboPriceCents,
      extrasPerComboCents:quote.extrasPerComboCents,
      extrasForOrderCents:quote.extrasForOrderCents,
      previewTotalCents:quote.totalCents,chargeAuthorized:false},
    units:allUnits,kitchenLines,thermalPreviewLines,
    deliveriesPreview:{schema:"dfl_combo_unit_delivery_preview_v1",sendAllowed:false,
      orderId:null,eventId:null,lines:allUnits},
  };
}

/** Prévia HTML INERTE para testes de legibilidade em 58/80 mm.
 * Nenhum botão imprimir, evento ou janela de impressora. Escape rigoroso da entrada. */
const escapeHtml=(value:string)=>value.replaceAll("&","&amp;").replaceAll("<","&lt;")
  .replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");
export function previewComboUnitThermalHtml(packet:ComboUnitOperationalPreview):string {
  requireSafe(packet.schema===1 && packet.state==="preview_only" && packet.authorization.print===false &&
    packet.authorization.checkout===false && packet.authorization.relay===false &&
    packet.deliveriesPreview.sendAllowed===false,"PRINT_GATE_INVALID");
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>Previa R240 - nao imprimir</title>'+
    '<style>body{font:12px/1.4 system-ui;color:#111;background:#fff;margin:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.4 monospace}</style></head>'+
    '<body><h1>SIMULACAO - NAO IMPRIMIR</h1><pre>'+escapeHtml(packet.thermalPreviewLines.join("\n"))+'</pre></body></html>';
}
