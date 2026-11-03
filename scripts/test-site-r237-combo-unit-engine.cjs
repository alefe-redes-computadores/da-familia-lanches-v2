'use strict';
/** DFL SITE R237: real pure v2 engine; no network, order writes, Firebase or live checkout. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
let checks = 0;
function ok(value, label) { assert.ok(value, label); checks += 1; }
function eq(actual, expected, label) { assert.deepEqual(actual, expected, label); checks += 1; }
function throws(fn, pattern, label) { assert.throws(fn, pattern, label); checks += 1; }
function read(path) { return fs.readFileSync(path, 'utf8'); }
function load(file) {
  const code = read(file);
  const ast = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  ok(ast.parseDiagnostics.length === 0, `${file}: sintaxe TypeScript`);
  const compiled = ts.transpileModule(code, {fileName:file, reportDiagnostics:true,
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
  ok(!compiled.diagnostics?.some(item=>item.category===ts.DiagnosticCategory.Error), `${file}: transpilação sem erro`);
  const mod = {exports:{}};
  new Function('module','exports','require',compiled.outputText)(mod,mod.exports,()=>{throw Error('R237: modulo externo nao autorizado');});
  return mod.exports;
}
const engine = load('src/lib/comboUnitPlan.ts');
const catalog = load('src/data/products.ts');
const combo = catalog.products.find(product=>product.id==='combo-7-uai');
const family = catalog.products.find(product=>product.id==='combo-familia-uai');
ok(combo&&family,'combos reais 7 Uai e familia no catalogo');
eq(combo.bundleItems, [{productId:'uai',quantity:7}], 'Combo 7 Uai: composição operacional cadastrada');
eq(combo.price,69.99,'Combo 7 Uai: preço original da vitrine (não alterar)');
eq(engine.COMBO_UNIT_CUSTOMIZATION_ENABLED,false,'ativação de personalizacao v2 continua desligada');
eq(engine.COMBO_UNIT_PLAN_VERSION,2,'contrato v2 separado do pedido v1');
const blueprint=engine.buildComboBlueprint(combo.id,combo.bundleItems);
const other=engine.buildComboBlueprint(family.id,family.bundleItems);
eq(blueprint.units.length,7,'sete unidades independentes');
eq(blueprint.units.map(u=>u.unitNumber),[1,2,3,4,5,6,7],'ordinais mantidos');
eq(blueprint.units.map(u=>u.key),['1:1','1:2','1:3','1:4','1:5','1:6','1:7'],'chaves deterministicas');
eq(other.units.length,6,'cinco lanches + um refrigerante');
eq(other.units[5].productId,'kuat-2l','refrigerante fica no seu proprio grupo');
eq(other.units[5].key,'2:1','chave do segundo componente preservada');
ok(blueprint.fingerprint.startsWith('v2-'),'fingerprint do cadastro versionado');
eq(engine.buildComboBlueprint(combo.id,combo.bundleItems).fingerprint,blueprint.fingerprint,'mesma composição gera mesmo fingerprint');
ok(engine.buildComboBlueprint(combo.id,[{productId:'uai',quantity:6}]).fingerprint!==blueprint.fingerprint,'alteração de composição invalida escolhas antigas');
ok(engine.buildComboBlueprint('combo-4-uai',combo.bundleItems).fingerprint!==blueprint.fingerprint,'combo diferente não reutiliza plano');
let plan=engine.emptyComboUnitPlan(blueprint);
eq(plan.choices.length,0,'plano vazio sem mutações');
eq(plan.version,2,'versao 2 explícita');
eq(plan.productId,combo.id,'plano vinculado ao combo');
eq(engine.previewComboKitchenInstructions(blueprint,plan).length,7,'prévia retorna sete linhas');
ok(engine.previewComboKitchenInstructions(blueprint,plan).every(s=>s.endsWith('padrão')),'plano inicial não modifica ingredientes');
const rules={addonIdsByProduct:{uai:['bacon','queijo'], 'kuat-2l':[]},removableIdsByProduct:{uai:['cebola','tomate'],'kuat-2l':[]}};
const original=JSON.stringify(plan);
plan=engine.applyComboUnitChange(blueprint,plan,{groupIndex:0,mode:'one',unitKeys:['1:1']},{field:'removal',id:'cebola',enabled:true},rules);
eq(plan.choices.length,1,'uma unidade alterada sem afetar demais');
eq(plan.choices[0].removedIngredientIds,['cebola'],'remoção individual persistida');
plan=engine.applyComboUnitChange(blueprint,plan,{groupIndex:0,mode:'selected',unitKeys:['1:3','1:4']},{field:'addon',id:'bacon',enabled:true},rules);
eq(plan.choices.length,3,'seleção de duas unidades somada à primeira');
eq(plan.choices.filter(x=>x.addonIds.includes('bacon')).map(x=>x.unitKey),['1:3','1:4'],'somente Uai 3 e 4 levam bacon');
eq(JSON.parse(original).choices.length,0,'estrutura anterior não mutada');
plan=engine.setComboUnitNote(blueprint,plan,'1:7','molho à parte');
eq(plan.choices.find(x=>x.unitKey==='1:7').note,'molho à parte','observação específica da unidade 7');
const kitchen=engine.previewComboKitchenInstructions(blueprint,plan);
ok(kitchen[0].includes('sem cebola'),'cozinha: Uai 1 sem cebola');
ok(kitchen[1].endsWith('padrão'),'cozinha: Uai 2 padrão');
ok(kitchen[2].includes('+ bacon'),'cozinha: Uai 3 com bacon');
ok(kitchen[3].includes('+ bacon'),'cozinha: Uai 4 com bacon');
ok(kitchen[4].endsWith('padrão'),'cozinha: Uai 5 padrão');
ok(kitchen[5].endsWith('padrão'),'cozinha: Uai 6 padrão');
ok(kitchen[6].includes('molho à parte'),'cozinha: Uai 7 com observação');
const all=engine.applyComboUnitChange(blueprint,plan,{groupIndex:0,mode:'all'},{field:'addon',id:'queijo',enabled:true},rules);
eq(all.choices.filter(x=>x.addonIds.includes('queijo')).length,7,'ação todas aplica uma vez em cada Uai');
const reversed=engine.applyComboUnitChange(blueprint,all,{groupIndex:0,mode:'all'},{field:'addon',id:'queijo',enabled:false},rules);
eq(reversed,plan,'reverter ação todas restaura exatamente plano anterior');
const removed=engine.applyComboUnitChange(blueprint,plan,{groupIndex:0,mode:'one',unitKeys:['1:1']},{field:'removal',id:'cebola',enabled:false},rules);
ok(!removed.choices.some(x=>x.unitKey==='1:1'),'remover último ajuste elimina entrada vazia');
const cleared=engine.setComboUnitNote(blueprint,removed,'1:7','');
ok(!cleared.choices.some(x=>x.unitKey==='1:7'),'nota vazia deixa de ocupar entrada');
// Combo misto: adicionar ao lanche nao pode aplicar ao refrigerante.
let mixed=engine.emptyComboUnitPlan(other);
mixed=engine.applyComboUnitChange(other,mixed,{groupIndex:0,mode:'all'},{field:'addon',id:'bacon',enabled:true},rules);
eq(mixed.choices.length,5,'todas no combo misto = cinco Uai, nao seis produtos');
ok(!mixed.choices.some(x=>x.unitKey==='2:1'),'refrigerante nao herda adicional do lanche');
throws(()=>engine.applyComboUnitChange(other,mixed,{groupIndex:1,mode:'all'},{field:'addon',id:'bacon',enabled:true},rules),/NOT_ALLOWED/,'bacon nao permitido para refrigerante');
throws(()=>engine.applyComboUnitChange(other,mixed,{groupIndex:0,mode:'selected',unitKeys:['1:1','2:1']},{field:'addon',id:'bacon',enabled:true},rules),/CROSSES_COMPONENTS/,'selecao entre grupos diferentes bloqueada');
throws(()=>engine.applyComboUnitChange(other,mixed,{groupIndex:0,mode:'one',unitKeys:['1:1','1:2']},{field:'addon',id:'bacon',enabled:true},rules),/SINGLE_INVALID/,'modo one exige exatamente uma unidade');
throws(()=>engine.applyComboUnitChange(other,mixed,{groupIndex:0,mode:'selected',unitKeys:[]},{field:'addon',id:'bacon',enabled:true},rules),/SCOPE_KEYS_INVALID/,'selecao vazia nao aprovada');
throws(()=>engine.applyComboUnitChange(other,mixed,{groupIndex:9,mode:'all'},{field:'addon',id:'bacon',enabled:true},rules),/GROUP_UNKNOWN/,'grupo inexistente bloqueado');
throws(()=>engine.applyComboUnitChange(other,mixed,{groupIndex:0,mode:'all',unitKeys:['1:1']},{field:'addon',id:'bacon',enabled:true},rules),/SCOPE_ALL_KEYS_INVALID/,'modo all rejeita alvos contraditorios');
throws(()=>engine.applyComboUnitChange(blueprint,plan,{groupIndex:0,mode:'selected',unitKeys:['1:1','1:1']},{field:'addon',id:'bacon',enabled:true},rules),/SCOPE_KEYS_INVALID/,'alvos duplicados bloqueados');
throws(()=>engine.applyComboUnitChange(blueprint,plan,{groupIndex:0,mode:'one',unitKeys:['1:1']},{field:'addon',id:'calabresa',enabled:true},rules),/NOT_ALLOWED/,'extra nao cadastrado nao entra no pedido');
throws(()=>engine.applyComboUnitChange(blueprint,plan,{groupIndex:0,mode:'one',unitKeys:['1:1']},{field:'removal',id:'presunto',enabled:true},rules),/NOT_ALLOWED/,'remocao fora da lista nao passa');
throws(()=>engine.applyComboUnitChange(blueprint,plan,{groupIndex:0,mode:'one',unitKeys:['1:1']},{field:'addon',id:'bacon',enabled:true},{addonIdsByProduct:{},removableIdsByProduct:{}}),/NOT_ALLOWED/,'sem configuracao explícita nao autoriza extra');
// Dados recebidos v2 precisam ser revalidados em TODA fronteira futura.
throws(()=>engine.parseComboUnitPlan({...plan,version:1},blueprint),/PLAN_VERSION_INVALID/,'v1 nao se confunde com v2');
throws(()=>engine.parseComboUnitPlan({...plan,productId:'combo-4-uai'},blueprint),/PRODUCT_MISMATCH/,'plano de outro combo rejeitado');
throws(()=>engine.parseComboUnitPlan({...plan,blueprintFingerprint:'v2-antiga'},blueprint),/STALE_COMPOSITION/,'plano antigo nao migra silenciosamente');
throws(()=>engine.parseComboUnitPlan({...plan,choices:[...plan.choices,{...plan.choices[0]}]},blueprint),/UNIT_UNKNOWN_OR_REPEATED/,'unidades duplicadas rejeitadas');
throws(()=>engine.parseComboUnitPlan({...plan,choices:[{unitKey:'1:99',addonIds:[],removedIngredientIds:[],note:''}]},blueprint),/UNIT_UNKNOWN_OR_REPEATED/,'unidade inexistente rejeitada');
throws(()=>engine.parseComboUnitPlan({...plan,choices:[{unitKey:'1:1',addonIds:['bacon','bacon'],removedIngredientIds:[],note:''}]},blueprint),/ITEM_IDS_INVALID/,'adicional duplicado rejeitado');
throws(()=>engine.parseComboUnitPlan({...plan,choices:[{unitKey:'1:1',addonIds:[],removedIngredientIds:['!'],note:''}]},blueprint),/ITEM_IDS_INVALID/,'id malformado rejeitado');
throws(()=>engine.parseComboUnitPlan({...plan,choices:[{unitKey:'1:1',addonIds:[],removedIngredientIds:[],note:'x'.repeat(141)}]},blueprint),/NOTE_INVALID/,'nota longa rejeitada');
throws(()=>engine.setComboUnitNote(blueprint,plan,'9:9','texto'),/NOTE_UNIT_UNKNOWN/,'nota em unidade desconhecida rejeitada');
throws(()=>engine.buildComboBlueprint('combo',[]),/COMPOSITION_INVALID/,'combo sem componentes rejeitado');
throws(()=>engine.buildComboBlueprint('combo',[{productId:'uai',quantity:0}]),/QUANTITY_INVALID/,'quantidade zero rejeitada');
throws(()=>engine.buildComboBlueprint('combo',[{productId:'uai',quantity:1.5}]),/QUANTITY_INVALID/,'quantidade fracionaria rejeitada');
throws(()=>engine.buildComboBlueprint('combo',[{productId:'uai',quantity:31}]),/QUANTITY_INVALID/,'quantidade exagerada por grupo rejeitada');
throws(()=>engine.buildComboBlueprint('combo',[{productId:'uai',quantity:30},{productId:'uai',quantity:30},{productId:'uai',quantity:1}]),/TOO_MANY_UNITS/,'combo com 61 itens rejeitado');
throws(()=>engine.buildComboBlueprint('combo',[{productId:'../secret',quantity:1}]),/COMPONENT_ID_INVALID/,'id malformado rejeitado');
// Políticas comerciais não aprovadas NÃO produzem preço, mesmo para projeto válido.
eq(engine.previewComboUnitPrice(blueprint,plan,6999,1),{state:'requires_commercial_approval',totalCents:null},'sem regra de cobrança não há preço');
const policy={billing:'per_customized_unit',removalDiscount:'none',addonPriceCents:{bacon:375,queijo:225}};
const preview=engine.previewComboUnitPrice(blueprint,plan,6999,2,policy);
eq(preview.state,'preview_only','com regra explícita o resultado ainda é apenas prévia');
eq(preview.extrasPerComboCents,750,'dois bacons em unidades diferentes: 2 x 375 centavos');
eq(preview.baseCents,6999,'base do Combo 7 Uai preservada');
eq(preview.totalCents,15498,'dois combos: (6999 + 750) x 2 = 15498 centavos');
eq(engine.previewComboUnitPrice(blueprint,plan,6999,1,policy).totalCents,7749,'um combo com duas unidades de bacon');
eq(engine.previewComboUnitPrice(blueprint,plan,6999,1,{...policy,addonPriceCents:{}}),{state:'missing_price',totalCents:null,addonId:'bacon'},'addon sem preço não cai em zero');
throws(()=>engine.previewComboUnitPrice(blueprint,plan,6999,0,policy),/CART_QUANTITY_INVALID/,'quantidade de combos zero invalida');
throws(()=>engine.previewComboUnitPrice(blueprint,plan,6999,31,policy),/CART_QUANTITY_INVALID/,'quantidade de combos >30 invalida');
throws(()=>engine.previewComboUnitPrice(blueprint,plan,6999.5,1,policy),/BASE_PRICE_INVALID/,'preço fracionário em centavos bloqueado');
throws(()=>engine.previewComboUnitPrice(blueprint,plan,6999,1,{...policy,addonPriceCents:{bacon:-1}}),/ADDON_PRICE_INVALID/,'adicional com preco negativo bloqueado');
throws(()=>engine.previewComboUnitPrice(blueprint,plan,6999,1,{...policy,addonPriceCents:{bacon:3.75}}),/ADDON_PRICE_INVALID/,'preço não inteiro de centavos bloqueado');
throws(()=>engine.previewComboUnitPrice(blueprint,plan,6999,1,{...policy,removalDiscount:'some'}),/PRICE_POLICY_INVALID/,'remocao não reduz valor silenciosamente');
throws(()=>engine.previewComboUnitPrice(blueprint,plan,6999,1,{...policy,billing:'per_bundle'}),/PRICE_POLICY_INVALID/,'cobrança por combo não é inferida pelo motor');
eq(engine.previewComboUnitPrice(blueprint,engine.emptyComboUnitPlan(blueprint),6999,1,policy).totalCents,6999,'plano sem extras preserva preço base');
eq(engine.previewComboUnitPrice(blueprint,plan,6999,2).state,'requires_commercial_approval','quantidade 2 sem política também recusa preço');
// O motor é intencionalmente isolado e sem chamadas remotas: ativar exige etapas futuras.
const source=read('src/lib/comboUnitPlan.ts');
ok(!/\b(?:fetch|setDoc|updateDoc|addDoc|onSnapshot|getDoc|runTransaction|localStorage|sessionStorage)\s*\(/.test(source),'motor sem rede, Firestore, storage ou transações');
const existing={
  'src/components/ui/ProductDetailsModal.tsx':'addItem(product, quantity, selectedAddons, observation.trim())',
  'src/store/cart.store.ts':'const finalPrice = commercialPrice + addonsTotal',
  'src/app/api/orders/route.ts':'tx.create(orderRef, canonicalOrder)',
  'src/lib/integration/orderEvents.ts':'DflSiteOrderItemSnapshotV1',
};
for(const [file,needle] of Object.entries(existing)) {
  const code=read(file);
  ok(code.includes(needle),`${file} mantém contrato v1`);
  ok(!code.includes('COMBO_UNIT_CUSTOMIZATION_ENABLED') && !code.includes('@/lib/comboUnitPlan'),`${file} não ativa v2`);
}
const ci=read('.github/workflows/site-sales-protection.yml');
ok(ci.includes('node scripts/test-site-r237-combo-unit-engine.cjs'),'CI executa motor v2');
ok(ci.includes('node scripts/test-site-r236-operational-final.cjs'),'R236 e fluxo legado preservados');
ok(ci.includes('node scripts/test-site-sales-critical-r1.cjs'),'proteção transacional de vendas preservada');
console.log(`R237: ${checks} verificações do contrato v2 aprovadas. Ativação DESLIGADA, zero pedidos/Firebase/rede.`);
// O endpoint público v1 deve rejeitar v2 até a implantação do contrato ponta a ponta.
const apiSource=read('src/app/api/orders/route.ts');
const apiAst=ts.createSourceFile('src/app/api/orders/route.ts',apiSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const parseDecl=apiAst.statements.find(statement=>ts.isFunctionDeclaration(statement)&&statement.name?.text==='parseLines');
ok(Boolean(parseDecl),'parseLines real encontrado na rota de pedidos');
const isolated=ts.transpileModule(parseDecl.getText(apiAst),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const decode=new Function('object','text',`${isolated};return parseLines;`)(
  value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{},
  (value,max=250)=>String(value??'').trim().slice(0,max),
);
const legacy=decode([{id:'combo-7-uai',quantity:2,selectedAddons:[{id:'bacon'}],observation:'sem cebola'}]);
eq(legacy.length,1,'API v1 continua aceitando uma linha tradicional de combo');
eq(legacy[0].quantity,2,'API v1 preserva quantidade de combos');
eq(legacy[0].selectedAddons[0].id,'bacon','API v1 preserva adicional tradicional');
for(const field of ['comboUnitPlan','unitCustomization','comboCustomization']) {
  const body={id:'combo-7-uai',quantity:1,selectedAddons:[],[field]:{version:2}};
  throws(()=>decode([body]),/CART_INVALID/,`API v1 rejeita ${field} sem descartar personalização individual`);
}
throws(()=>decode([{id:'combo-7-uai',quantity:1,selectedAddons:[],comboUnitPlan:null}]),/CART_INVALID/,'campo v2 nulo continua exigindo suporte explícito');
console.log(`R237 total: ${checks} verificações (motor puro + fronteira de pedidos v1 protegida).`);
