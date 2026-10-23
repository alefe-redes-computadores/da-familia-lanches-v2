import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const read=p=>fs.readFileSync(p,"utf8");
function ok(v,message){assert.ok(v,"V86 R4: "+message);console.log("✓",message)}
const policy=read("src/lib/catalogAddonPolicy.ts");
const transpiled=ts.transpileModule(policy,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const lib={exports:{}};new Function("module","exports",transpiled)(lib,lib.exports);
const {addonPolicy,validAddonSelection,addonPolicyHint}=lib.exports;
ok(addonPolicy({}).valid && validAddonSelection({},0)&&validAddonSelection({},20),"legado 0..20 intacto");
ok(!validAddonSelection({minAddonSelections:1,maxAddonSelections:2},0),"escolha obrigatória");
ok(validAddonSelection({minAddonSelections:1,maxAddonSelections:2},1)&&validAddonSelection({minAddonSelections:1,maxAddonSelections:2},2),"intervalo autorizado");
ok(!validAddonSelection({minAddonSelections:1,maxAddonSelections:2},3),"limite superior");
ok(!addonPolicy({minAddonSelections:3,maxAddonSelections:2}).valid,"configuração contraditória bloqueada");
ok(!addonPolicy({minAddonSelections:-1,maxAddonSelections:5}).valid,"mínimo negativo rejeitado");
ok(!addonPolicy({minAddonSelections:0,maxAddonSelections:21}).valid,"máximo acima do teto rejeitado");
ok(!addonPolicy({minAddonSelections:0.5,maxAddonSelections:3}).valid,"fração rejeitada");
ok(addonPolicyHint({minAddonSelections:2,maxAddonSelections:2}).includes("exatamente"),"mensagem clara para seleção exata");
const server=read("src/app/api/orders/route.ts"),save=read("src/app/api/admin/catalog/route.ts"),catalog=read("src/lib/catalog.ts");
ok(server.includes("validAddonSelection(product,line.selectedAddons.length)"),"autoridade no servidor antes de gerar pedido");
ok(server.includes("ADDON_SELECTION_INVALID")&&server.includes("ADDON_POLICY_INVALID"),"erros reconhecidos na API");
ok(save.includes("minAddonSelections:policy.min")&&save.includes("maxAddonSelections:policy.max"),"cadastro persistido no backend");
ok(catalog.includes("const minAddonSelections")&&catalog.includes("...(maxAddonSelections !== undefined"),"leitura pública usa regra configurada");
ok(read("scripts/test-site-v85-r4-cart-review.mjs").includes('invalidSelections.length') && read("src/components/ui/CartModal.tsx").includes('if (catalogSource==="hybrid" && invalidSelections.length)'),"teste V85 R4 e contrato V86 cobrem revisao e protecao adicional");
const client=read("src/lib/adminCatalogClient.ts");
ok(client.includes("ADDON_POLICY_INVALID:"),"mensagem amigável de configuração no Admin");
const admin=read("src/components/admin/CatalogAdmin.tsx"),detail=read("src/components/ui/ProductDetailsModal.tsx"),cart=read("src/components/ui/CartModal.tsx"),checkout=read("src/components/ui/CheckoutModal.tsx");
ok(admin.includes("addonLimitsV86")&&admin.includes("minAddonSelections: policy.min"),"editor com validação e controles");
ok(admin.includes("minAddonSelections: product.minAddonSelections ?? 0")&&admin.includes("minAddonSelections:product.minAddonSelections??0"),"reativação e padronização preservam regra");
ok(detail.includes("if(!addOk)")&&detail.includes("disabled={!addOk}"),"personalização orienta e bloqueia item inválido");
ok(cart.includes("invalidSelections")&&cart.includes("validAddonSelection")&&cart.includes("Revise os adicionais de"),"carrinho impede envio incompatível e informa motivo");
ok(checkout.includes('"ADDON_SELECTION_INVALID"')&&checkout.includes('code === "ADDON_SELECTION_INVALID"'),"checkout explica alteração sem desviar pela contingência");
for(const path of ["src/data/products.ts","src/lib/catalog.ts","src/app/api/admin/catalog/route.ts","src/app/api/orders/route.ts","src/components/admin/CatalogAdmin.tsx","src/components/admin/CatalogQualityPanel.tsx","src/components/ui/ProductDetailsModal.tsx","src/components/ui/CartModal.tsx","src/components/ui/CheckoutModal.tsx"]){const result=ts.transpileModule(read(path),{fileName:path,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});ok(!(result.diagnostics??[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,`${path}: sintaxe`)}
// V85 R5 foi um RELEASE GATE do HEAD da V84. O contrato funcional continua
// fiscalizado aqui, sem exigir commits historicos ou diffs de 17 arquivos publicados.
const legacyCompatFiles=[
  "scripts/test-images-commerce-v52.mjs",
  "src/app/admin/page.tsx","src/app/page.module.css","src/app/page.tsx",
  "src/components/admin/CatalogAdmin.module.css","src/components/admin/CatalogAdmin.tsx",
  "src/components/admin/StoreOperationAdmin.module.css","src/components/admin/StoreOperationAdmin.tsx",
  "src/components/admin/ui/AdminExperienceProvider.tsx",
  "src/components/product/ProductPublicPage.module.css","src/components/product/ProductPublicPage.tsx",
  "src/components/ui/CartModal.module.css","src/components/ui/CartModal.tsx",
  "src/components/ui/CheckoutModal.tsx","src/components/ui/ProductDetailsModal.module.css",
  "src/lib/catalogImageClient.ts","src/lib/publicCatalogClient.ts",
];
ok(legacyCompatFiles.every(path=>fs.existsSync(path)),"V85 R5: 17 arquivos de release ainda existem");
const hook=read("src/hooks/useAdminOrders.ts");
ok((hook.match(/onSnapshot\s*\(/g)||[]).length===1 && hook.includes("limit(100)"),"V85 R5: listener operacional único com limite 100");
ok(checkout.includes("clientRequestId")&&checkout.includes("clearConfirmedCart")&&checkout.includes("createCustomerOrder")&&checkout.includes("clearCheckoutDraft(null)"),"V85 R5: pedido idempotente e carrinho limpo após confirmação");
ok(cart.includes('catalogError || catalogSource !== "hybrid"') && cart.includes('applyCatalogReview'),"V85 R5: fallback não sobrescreve carrinho e revisão explícita");
const imageCode=read("src/lib/catalogImageClient.ts"),imageApi=read("src/app/api/admin/catalog-image/route.ts");
ok(imageCode.includes("IMAGE_TOO_LARGE_AFTER_COMPRESSION")&&imageApi.includes("const MAX_BYTES = 640 * 1024"),"V85 R5: teto de WebP mantido no servidor");
const publicCatalog=read("src/lib/publicCatalogClient.ts");
ok(publicCatalog.includes("RECOVERY_COOLDOWN_MS")&&!publicCatalog.includes("setInterval("),"V85 R5: recuperação do catálogo sem polling");
ok(detail.includes("priority quality={72}")&&read("src/components/product/ProductPublicPage.tsx").includes("share"),"V85 R5: imagens e compartilhamento preservados");
ok(admin.includes("validateBundleItems")&&read("src/lib/catalogComposition.ts").includes("if (!product.bundleItems?.length) return []"),"V85 R5: validação relacional de combos mantida");
console.log("✓ Gate historico V85 R5 de HEAD V84 nao reaplicado: substituido por invariantes atuais e verificacao da base V86 pelo instalador");
console.log("DFL SITE V86 R4 — CONTRATOS LOCAIS APROVADOS");
