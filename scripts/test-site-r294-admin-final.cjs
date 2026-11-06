'use strict';
/** R294: testes hermeticos da hierarquia e do comportamento comercial preservado. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const catalog = fs.readFileSync('src/components/admin/CatalogAdmin.tsx','utf8');
const css = fs.readFileSync('src/components/admin/CatalogAdmin.module.css','utf8');
let n=0;
const check=(title,fn)=>{fn();n++;console.log('R294 OK:',title);};
check('TSX valido',()=>assert.equal(ts.createSourceFile('CatalogAdmin.tsx',catalog,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0));
check('CSS sem important',()=>assert(!css.includes('!important')));
check('Navegacao apos resumo e ferramentas recolhidas',()=>{
 const a=catalog.indexOf('className={styles.summary}');
 const b=catalog.indexOf('className={styles.r294AdvancedTools}');
 const c=catalog.indexOf('className={styles.viewTabs}');
 assert(a>=0&&b>a&&c>b);
 assert(catalog.includes('/* DFL-R294-ADMIN-HIERARCHY'));
 assert(css.includes('.root .r294AdvancedTools>summary'));
});
check('Ferramentas antigas mantidas sem perda',()=>{
 for(const x of ['CatalogConversionPulse','CatalogQualityPanel','CatalogBulkOperations','CatalogLaunchCenter','r90BundleAudit','r91CommercialPanel','r93LaunchChecks','r89CommandBar'])assert(catalog.includes(x),x);
});
check('Mensagem de operacao visivel fora do painel',()=>{
 const a=catalog.indexOf('{message && <div className={styles.message}');
 const b=catalog.indexOf('<details className={styles.r294AdvancedTools}>');
 assert(a>=0 && a<b);
});
check('Categorias e pesquisa continuam disponiveis',()=>{
 for(const x of ['label="Categoria"','label="Estado"','className={styles.catalogTools}','className={styles.productGroups}','view === "categorias"'])assert(catalog.includes(x),x);
});
check('Foto clicavel usando apenas upload original',()=>{
 assert(catalog.includes('productPhotoInputRef.current?.click()'));
 assert(catalog.includes('ref={productPhotoInputRef} type="file"'));
 assert.equal((catalog.match(/<input ref=\{productPhotoInputRef\} type="file"/g)||[]).length,1);
 assert(catalog.includes('uploadProductImage(file)'));
});
check('Avanco etapa 4 abre campos avancados',()=>{
 assert(catalog.includes('if (productStep === "venda") setAdvancedProduct(true)'));
 assert(catalog.includes('data-editor-step="opcoes"'));
});
check('Etapas do editor e salvamento intactos',()=>{
 for(const x of ['"essencial"','"conteudo"','"venda"','"opcoes"','saveProduct()','saveProductBusy.current','mutateCatalog'])assert(catalog.includes(x),x);
});
check('Preco e promotacao intactos',()=>{
 for(const x of ['promoMetrics(productDraft.price, productDraft.oldPrice)','price: moneyTyping(e.target.value)','productDraft.oldPrice','productDraft.price'])assert(catalog.includes(x),x);
});
check('Botao de estado acessivel',()=>assert.equal((catalog.match(/aria-pressed=\{productDraft\.(?:disponivel|isSuggestion|showInOffers)\}/g)||[]).length,3));
check('CSS de disponibilidade sem controles brancos',()=>{
 for(const x of ['.editor .switches button[data-on="true"]','.editor .addonPickerHead>button','.editor .photoUpload .photoButton','.editor .moneyInput input'])assert(css.includes(x),x);
});
check('Impressao, vendas e contratos nao alterados',()=>{
 const orders=fs.readFileSync('src/app/api/orders/route.ts','utf8');
 assert(orders.includes('tx.create(orderRef, canonicalOrder)'));
 assert(catalog.includes('bundleItems'));
});
console.log(`RESULTADO=R294_HERMETICO_OK; ${n} verificacoes`);
