'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const path='src/lib/catalogConversionSummary.ts';
const compiled=ts.transpileModule(read(path),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal((compiled.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0);
const mod={exports:{}};
new Function('module','exports',compiled.outputText)(mod,mod.exports);
const report=mod.exports.summarizeCatalogConversion;
const categories=[{id:'lanches',active:true},{id:'ocultos',active:false}];
const products=[
 {id:'a',name:'A',category:'lanches',disponivel:true,image:'https://example.com/a.png',description:'Descrição completa com ingredientes e modo de preparo',price:20,oldPrice:26,bundleItems:[]},
 {id:'b',name:'B',category:'lanches',disponivel:true,image:'',description:'Curta',price:10,bundleItems:[{productId:'a',quantity:2}]},
 {id:'c',name:'C',category:'ocultos',disponivel:true,image:'ok',description:'ok',price:10},
 {id:'d',name:'D',category:'lanches',disponivel:false,image:'',description:'',price:0}
];
let x=report(products,categories);
assert.equal(x.visible,2);assert.equal(x.hidden,1);assert.equal(x.withImage,1);assert.equal(x.withDescription,1);
assert.equal(x.activeOffers,1);assert.equal(x.completeBundles,1);assert.equal(x.bundleCount,1);assert(x.suggestions.length>=2);
x=report([products[0],{...products[1],bundleItems:[{productId:'d',quantity:1}]}],categories);
assert.equal(x.completeBundles,0);
x=report([],categories);assert.equal(x.visible,0);assert.equal(x.suggestions.length,0);
const admin=read('src/components/admin/CatalogAdmin.tsx');
const pulse=read('src/components/admin/CatalogConversionPulse.tsx');
const checkout=read('src/components/ui/CheckoutModal.tsx');
const store=read('src/components/admin/StoreOperationAdmin.tsx');
const health=read('src/components/admin/OperationHealthAdmin.tsx');
assert(admin.includes('<CatalogConversionPulse products={products} categories={categories} source={source} />'));
assert(pulse.includes('useMemo')&&pulse.includes('summarizeCatalogConversion')&&!pulse.includes('fetch('));
assert(store.includes('styles.r35DirtyNotice')&&store.includes('setS(liveSettings)')&&store.includes('editingSchedule.current=false'));
assert(health.includes('styles.r35SnapshotAge')&&health.includes('data-stale={Boolean(remoteError)}'));
assert(checkout.includes('const focusNextCheckoutField = () => {')&&checkout.includes('className={styles.r35ReadinessAction}'));
for(const value of ['"cart"','"schedule"','"district"','"street"','"number"','"cep"','"name"','"phone"']) assert(checkout.includes(value),value);
assert(checkout.includes('const finishOrder = async () => {'));
assert(checkout.includes('canOfferManualOrderFallback(code)')&&checkout.includes('orderOutcomeUncertain'));
assert(checkout.includes('createCustomerOrder')&&checkout.includes('orderAttemptRef'));
for(const p of [path,'src/components/admin/CatalogConversionPulse.tsx','src/components/admin/CatalogAdmin.tsx','src/components/admin/StoreOperationAdmin.tsx','src/components/admin/OperationHealthAdmin.tsx','src/components/ui/CheckoutModal.tsx']){
 const src=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(src.parseDiagnostics.length,0,p+': syntax');
}
console.log('R35: 30+ contratos — panorama comercial, rascunho do Admin, checkout assistido, observabilidade OK');
