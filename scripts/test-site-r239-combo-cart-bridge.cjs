'use strict';
/** R239 — strict cart/checkout draft + fail-closed integration contracts. Zero network/writes/orders. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
let checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
const fail=(fn,regex,label)=>{assert.throws(fn,regex,label);checks++;};
const rd=file=>fs.readFileSync(file,'utf8');
function load(filename,allowed={}){
 const source=rd(filename);
 const parsed=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 ok(parsed.parseDiagnostics.length===0,filename+' TS parse');
 const output=ts.transpileModule(source,{fileName:filename,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 ok(!(output.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error),filename+' TS transpile');
 const module={exports:{}};
 new Function('module','exports','require',output.outputText)(module,module.exports,name=>{
   if(!Object.prototype.hasOwnProperty.call(allowed,name))throw Error('R239 forbidden dependency '+name);
   return allowed[name];
 });
 return module.exports;
}
const engine=load('src/lib/comboUnitPlan.ts');
const commerce=load('src/lib/comboUnitCommercial.ts',{'./comboUnitPlan':engine});
const bridge=load('src/lib/comboUnitCartDraft.ts',{'./comboUnitPlan':engine,'./comboUnitCommercial':commerce});
eq(engine.COMBO_UNIT_CUSTOMIZATION_ENABLED,false,'R237 OFF');
eq(commerce.COMBO_UNIT_COMMERCE_ENABLED,false,'R238 OFF');
eq(bridge.COMBO_UNIT_CART_DRAFT_ENABLED,false,'R239 OFF');
eq(bridge.COMBO_UNIT_CART_DRAFT_SCHEMA,1,'R239 schema');
const seven=engine.buildComboBlueprint('combo-7-uai',[{productId:'uai',quantity:7}]);
const family=engine.buildComboBlueprint('combo-familia-uai',[{productId:'uai',quantity:5},{productId:'kuat-2l',quantity:1}]);
const rules={addonIdsByProduct:{uai:['bacon','queijo'],'kuat-2l':[]},removableIdsByProduct:{uai:['cebola'],'kuat-2l':[]}};
const uai={allowedAddonIds:['bacon','queijo'],removableIngredientIds:['cebola'],addonPriceCents:{bacon:375,queijo:225},minAddonsPerUnit:0,maxAddonsPerUnit:2,maxRemovalsPerUnit:1,groups:[]};
const soda={allowedAddonIds:[],removableIngredientIds:[],addonPriceCents:{},minAddonsPerUnit:0,maxAddonsPerUnit:0,maxRemovalsPerUnit:0,groups:[]};
const policy={version:1,status:'draft',billing:'per_selected_unit',removalDiscount:'none',productId:seven.productId,blueprintFingerprint:seven.fingerprint,baseComboPriceCents:6999,rulesByProductId:{uai}};
let plan=engine.emptyComboUnitPlan(seven);
plan=engine.applyComboUnitChange(seven,plan,{groupIndex:0,mode:'selected',unitKeys:['1:3','1:4']},{field:'addon',id:'bacon',enabled:true},rules);
plan=engine.applyComboUnitChange(seven,plan,{groupIndex:0,mode:'one',unitKeys:['1:4']},{field:'addon',id:'queijo',enabled:true},rules);
plan=engine.applyComboUnitChange(seven,plan,{groupIndex:0,mode:'selected',unitKeys:['1:1','1:2']},{field:'removal',id:'cebola',enabled:true},rules);
plan=engine.setComboUnitNote(seven,plan,'1:5','molho separado');
const originalPlan=JSON.stringify(plan),originalPolicy=JSON.stringify(policy);
const two=bridge.prepareComboUnitCartDraft(seven,plan,2,policy);
eq(two.schema,1,'draft schema');eq(two.status,'preview_only','draft preview state');eq(two.payable,false,'draft not payable');
eq(two.comboQuantity,2,'quantity two');eq(two.productId,seven.productId,'product identity');eq(two.blueprintFingerprint,seven.fingerprint,'fresh blueprint fingerprint');
eq(two.unitPlan.choices.length,5,'two removals + two added + one note');
eq(two.quote.state,'draft_preview_only','commercial result draft only');eq(two.quote.isPayable,false,'commercial quote explicitly unpaid');
eq(two.quote.totalCents,15948,'2 x (6999 + 975)');eq(two.quote.extrasPerComboCents,975,'charge 2 bacon + cheese PER COMBO');
eq(two.quote.extrasForOrderCents,1950,'extras for two combos');
eq(two.kitchenPreview.length,7,'kitchen preview shows every Uai');
ok(two.kitchenPreview[0].includes('sem cebola'),'first Uai has removal');
ok(two.kitchenPreview[1].includes('sem cebola'),'second Uai has removal');
ok(two.kitchenPreview[2].includes('+ bacon'),'third Uai has bacon');
ok(two.kitchenPreview[3].includes('+ queijo'),'fourth Uai has cheese');
ok(two.kitchenPreview[4].includes('molho separado'),'fifth Uai has note');
ok(two.kitchenPreview[5].includes('padrão'),'sixth Uai unchanged');
ok(two.kitchenPreview[6].includes('padrão'),'seventh Uai unchanged');
ok(two.receiptPreview.some(x=>x.includes('NÃO COBRAR')),'receipt marked non-billable');
ok(two.receiptPreview.some(x=>x.includes('R$ 159,48')),'human money preview');
ok(!/\b(?:auth|approved|ready|payable)\s*:\s*true/.test(JSON.stringify(two)),'no payable state');
eq(JSON.stringify(plan),originalPlan,'plan not mutated');eq(JSON.stringify(policy),originalPolicy,'policy not mutated');
const one=bridge.prepareComboUnitCartDraft(seven,plan,1,policy);
eq(one.draftId,two.draftId,'cart identity unaffected by quantity');eq(one.quote.totalCents,7974,'quantity changes total only');
eq(bridge.prepareComboUnitCartDraft(seven,JSON.parse(JSON.stringify(plan)),2,policy).draftId,two.draftId,'JSON restored plan has stable identity');
const parsed=bridge.revalidateComboUnitCartDraft(JSON.parse(JSON.stringify(two)),seven,policy);
eq(parsed,two,'JSON draft revalidated and recomputed');
const handoff=bridge.previewComboUnitCheckoutHandoff(two);
eq(handoff.state,'blocked_for_checkout','checkout handoff blocked');eq(handoff.reason,'FEATURE_NOT_RELEASED','reason explicit');
eq(handoff.containsUnitChoices,true,'handoff notes customizations exist');eq(handoff.payable,false,'handoff non payable');
ok(!('totalCents' in handoff) && !('price' in handoff),'handoff contains no trusted price');
const empty=bridge.prepareComboUnitCartDraft(seven,engine.emptyComboUnitPlan(seven),1,policy);
eq(empty.quote.totalCents,6999,'empty customization preserves combo base price');
eq(bridge.previewComboUnitCheckoutHandoff(empty).containsUnitChoices,false,'empty customizations reported');
const noPolicy=bridge.prepareComboUnitCartDraft(seven,plan,1);
eq(noPolicy.quote,{state:'blocked',reason:'POLICY_REQUIRED',totalCents:null},'missing pricing blocked');
eq(noPolicy.receiptPreview,['SIMULAÇÃO BLOQUEADA — nenhuma cobrança autorizada'],'receipt blocked without prices');
eq(bridge.previewComboUnitCheckoutHandoff(noPolicy).state,'blocked_for_checkout','no policy cannot checkout');
const famPolicy={...policy,productId:family.productId,blueprintFingerprint:family.fingerprint,baseComboPriceCents:5999,rulesByProductId:{uai,soda,...{'kuat-2l':soda}}};
delete famPolicy.rulesByProductId.soda;
let famPlan=engine.emptyComboUnitPlan(family);
famPlan=engine.applyComboUnitChange(family,famPlan,{groupIndex:0,mode:'one',unitKeys:['1:2']},{field:'addon',id:'bacon',enabled:true},rules);
const mixed=bridge.prepareComboUnitCartDraft(family,famPlan,1,famPolicy);
eq(mixed.quote.totalCents,6374,'family Uai + soda charges only one bacon');
eq(mixed.kitchenPreview.length,6,'family preview includes soda as sixth component');
ok(mixed.kitchenPreview[5].includes('kuat-2l'),'drink identified separately');
fail(()=>engine.applyComboUnitChange(family,famPlan,{groupIndex:1,mode:'all'},{field:'addon',id:'bacon',enabled:true},rules),/CHANGE_NOT_ALLOWED_FOR_COMPONENT/,'bacon never applies to soda');
const malicious=[
 [{...two,draftId:'fake'},/DRAFT_ID_MISMATCH/,'forged draft key'],
 [{...two,productId:'combo-falso'},/DRAFT_STALE/,'foreign product'],
 [{...two,blueprintFingerprint:'old'},/DRAFT_STALE/,'stale composition'],
 [{...two,payable:true},/DRAFT_STATUS_INVALID/,'attempt to become payable'],
 [{...two,status:'approved'},/DRAFT_STATUS_INVALID/,'attempt to force approval'],
 [{...two,schema:2},/DRAFT_STATUS_INVALID/,'wrong version'],
 [{...two,comboQuantity:0},/QUANTITY_INVALID/,'invalid zero quantity'],
 [{...two,comboQuantity:31},/QUANTITY_INVALID/,'excess quantity'],
 [{...two,comboQuantity:2.1},/QUANTITY_INVALID/,'fractional quantity'],
 [{...two,unitPlan:{...plan,productId:'other'}},/PLAN_PRODUCT_MISMATCH/,'foreign unit plan'],
 [{...two,unitPlan:{...plan,blueprintFingerprint:'stale'}},/PLAN_STALE_COMPOSITION/,'stale unit plan'],
];
for(const [value,pattern,label] of malicious)fail(()=>bridge.revalidateComboUnitCartDraft(value,seven,policy),pattern,label);
fail(()=>bridge.revalidateComboUnitCartDraft(null,seven,policy),/DRAFT_INVALID/,'null draft');
fail(()=>bridge.revalidateComboUnitCartDraft([],seven,policy),/DRAFT_INVALID/,'array not draft');
fail(()=>bridge.prepareComboUnitCartDraft(seven,plan,-1,policy),/QUANTITY_INVALID/,'negative quantity');
fail(()=>bridge.prepareComboUnitCartDraft(seven,plan,1.5,policy),/QUANTITY_INVALID/,'fractional quantity');
fail(()=>bridge.prepareComboUnitCartDraft(seven,plan,31,policy),/QUANTITY_INVALID/,'quantity max');
fail(()=>bridge.prepareComboUnitCartDraft(seven,{...plan,choices:[{unitKey:'9:9',addonIds:[],removedIngredientIds:[],note:''}]},1,policy),/UNIT_UNKNOWN_OR_REPEATED/,'unknown unit');
fail(()=>bridge.prepareComboUnitCartDraft(family,plan,1,famPolicy),/PLAN_PRODUCT_MISMATCH/,'different combo plan');
fail(()=>bridge.previewComboUnitCheckoutHandoff({...two,payable:true}),/DRAFT_STATUS_INVALID/,'handoff refuses payable forgery');
const benign={id:'combo-7-uai',cartId:'legacy',price:69.99,quantity:1,selectedAddons:[],observation:'sem cebola'};
eq(bridge.inspectLegacyCartForUnitDraft([]),{safe:true},'empty cart safe');
eq(bridge.inspectLegacyCartForUnitDraft([benign]),{safe:true},'old order safe');
eq(bridge.inspectLegacyCartForUnitDraft([benign,{...benign,quantity:2}]),{safe:true},'multiple legacy cart items safe');
eq(bridge.inspectLegacyCartForUnitDraft(null),{safe:false,itemIndex:-1,reason:'CART_INVALID'},'null cart invalid');
eq(bridge.inspectLegacyCartForUnitDraft([null]),{safe:false,itemIndex:0,reason:'CART_INVALID'},'null row invalid');
eq(bridge.inspectLegacyCartForUnitDraft([42]),{safe:false,itemIndex:0,reason:'CART_INVALID'},'number row invalid');
const markers=['comboUnitPlan','unitCustomization','comboCustomization','comboUnitCartDraft','unitPlan','unitSelections','unitOverrides'];
for(const marker of markers){
 eq(bridge.inspectLegacyCartForUnitDraft([{...benign,[marker]:{}}]),{safe:false,itemIndex:0,reason:'UNIT_DRAFT_NOT_RELEASED'},marker+' object rejected');
 eq(bridge.inspectLegacyCartForUnitDraft([{...benign,[marker]:null}]).safe,false,marker+' null rejected');
 eq(bridge.inspectLegacyCartForUnitDraft([{...benign,[marker]:undefined}]).safe,false,marker+' undefined explicit rejected');
 eq(bridge.inspectLegacyCartForUnitDraft([benign,{...benign,[marker]:[]}]).itemIndex,1,marker+' second row index');
}
const source=rd('src/lib/comboUnitCartDraft.ts');
ok(!/\b(?:fetch|setDoc|getDoc|addDoc|updateDoc|deleteDoc|runTransaction|onSnapshot|localStorage|sessionStorage)\s*\(/.test(source),'bridge zero DB/storage/network');
ok(!source.includes('COMBO_UNIT_CART_DRAFT_ENABLED = true'),'cannot be enabled');
const ui=rd('src/components/ui/CartModal.tsx');
const checkout=rd('src/components/ui/CheckoutModal.tsx');
const api=rd('src/app/api/orders/route.ts');
const workflow=rd('.github/workflows/site-sales-protection.yml');
ok(ui.includes('inspectLegacyCartForUnitDraft(items)'),'cart inspects full state');
ok(ui.includes('disabled={!comboDraftSafety.safe || Boolean(reconciliation)'),'cart disables checkout for staged drafts');
ok(ui.includes('!comboDraftSafety.safe &&')&&ui.includes('role="alert"'),'cart exposes clear warning');
ok(checkout.includes('inspectLegacyCartForUnitDraft(items)')&&checkout.includes('inspectLegacyCartForUnitDraft(useCartStore.getState().items)'),'checkout checks snapshot and live store');
ok(checkout.indexOf('inspectLegacyCartForUnitDraft(items)')<checkout.indexOf('rememberOrderAttempt(typeof crypto'),'checkout guard before registering attempt');
ok(checkout.includes('if (!inspectLegacyCartForUnitDraft(useCartStore.getState().items).safe) return false;'),'post-confirmation cart not wrongly cleared');
ok(api.includes('raw.comboUnitPlan !== undefined')&&api.includes('raw.comboUnitCartDraft !== undefined')&&api.includes('raw.unitSelections !== undefined'),'server fail closed for staged fields');
ok(api.includes('tx.create(orderRef, canonicalOrder)'),'orders remain transactional');
ok(workflow.includes('node scripts/test-site-r239-combo-cart-bridge.cjs'),'new gate in CI');
ok(workflow.includes('node scripts/test-site-sales-critical-r1.cjs')&&workflow.includes('node scripts/test-site-r238-combo-commerce.cjs'),'existing sales / combo tests preserved');
for(const file of ['src/components/ui/CartModal.tsx','src/components/ui/CheckoutModal.tsx','src/app/api/orders/route.ts']){
 const parsed=ts.createSourceFile(file,rd(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 ok(parsed.parseDiagnostics.length===0,file+' TSX source syntax');
}
console.log(`R239: ${checks} verificações aprovadas — bridge não cobrável + bloqueio v1, zero pedidos e zero escritas.`);
