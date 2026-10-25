'use strict';
const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm'),assert=require('node:assert/strict');
function load(f,modules={}){const text=fs.readFileSync(f,'utf8');const js=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m={exports:{}};vm.runInNewContext(js,{module:m,exports:m.exports,require:p=>{if(p in modules)return modules[p];throw Error('Import desconhecido '+p)},Set,Map,Date,Intl},{filename:f});return m.exports}
const s=load('src/lib/catalogSearch.ts');
const base={id:'1',name:'Bitela',description:'Filé de frango e queijo',category:'lanches',detailsItems:['Molho verde'],bundleItems:[]};
assert.equal(s.catalogSearchScore(base,'bitela'),1000,'busca exata');
assert(s.catalogSearchScore(base,'bitela frango')>0,'busca tokens nome + descricao');
assert(s.catalogSearchScore(base,'frango molho')>0,'busca tokens ingredientes + descricao');
assert.equal(s.catalogSearchScore(base,'frango suco'),0,'AND tokens evita falso positivo');
const drinks=load('src/lib/commercialRecommendations.ts',{'@/lib/catalogComposition':{resolveBundleItems:()=>[]}});
const combo={...base,id:'combo',name:'Combo 4 Uai sem refrigerante',description:'Quatro Uai sem refrigerante',category:'promocoes',detailsItems:[],includedExtras:'Sem refrigerante'};
const soda={...base,id:'soda',name:'Kuat 2L',category:'bebidas',description:'Refrigerante',detailsItems:[]};
assert.equal(drinks.isDrinkProduct(combo),false,'combo sem refri nao vira bebida');
assert.equal(drinks.isDrinkProduct(soda),true,'Kuat reconhecido como bebida');
const suggestions=drinks.getCommercialRecommendations(combo,[combo,soda],[]);
assert(suggestions.some(x=>x.product.id==='soda'&&x.kind==='drink'),'combo sem refri recebe bebida sugerida');
const withDrink={...combo,id:'combo-com',name:'Combo completo',description:'Acompanha 1 Kuat 2L',includedExtras:'1 Kuat 2L'};
assert(!drinks.getCommercialRecommendations(withDrink,[withDrink,soda],[]).some(x=>x.product.id==='soda'),'combo com bebida nao sugere bebida duplicada');
console.log('V90 R2: 8 cenarios de busca/recomendacao OK');
