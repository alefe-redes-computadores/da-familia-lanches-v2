"use strict";
/** R38: busca de bairros apenas consultiva; nunca substitui a regra de frete. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");
const path = require("node:path");
let count = 0;
function check(condition, label) { assert.ok(condition, label); console.log("✓", label); count++; }
const root = process.cwd();
function source(file) { return fs.readFileSync(path.join(root, file), "utf8"); }
const tsCache = new Map();
function loadTS(rel) {
  if (tsCache.has(rel)) return tsCache.get(rel);
  const compiled = ts.transpileModule(source(rel), {
    fileName: rel,
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    reportDiagnostics: true,
  });
  check(!compiled.diagnostics?.some(item => item.category === ts.DiagnosticCategory.Error), `transpilação ${rel}`);
  const mod = { exports: {} };
  tsCache.set(rel, mod.exports);
  const localRequire = request => {
    if (request === "@/lib/addressIntelligence") return loadTS("src/lib/addressIntelligence.ts");
    throw new Error(`R38: import inesperado: ${request}`);
  };
  new Function("module", "exports", "require", compiled.outputText)(mod, mod.exports, localRequire);
  return mod.exports;
}
const { searchDistrictCatalog } = loadTS("src/lib/districtCatalog.ts");
const { buildDistrictSupportMessage } = loadTS("src/lib/addressSupportMessage.ts");
const configured = ["Centro", "São José Operário", "Centro", "Jardim América", " "];
const initial = searchDistrictCatalog("", configured, 8);
check(initial.source === "configured" && initial.total === 3 && initial.results.length === 3, "lista prioriza e deduplica bairros cadastrados");
check(initial.results.includes("Centro") && initial.results.includes("São José Operário"), "lista oferece bairros cadastrados sem buscá-los de novo");
const direct = searchDistrictCatalog("jardim", configured, 8);
check(direct.results.length === 1 && direct.results[0] === "Jardim América", "busca pelo nome parcial filtra localmente");
const typo = searchDistrictCatalog("Sao Jsoe Operario", configured, 8);
check(typo.results.includes("São José Operário") && typo.results.every(x => configured.includes(x)), "erro de digitação não cria bairros fora da tabela");
const unknown = searchDistrictCatalog("Patio Inexistente XYYZZ", configured, 8);
check(unknown.results.length === 0, "bairro inexistente não vira bairro cadastrado");
const reference = searchDistrictCatalog("centro", [], 8);
check(reference.source === "reference" && reference.results.includes("Centro"), "lista local de referência quando tabela está indisponível");
check(searchDistrictCatalog("", configured, 0).results.length === 1, "paginação tem limite mínimo");
check(searchDistrictCatalog("", Array.from({ length: 90 }, (_, i) => `Bairro ${i}`), 500).results.length === 80, "paginação tem limite máximo sem renderizar lista ilimitada");
const help = buildDistrictSupportMessage("  São José <Operário>\n ");
check(help.includes("São José Operário") && !help.includes("<") && !help.includes("\n\n"), "pedido de ajuda remove controles e caracteres de marcação");
check(!/\b(?:R\$|total do pedido|carrinho|pedido registrado)\b/i.test(help) && help.includes("Não fiz nem confirmei um pedido"), "ajuda não cria nem sugere registro de pedido");
const checkout = source("src/components/ui/CheckoutModal.tsx");
const picker = source("src/components/ui/DistrictQuickPicker.tsx");
const style = source("src/components/ui/DistrictQuickPicker.module.css");
check(checkout.includes("DFL-R38-REACTIVE-DISTRICTS") && checkout.includes("DFL-R38-ADDRESS-CATALOG"), "checkout integra catálogo local e atualização reativa");
check(checkout.includes("getDeliveryTableCached().then(({ list })") && checkout.includes("const openDistrictCatalog = () =>") && checkout.includes("onOpen={openDistrictCatalog}"), "tabela reutiliza cache sob demanda, sem consulta antecipada");
check(checkout.includes("matchDeliveryRate") && checkout.includes("getDefaultDeliveryFee") && checkout.includes("DEFAULT_DELIVERY_FEE"), "autoridade da taxa original preservada");
check(checkout.includes("orderOutcomeUncertain") && checkout.includes("canOfferManualOrderFallback(code)"), "recuperação de pedidos incertos preservada");
check(checkout.includes("buildDistrictSupportMessage(bairro)") && checkout.includes("Não encontrou seu bairro? Pedir ajuda"), "suporte contextual no WhatsApp sem envio automático");
check(picker.includes("aria-expanded={expanded}") && picker.includes("setExpanded(false)") && picker.includes("Mostrar mais bairros"), "seletor acessível, recolhível e paginado");
check(picker.includes("lista cadastrada") && picker.includes("a loja confirmará a entrega e a taxa"), "referência local não promete cobertura nem tarifa");
check(style.includes("min-height:44px") && style.includes("focus-visible") && style.includes("max-height:244px"), "controles mobile com alvo tátil e foco visível");
for(const file of ["src/lib/districtCatalog.ts", "src/lib/addressSupportMessage.ts", "src/components/ui/DistrictQuickPicker.tsx"]){
  check(!/\b(?:fetch|addDoc|setDoc|onSnapshot)\s*\(/.test(source(file)), `${file} não efetua leituras ou escritas remotas`);
}
for (const file of ["src/components/ui/CheckoutModal.tsx", "src/components/ui/DistrictQuickPicker.tsx", "src/lib/districtCatalog.ts", "src/lib/addressSupportMessage.ts"]) {
  const kind = file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const syntax = ts.createSourceFile(file, source(file), ts.ScriptTarget.Latest, true, kind);
  check(syntax.parseDiagnostics.length === 0, `sintaxe ${file}`);
}
console.log(`R38 — ${count} contratos aprovados.`);
