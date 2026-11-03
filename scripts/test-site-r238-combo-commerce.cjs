'use strict';
/** R238: deterministic isolated commerce-draft proof; no network / Firestore / orders. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
let checks=0;
const ok=(test,reason)=>{assert.ok(test,reason);checks++;};
const eq=(actual,expected,reason)=>{assert.deepEqual(actual,expected,reason);checks++;};
const fail=(fn,expression,reason)=>{assert.throws(fn,expression,reason);checks++;};
const read=p=>fs.readFileSync(p,'utf8');
function load(file,allowed={}) {
 const src=read(file);
 const ast=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,`${file} parses`);
 const out=ts.transpileModule(src,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 ok(!(out.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error),`${file} transpiles`);
 const module={exports:{}};
 new Function('require','module','exports',out.outputText)(name=>{
   if (!Object.prototype.hasOwnProperty.call(allowed,name)) throw Error('R238 forbidden import: '+name);
   return allowed[name];
 },module,module.exports);
 return module.exports;
}
const engine=load('src/lib/comboUnitPlan.ts');
const commerce=load('src/lib/comboUnitCommercial.ts',{'./comboUnitPlan':engine});
eq(engine.COMBO_UNIT_CUSTOMIZATION_ENABLED,false,'R237 engine is feature OFF');
eq(commerce.COMBO_UNIT_COMMERCE_ENABLED,false,'R238 commerce stays OFF');
eq(commerce.COMBO_UNIT_COMMERCE_SCHEMA,1,'R238 commercial schema version');
const b=engine.buildComboBlueprint('combo-7-uai',[{productId:'uai',quantity:7}]);
const bp=engine.buildComboBlueprint('combo-familia-uai',[{productId:'uai',quantity:5},{productId:'kuat-2l',quantity:1}]);
eq(b.units.length,7,'seven units');
eq(bp.units.length,6,'family has 5 snacks and 1 soda');
const rules={addonIdsByProduct:{uai:['bacon','queijo','ovo'],'kuat-2l':[]},removableIdsByProduct:{uai:['cebola','tomate'],'kuat-2l':[]}};
let plan=engine.emptyComboUnitPlan(b);
plan=engine.applyComboUnitChange(b,plan,{groupIndex:0,mode:'selected',unitKeys:['1:3','1:4']},{field:'addon',id:'bacon',enabled:true},rules);
plan=engine.applyComboUnitChange(b,plan,{groupIndex:0,mode:'one',unitKeys:['1:4']},{field:'addon',id:'queijo',enabled:true},rules);
plan=engine.applyComboUnitChange(b,plan,{groupIndex:0,mode:'selected',unitKeys:['1:1','1:2']},{field:'removal',id:'cebola',enabled:true},rules);
const baseRule={allowedAddonIds:['bacon','queijo','ovo'],removableIngredientIds:['cebola','tomate'],addonPriceCents:{bacon:375,queijo:225,ovo:200},minAddonsPerUnit:0,maxAddonsPerUnit:3,maxRemovalsPerUnit:2,groups:[]};
const sodaRule={allowedAddonIds:[],removableIngredientIds:[],addonPriceCents:{},minAddonsPerUnit:0,maxAddonsPerUnit:0,maxRemovalsPerUnit:0,groups:[]};
const policy={version:1,status:'draft',billing:'per_selected_unit',removalDiscount:'none',productId:b.productId,blueprintFingerprint:b.fingerprint,baseComboPriceCents:6999,rulesByProductId:{uai:baseRule}};
const initialPolicy=JSON.stringify(policy),initialPlan=JSON.stringify(plan);
eq(commerce.reviewComboUnitCommercialDraft(b,plan,1),{state:'blocked',reason:'POLICY_REQUIRED',totalCents:null},'policy missing => no quote');
const quote=commerce.reviewComboUnitCommercialDraft(b,plan,2,policy);
eq(quote.state,'draft_preview_only','draft cannot become payable');
eq(quote.isPayable,false,'explicit not payable');
eq(quote.version,1,'draft commercial version');
eq(quote.productId,'combo-7-uai','product kept');
eq(quote.blueprintFingerprint,b.fingerprint,'composition fingerprint kept');
eq(quote.baseComboPriceCents,6999,'base 6999 cents');
eq(quote.extrasPerComboCents,975,'2 bacon at 375 + cheese at 225 = 975');
eq(quote.extrasForOrderCents,1950,'extras multiplied across 2 combos');
eq(quote.totalCents,15948,'2 x (6999 + 975) = 15948');
eq(quote.chargedAddonUnits,6,'three extras per combo x 2');
eq(quote.units.length,7,'seven detailed kitchen lines');
eq(quote.units.filter(u=>u.addons.length).map(u=>u.unitKey),['1:3','1:4'],'only 3 and 4 charged');
eq(quote.units.filter(u=>u.removals.length).map(u=>u.unitKey),['1:1','1:2'],'only 1 and 2 without onion');
eq(quote.units.find(u=>u.unitKey==='1:3').extrasCents,375,'third Uai bacon price');
eq(quote.units.find(u=>u.unitKey==='1:4').extrasCents,600,'fourth Uai bacon+cheese');
eq(quote.units.find(u=>u.unitKey==='1:1').extrasCents,0,'removal does not discount');
eq(quote.units.find(u=>u.unitKey==='1:5').addons,[],'unchanged Uai no extras');
eq(JSON.stringify(plan),initialPlan,'plan never mutated');
eq(JSON.stringify(policy),initialPolicy,'commercial policy never mutated');
const receipt=commerce.previewComboUnitCommercialReceipt(quote);
eq(receipt.length,10,'two summary lines, guard plus seven units');
ok(receipt[0].includes('NÃO COBRAR'),'draft receipt is visibly blocked');
ok(receipt.some(line=>line.includes('R$ 159,48')),'human display total correct');
ok(receipt.some(line=>line.includes('sem cebola (sem desconto)')),'removal no discount explicit');
ok(receipt.some(line=>line.includes('+ bacon (R$ 3,75)')),'extra unit price displayed');
eq(commerce.previewComboUnitCommercialReceipt({state:'blocked',reason:'POLICY_REQUIRED',totalCents:null}),['SIMULAÇÃO BLOQUEADA — nenhuma cobrança autorizada'],'blocked cannot issue receipt');
const single=commerce.reviewComboUnitCommercialDraft(b,plan,1,policy);
eq(single.totalCents,7974,'single combo calculation');
eq(single.extrasForOrderCents,975,'single combo extras');
const empty=commerce.reviewComboUnitCommercialDraft(b,engine.emptyComboUnitPlan(b),1,policy);
eq(empty.totalCents,6999,'no extras preserves base');
eq(empty.chargedAddonUnits,0,'no extras no charged units');
const familyPolicy={...policy,productId:bp.productId,blueprintFingerprint:bp.fingerprint,baseComboPriceCents:5999,rulesByProductId:{uai:baseRule,'kuat-2l':sodaRule}};
let familyPlan=engine.emptyComboUnitPlan(bp);
familyPlan=engine.applyComboUnitChange(bp,familyPlan,{groupIndex:0,mode:'one',unitKeys:['1:2']},{field:'addon',id:'bacon',enabled:true},rules);
const fq=commerce.reviewComboUnitCommercialDraft(bp,familyPlan,1,familyPolicy);
eq(fq.totalCents,6374,'five snacks and soda: only bacon priced');
eq(fq.units[5].productId,'kuat-2l','drink identity maintained');
eq(fq.units[5].addons,[],'drink receives no bacon');
const invalidAdd={...plan,choices:[{unitKey:'1:1',addonIds:['calabresa'],removedIngredientIds:[],note:''}]};
fail(()=>commerce.reviewComboUnitCommercialDraft(b,invalidAdd,1,policy),/UNIT_ADDON_NOT_ALLOWED/,'undeclared addon rejected even if plan structural parse passes');
const invalidRemoval={...plan,choices:[{unitKey:'1:1',addonIds:[],removedIngredientIds:['presunto'],note:''}]};
fail(()=>commerce.reviewComboUnitCommercialDraft(b,invalidRemoval,1,policy),/UNIT_REMOVAL_NOT_ALLOWED/,'undeclared ingredient removal rejected');
const sodaPlan={...familyPlan,choices:[...familyPlan.choices,{unitKey:'2:1',addonIds:['bacon'],removedIngredientIds:[],note:''}]};
fail(()=>commerce.reviewComboUnitCommercialDraft(bp,sodaPlan,1,familyPolicy),/UNIT_ADDON_NOT_ALLOWED/,'bacon on soda blocked');
const noPrice={...policy,rulesByProductId:{uai:{...baseRule,addonPriceCents:{queijo:225}}}};
eq(commerce.reviewComboUnitCommercialDraft(b,plan,1,noPrice),{state:'blocked',reason:'ADDON_PRICE_MISSING',addonId:'bacon',productId:'uai',totalCents:null},'missing price never assumes zero');
const groupRule={...baseRule,groups:[{id:'proteina',min:0,max:1,addonIds:['bacon','queijo']}]};
fail(()=>commerce.reviewComboUnitCommercialDraft(b,plan,1,{...policy,rulesByProductId:{uai:groupRule}}),/UNIT_ADDON_GROUP_LIMIT/,'more than group max rejected on unit 4');
const groupRequired={...baseRule,groups:[{id:'proteina',min:1,max:2,addonIds:['bacon','queijo']}]};
fail(()=>commerce.reviewComboUnitCommercialDraft(b,plan,1,{...policy,rulesByProductId:{uai:groupRequired}}),/UNIT_ADDON_GROUP_LIMIT/,'group min requires each configured unit');
fail(()=>commerce.reviewComboUnitCommercialDraft(b,plan,1,{...policy,rulesByProductId:{uai:{...baseRule,maxAddonsPerUnit:1}}}),/UNIT_ADDON_LIMIT/,'max addons applies per snack');
fail(()=>commerce.reviewComboUnitCommercialDraft(b,plan,1,{...policy,rulesByProductId:{uai:{...baseRule,maxRemovalsPerUnit:0}}}),/UNIT_REMOVAL_LIMIT/,'zero removals allowed, selected removals refused');
const withTwoRemovals=engine.applyComboUnitChange(b,plan,{groupIndex:0,mode:'one',unitKeys:['1:1']},{field:'removal',id:'tomate',enabled:true},rules);
fail(()=>commerce.reviewComboUnitCommercialDraft(b,withTwoRemovals,1,{...policy,rulesByProductId:{uai:{...baseRule,maxRemovalsPerUnit:1}}}),/UNIT_REMOVAL_LIMIT/,'per snack removal cap respected');
const tests=[
 [{...policy,version:2},/POLICY_MODE_INVALID/,'schema mismatch'],
 [{...policy,status:'approved'},/POLICY_MODE_INVALID/,'cannot self-approve draft'],
 [{...policy,billing:'per_bundle'},/POLICY_MODE_INVALID/,'billing must be per selected unit'],
 [{...policy,removalDiscount:'discounted'},/POLICY_MODE_INVALID/,'cannot discount removals silently'],
 [{...policy,productId:'combo-4-uai'},/POLICY_STALE_OR_FOREIGN/,'policy another product'],
 [{...policy,blueprintFingerprint:'v2-old'},/POLICY_STALE_OR_FOREIGN/,'stale composition rejected'],
 [{...policy,baseComboPriceCents:6999.2},/BASE_PRICE_INVALID/,'fractional cents rejected'],
 [{...policy,baseComboPriceCents:-100},/BASE_PRICE_INVALID/,'negative price rejected'],
 [{...policy,baseComboPriceCents:5_000_001},/BASE_PRICE_INVALID/,'high base blocked'],
 [{...policy,rulesByProductId:{}},/COMPONENT_RULES_MISMATCH/,'component pricing missing'],
 [{...policy,rulesByProductId:{uai:baseRule,'kuat-2l':sodaRule}},/COMPONENT_RULES_MISMATCH/,'unexpected component rule'],
 [{...policy,rulesByProductId:{uai:{...baseRule,allowedAddonIds:['bacon','bacon']}}},/OPTION_IDS_INVALID/,'duplicate option ids'],
 [{...policy,rulesByProductId:{uai:{...baseRule,allowedAddonIds:['foo']}}},/PRICE_TABLE_UNEXPECTED_ID/,'price table foreign addon id'],
 [{...policy,rulesByProductId:{uai:{...baseRule,addonPriceCents:{bacon:-100}}}},/ADDON_PRICE_INVALID/,'negative add-on price'],
 [{...policy,rulesByProductId:{uai:{...baseRule,addonPriceCents:{bacon:375.3}}}},/ADDON_PRICE_INVALID/,'fractional add-on price'],
 [{...policy,rulesByProductId:{uai:{...baseRule,minAddonsPerUnit:3,maxAddonsPerUnit:1}}},/OPTION_LIMITS_INVALID/,'min greater than max'],
 [{...policy,rulesByProductId:{uai:{...baseRule,maxAddonsPerUnit:21}}},/MAX_ADDONS_INVALID/,'over 20 addon selections'],
 [{...policy,rulesByProductId:{uai:{...baseRule,maxRemovalsPerUnit:21}}},/MAX_REMOVALS_INVALID/,'over 20 removals'],
 [{...policy,rulesByProductId:{uai:{...baseRule,groups:[{id:'x',min:1,max:4,addonIds:['bacon','queijo']}]}}},/GROUP_LIMITS_INVALID/,'group max not above available'],
 [{...policy,rulesByProductId:{uai:{...baseRule,groups:[{id:'x',min:0,max:1,addonIds:['bacon']},{id:'y',min:0,max:1,addonIds:['bacon']}]}}},/GROUP_CONFLICT_OR_FOREIGN_ADDON/,'addon in two groups'],
 [{...policy,rulesByProductId:{uai:{...baseRule,groups:[{id:'x',min:1,max:1,addonIds:['bacon']},{id:'y',min:1,max:1,addonIds:['queijo']}],maxAddonsPerUnit:1}}},/GROUPS_EXCEED_GLOBAL_MAX/,'required group mins over global max'],
];
for(const [candidate,pattern,label] of tests)fail(()=>commerce.parseComboUnitCommercialDraft(candidate,b),pattern,label);
fail(()=>commerce.reviewComboUnitCommercialDraft(b,plan,0,policy),/QUANTITY_INVALID/,'zero combos refused');
fail(()=>commerce.reviewComboUnitCommercialDraft(b,plan,31,policy),/QUANTITY_INVALID/,'over 30 combos refused');
fail(()=>commerce.reviewComboUnitCommercialDraft(b,plan,1.5,policy),/QUANTITY_INVALID/,'fractional combo quantity refused');
fail(()=>commerce.reviewComboUnitCommercialDraft(b,{...plan,productId:'different'},1,policy),/PLAN_PRODUCT_MISMATCH/,'plan from other combo rejected');
fail(()=>commerce.reviewComboUnitCommercialDraft(b,{...plan,blueprintFingerprint:'stale'},1,policy),/PLAN_STALE_COMPOSITION/,'plan stale composition rejected');
const highRule={...baseRule,addonPriceCents:{bacon:1_000_000,queijo:1_000_000,ovo:1_000_000}};
const hugePlan=engine.emptyComboUnitPlan(b);
const fullPlan=engine.applyComboUnitChange(b,hugePlan,{groupIndex:0,mode:'all'},{field:'addon',id:'bacon',enabled:true},rules);
const maxPricePolicy={...policy,baseComboPriceCents:5_000_000,rulesByProductId:{uai:highRule}};
fail(()=>commerce.reviewComboUnitCommercialDraft(b,fullPlan,30,maxPricePolicy),/TOTAL_INVALID/,'total ceiling enforced');
const commerceSrc=read('src/lib/comboUnitCommercial.ts');
ok(!/\b(?:fetch|setDoc|addDoc|updateDoc|deleteDoc|onSnapshot|getDoc|runTransaction|localStorage|sessionStorage)\s*\(/.test(commerceSrc),'new pure engine has no writes/network/storage');
ok(commerceSrc.includes('state:"draft_preview_only"'),'preview explicitly nonpayable');
ok(commerceSrc.includes('isPayable:false'),'no paid quote state');
const ci=read('.github/workflows/site-sales-protection.yml');
ok(ci.includes('node scripts/test-site-r238-combo-commerce.cjs'),'CI loads R238 audit');
ok(ci.includes('node scripts/test-site-r237-combo-unit-engine.cjs'),'CI preserves R237');
ok(ci.includes('node scripts/test-site-sales-critical-r1.cjs'),'CI retains order transaction gate');
for(const filename of ['src/components/ui/ProductDetailsModal.tsx','src/store/cart.store.ts','src/app/api/orders/route.ts','src/lib/integration/orderEvents.ts']) {
 const src=read(filename);
 ok(!src.includes('comboUnitCommercial') && !src.includes('COMBO_UNIT_COMMERCE_ENABLED'),`${filename} still uses v1 commercial authority`);
}
const api=read('src/app/api/orders/route.ts');
ok(api.includes('raw.comboUnitPlan !== undefined'),'backend rejects unsupported combo unit plans');
ok(api.includes('tx.create(orderRef, canonicalOrder)'),'transactional order creation preserved');
console.log(`R238: ${checks} verificações aprovadas (simulação isolada, zero pedidos e zero escrituras).`);
