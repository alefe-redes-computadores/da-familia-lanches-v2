'use strict';
const fs=require('node:fs'), assert=require('node:assert/strict'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const root='src/lib/catalogSearchRecovery.ts';
const source=read(root);
const build=(code,name)=>{
  const out=ts.transpileModule(code,{fileName:name,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
  assert.equal((out.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,name);
  const module={exports:{}};
  new Function('module','exports',out.outputText)(module,module.exports);
  return module.exports;
};
const {suggestCatalogQueries}=build(source,root);
const catalog=[
 {id:'1',name:'X Bacon',category:'lanches',price:19,image:'',disponivel:true},
 {id:'2',name:'Frango Especial',category:'lanches',price:27,image:'',disponivel:true},
 {id:'3',name:'X Calabresa',category:'lanches',price:24,image:'',disponivel:false},
 {id:'4',name:'Combo do Dia',category:'promocoes',price:49,image:'',disponivel:true},
 {id:'5',name:'Cachorro Quente',category:'lanches',price:-1,image:'',disponivel:true},
];
assert(suggestCatalogQueries(catalog,'baconn').includes('X Bacon'));
assert(suggestCatalogQueries(catalog,'frangoo').includes('Frango Especial'));
assert.deepEqual(suggestCatalogQueries(catalog,'calabresaa'),[]);
assert.deepEqual(suggestCatalogQueries(catalog,'abcdefgxyz'),[]);
assert.deepEqual(suggestCatalogQueries(catalog,'a'),[]);
assert(suggestCatalogQueries(catalog,'combbo',1).length<=1);
assert(!suggestCatalogQueries(catalog,'quentte').includes('Cachorro Quente'));
assert(!/\b(?:fetch|localStorage|sessionStorage|getDoc|addDoc|setDoc)\s*\(/.test(source));
const recomm=build(read('src/lib/dflAssistRecommendations.ts'),'recommendation');
const options=[{id:'a',name:'Combo Frango',price:45,disponivel:true,category:'promocoes',description:'filé de frango',bundleItems:[{productId:'x',quantity:2}]}, {id:'b',name:'Combo Frango Premium',price:60,disponivel:true,category:'promocoes',description:'frango'}];
const eligible=recomm.recommendDFLProducts(options,{query:'combo com frango até R$ 50 para 2 pessoas',budget:20,people:1});
assert.deepEqual(eligible.map(x=>x.product.id),['a'],'limite na frase deve vencer filtro desatualizado');
const limited=recomm.recommendDFLProducts(options,{query:'frango',budget:20});
assert.equal(limited.length,0,'filtro continua valendo quando a frase nao informa valor');
const files=[
 'src/app/page.tsx','src/components/layout/DFLAssistOffers.tsx','src/components/ui/OrdersModal.tsx',
 'src/lib/catalogSearchRecovery.ts','src/lib/dflAssistRecommendations.ts'
];
for (const p of files){const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);assert.equal(ast.parseDiagnostics.length,0,p);}
const home=read('src/app/page.tsx'),offers=read('src/components/layout/DFLAssistOffers.tsx'),orders=read('src/components/ui/OrdersModal.tsx');
assert(home.includes('catalogRecovery.map(name')&&home.includes('styles.emptyRecovery'),'fallback R32 preservado');
assert(offers.includes('setOnlyCombos] = useState(false)')&&offers.includes('Limpar filtros'));
assert(offers.includes('source === "hybrid"')&&offers.includes('discoveryHints.map(name'));
assert(orders.includes('repeatIndex.byId.get(item.id)')&&orders.includes('if(!byName.has(key))'));
assert(orders.includes('clearCart();resolved.forEach'),'repeticao de pedido preservada');
assert(read('src/app/page.module.css').includes('DFL-R33-CATALOG-SEARCH-RECOVERY'));
assert(read('src/components/layout/DFLAssist.module.css').includes('DFL-R33-ASSIST-RECOVERY'));
assert(read('src/components/ui/OrdersModal.module.css').includes('DFL-R33-ORDER-UX'));
console.log('DFL SITE R33: busca fuzzy real, filtro comercial, assistente, pedidos e JSX aprovados');
