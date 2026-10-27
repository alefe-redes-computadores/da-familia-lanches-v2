'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const engine=read('src/lib/dflAssistRecommendations.ts');
const offers=read('src/components/layout/DFLAssistOffers.tsx');
const assist=read('src/components/layout/DFLAssist.tsx');
const checkout=read('src/components/ui/CheckoutModal.tsx');
const css=read('src/components/layout/DFLAssist.module.css');
const compiled=ts.transpileModule(engine,{fileName:'engine.ts',compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const moduleObj={exports:{}};
new Function('module','exports',compiled)(moduleObj,moduleObj.exports);
const {extractDFLIntent,recommendDFLProducts}=moduleObj.exports;
const info=extractDFLIntent('Quero combo com frango até R$ 50 para 4 pessoas');
assert.equal(info.people,4);
assert.equal(info.budget,50);
assert.equal(info.comboOnly,true);
assert(info.terms.includes('frango'));
assert.equal(extractDFLIntent('algo sem cebola').hasExclusion,true);
assert(extractDFLIntent('franguinho').terms.includes('frango'));
const products=[
  {id:'a',name:'Combo Frango',description:'Filé de frango',category:'promocoes',price:45,disponivel:true,image:'',bundleItems:[{productId:'uai',quantity:4}]},
  {id:'b',name:'Frango Especial',description:'Filé de frango',category:'lanches',price:25,disponivel:true,image:''},
  {id:'c',name:'Combo Inativo',description:'Frango',category:'promocoes',price:10,disponivel:false,image:''},
];
assert.deepEqual(recommendDFLProducts(products,{query:'Quero combo com frango até R$ 50 para 4 pessoas'}).map(x=>x.product.id),['a']);
assert.deepEqual(recommendDFLProducts(products,{query:'franguinho'}).map(x=>x.product.id).sort(),['a','b']);
assert.equal(recommendDFLProducts(products,{query:'ate R$ 20'}).length,0);
assert(!/fetch\(|addDoc\(|setDoc\(|createCustomerOrder/.test(engine));
assert(offers.includes('useCatalog()'));
assert(offers.includes('source === "hybrid"'));
assert(offers.includes('setOnlyCombos] = useState(false)'));
assert(offers.includes('onFindProduct(query)'));
assert(offers.includes('intent.hasExclusion'));
assert(offers.includes('id="dfl-assist-ingredients"'));
assert(!assist.includes('className={styles.search}'));
assert(assist.includes('<DFLAssistOffers onFindProduct={search} />'));
assert(css.includes('DFL R27 ASSIST MOBILE PREMIUM'));
assert(css.includes('@media(max-width:340px)'));
assert(checkout.includes('const districtSuggestions = districtInspection.suggestions'));
assert(checkout.includes('districtKnownToTable'));
assert(checkout.includes('setDeliveryStatus("")'));
assert(checkout.includes('orderAttemptRef')&&checkout.includes('createCustomerOrder'));
for(const p of ['src/lib/dflAssistRecommendations.ts','src/components/layout/DFLAssist.tsx','src/components/layout/DFLAssistOffers.tsx','src/components/ui/CheckoutModal.tsx']){
  const syntax=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  assert.equal(syntax.parseDiagnostics.length,0,p+' contém erro de sintaxe');
}
console.log('R27: 24+ contratos de intenção, mobile, catálogo, endereço e segurança OK');
