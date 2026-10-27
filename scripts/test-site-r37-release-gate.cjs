"use strict";
/** DFL SITE R37: verifica integridade estrutural e preserva autoridade do servidor. */
const fs=require("node:fs");
const assert=require("node:assert/strict");
const ts=require("typescript");
const read=p=>fs.readFileSync(p,"utf8");
let ok=0;
function test(condition,label){assert.ok(condition,label);console.log("✓",label);ok++}
const tests=[
  "scripts/test-site-r32-guest-cart-recovery.cjs",
  "scripts/test-site-r33-commerce-discovery.cjs",
  "scripts/test-site-r34-checkout-care.cjs",
  "scripts/test-site-r35-conversion-care.cjs",
  "scripts/test-site-r36-commerce-release-audit.cjs",
];
for(const file of tests)test(fs.existsSync(file),`suíte local: ${file}`);
const checkout=read("src/components/ui/CheckoutModal.tsx");
const orders=read("src/components/ui/OrdersModal.tsx");
const home=read("src/app/page.tsx");
const cart=read("src/components/ui/CartModal.tsx");
const health=read("src/components/admin/OperationHealthAdmin.tsx");
const pulse=read("src/components/admin/CatalogConversionPulse.tsx");
const store=read("src/components/admin/StoreOperationAdmin.tsx");
const admin=read("src/components/admin/CatalogAdmin.tsx");
const checkoutSafety=read("src/lib/checkoutReviewSafety.ts");
const cartRestore=read("src/lib/cartRestoreSafety.ts");
const commerce=read("src/lib/catalogConversionSummary.ts");
test(checkout.includes("DFL-R36-REVIEW-PREFLIGHT") && checkout.includes("orderAttemptRef"),"checkout R36 e idempotência de tentativa preservados");
test(checkout.includes("!orderOutcomeUncertain && fallbackWhatsAppUrl") && checkout.includes("canOfferManualOrderFallback(code)"),"pedido de resultado incerto não oferece envio paralelo");
test(checkout.includes("getDeliveryTableCached") && checkout.includes("matchDeliveryRate"),"frete continua vindo da tabela configurada");
test(orders.includes("DFL-R36-REPEAT-MODIFIERS") && orders.includes("inspectProductSelections(p,resolvedAddons.map(addon=>addon.id))"),"repetição exige adicionais válidos");
test(cart.includes("reconciliation.originalSignature") && cart.includes("remainingUpsellUnits"),"carrinho conserva reconciliação e ofertas vinculadas");
test(home.includes("DFL-R33-CATALOG-SEARCH-RECOVERY") && home.includes("rankCatalogProducts"),"busca inteligente R33 ativa");
test(health.includes("DFL-R36-ADMIN-STAGES") && health.includes("DFL-R35-HEALTH-RECENCY"),"admin tem etapas e data de diagnóstico");
test(pulse.includes("DFL-R36-CATALOG-COPY") && pulse.includes("navigator.clipboard.writeText"),"painel comercial gera diagnóstico de cópia");
test(admin.includes("CatalogConversionPulse") && store.includes("DFL-R35-OPERATION-DRAFT"),"admin comercial e aviso de horário mantidos");
test(!/\b(?:fetch|addDoc|setDoc|onSnapshot)\s*\(/.test(commerce),"resumo comercial não consulta nem escreve no banco");
test(!/\b(?:fetch|addDoc|setDoc|onSnapshot)\s*\(/.test(checkoutSafety),"revisão informativa não registra pedidos");
test(!/\b(?:fetch|addDoc|setDoc|onSnapshot)\s*\(/.test(cartRestore),"restauração local sem escrita remota");
const files=[
"src/components/ui/CheckoutModal.tsx",
"src/components/ui/OrdersModal.tsx",
"src/components/ui/CartModal.tsx",
"src/app/page.tsx",
"src/components/admin/OperationHealthAdmin.tsx",
"src/components/admin/StoreOperationAdmin.tsx",
"src/components/admin/CatalogAdmin.tsx",
"src/components/admin/CatalogConversionPulse.tsx",
"src/lib/cartRestoreSafety.ts",
"src/lib/catalogConversionSummary.ts",
"src/lib/catalogSearchRecovery.ts",
"src/lib/checkoutReadiness.ts",
"src/lib/checkoutReviewSafety.ts",
];
for(const file of files){const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,file.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);test(source.parseDiagnostics.length===0,`parse ${file}`)}
console.log(`R37 — ${ok} contratos de fechamento aprovados.`);
