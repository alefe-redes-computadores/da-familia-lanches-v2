'use strict';
/** R243 staged visual interface + isolated state transitions: NO checkout / no network. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const read=path=>fs.readFileSync(path,'utf8');
let checks=0;
function eq(actual,expected,name){assert.deepEqual(actual,expected,'R243 '+name);checks++}
function ok(condition,name){assert.ok(condition,'R243 '+name);checks++}
function no(fn,regex,name){assert.throws(fn,regex,'R243 '+name);checks++}
function load(filename,deps={}){
 const source=read(filename);
 const parsed=ts.createSourceFile(filename,source,ts.ScriptTarget.Latest,true,filename.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(!parsed.parseDiagnostics.length,'TS parser '+filename);
 const t=ts.transpileModule(source,{fileName:filename,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 ok(!(t.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error),'TS transpile '+filename);
 const module={exports:{}};
 new Function('require','module','exports',t.outputText)((name)=>{if(!(name in deps))throw new Error('R243 UNEXPECTED_IMPORT '+name);return deps[name]},module,module.exports);
 return module.exports;
}
const engine=load('src/lib/comboUnitPlan.ts');
const commercial=load('src/lib/comboUnitCommercial.ts',{'./comboUnitPlan':engine});
const cart=load('src/lib/comboUnitCartDraft.ts',{'./comboUnitPlan':engine,'./comboUnitCommercial':commercial});
const editor=load('src/lib/comboUnitEditorDraft.ts',{'./comboUnitPlan':engine,'./comboUnitCartDraft':cart});
eq(editor.COMBO_UNIT_EDITOR_ENABLED,false,'R243 disabled in production');
eq(engine.COMBO_UNIT_CUSTOMIZATION_ENABLED,false,'R237 still disabled');
eq(commercial.COMBO_UNIT_COMMERCE_ENABLED,false,'R238 still disabled');
eq(cart.COMBO_UNIT_CART_DRAFT_ENABLED,false,'R239 still disabled');
eq(editor.COMBO_UNIT_EDITOR_SCHEMA,1,'draft schema unchanged');
const blueprint=engine.buildComboBlueprint('combo-7-uai',[{productId:'uai',quantity:7}]);
const capabilities={addonIdsByProduct:{uai:['bacon','queijo']},removableIdsByProduct:{uai:['cebola']}};
const initial=editor.emptyComboEditor(blueprint);
const initialJson=JSON.stringify(initial);
let groups=editor.listComboEditorGroups(blueprint);
eq(groups.length,1,'one group of Uai');eq(groups[0].units.length,7,'seven units');
eq(groups[0].productId,'uai','group product identity');
eq(groups[0].index,0,'zero-based group index');
eq(groups[0].units.map(x=>x.key),['1:1','1:2','1:3','1:4','1:5','1:6','1:7'],'stable ordering');
let p=initial;
p=editor.changeComboEditorUnits(blueprint,p,{groupIndex:0,mode:'selected',unitKeys:['1:3','1:4']},{field:'addon',id:'bacon',enabled:true},capabilities);
p=editor.changeComboEditorUnits(blueprint,p,{groupIndex:0,mode:'one',unitKeys:['1:4']},{field:'addon',id:'queijo',enabled:true},capabilities);
p=editor.changeComboEditorUnits(blueprint,p,{groupIndex:0,mode:'selected',unitKeys:['1:1','1:2']},{field:'removal',id:'cebola',enabled:true},capabilities);
p=editor.noteComboEditorUnit(blueprint,p,'1:7','Molho separado');
const rows=editor.readComboEditorUnits(blueprint,p);
eq(rows.length,7,'seven separate UI rows');
eq(rows.map(x=>x.unitKey),['1:1','1:2','1:3','1:4','1:5','1:6','1:7'],'row keys unchanged');
eq(rows[0].removedIngredientIds,['cebola'],'Uai 1 without onion');
eq(rows[1].removedIngredientIds,['cebola'],'Uai 2 without onion');
eq(rows[2].addonIds,['bacon'],'Uai 3 bacon');
eq(rows[3].addonIds,['bacon','queijo'],'Uai 4 bacon cheese');
eq(rows[4].customized,false,'Uai 5 default');
eq(rows[5].customized,false,'Uai 6 default');
eq(rows[6].note,'Molho separado','note belongs to Uai 7');
eq(rows.filter(x=>x.customized).length,5,'five customized per combo');
eq(JSON.stringify(initial),initialJson,'pure engine does not mutate original');
const noPolicy=editor.readComboEditorPreview(blueprint,p,2);
eq(noPolicy.status,'preview_only','no order object');
eq(noPolicy.amountCents,null,'no amount without policy');
eq(noPolicy.amountStatus,'POLICY_REQUIRED','explicit absence of policy');
eq(noPolicy.comboQuantity,2,'two combos tracked');
eq(noPolicy.customizedUnitsPerCombo,5,'five customized per combo');
eq(noPolicy.customizedUnitsInOrder,10,'ten modifications in two combos');
for(const k of ['canAddToCart','canPay','canSubmit','canPrint','canRelay'])eq(noPolicy[k],false,'feature gate '+k);
const rules={allowedAddonIds:['bacon','queijo'],removableIngredientIds:['cebola'],addonPriceCents:{bacon:375,queijo:225},minAddonsPerUnit:0,maxAddonsPerUnit:2,maxRemovalsPerUnit:1,groups:[]};
const policy={version:1,status:'draft',billing:'per_selected_unit',removalDiscount:'none',productId:blueprint.productId,blueprintFingerprint:blueprint.fingerprint,baseComboPriceCents:6999,rulesByProductId:{uai:rules}};
const quote=editor.readComboEditorPreview(blueprint,p,2,policy);
eq(quote.amountStatus,'preview_only','quote preview only');
eq(quote.amountCents,15948,'two combos 159.48 BRL test figures');
eq(quote.canPay,false,'quote cannot authorize payment');
eq(quote.draft.payable,false,'R239 draft still nonpayable');
eq(quote.draft.quote.extrasForOrderCents,1950,'two combo addons in integer cents');
eq(quote.draft.quote.quantity,2,'commercial quantity stable');
eq(quote.rows,rows,'readout rows equal editor readout');
eq(quote.customizedUnitsInOrder,10,'two combos repeat controlled choice layout');
for(const q of [0,-1,31,1.25,NaN,Infinity])no(()=>editor.readComboEditorPreview(blueprint,p,q,policy),/COMBO_EDITOR_QUANTITY_INVALID/,'bad quantity '+String(q));
no(()=>editor.changeComboEditorUnits(blueprint,p,{groupIndex:0,mode:'one',unitKeys:['1:3','1:4']},{field:'addon',id:'bacon',enabled:true},capabilities),/COMBO_UNIT_SCOPE_SINGLE_INVALID/,'one means exactly one unit');
no(()=>editor.changeComboEditorUnits(blueprint,p,{groupIndex:0,mode:'selected',unitKeys:['1:1','1:1']},{field:'addon',id:'bacon',enabled:true},capabilities),/COMBO_UNIT_SCOPE_KEYS_INVALID/,'duplicate selection rejected');
no(()=>editor.changeComboEditorUnits(blueprint,p,{groupIndex:0,mode:'selected',unitKeys:['9:9']},{field:'addon',id:'bacon',enabled:true},capabilities),/COMBO_UNIT_SCOPE_CROSSES_COMPONENTS/,'foreign unit rejected');
no(()=>editor.changeComboEditorUnits(blueprint,p,{groupIndex:0,mode:'all',unitKeys:['1:3']},{field:'addon',id:'bacon',enabled:true},capabilities),/COMBO_UNIT_SCOPE_ALL_KEYS_INVALID/,'all scope cannot carry keys');
no(()=>editor.changeComboEditorUnits(blueprint,p,{groupIndex:0,mode:'all'},{field:'addon',id:'unknown',enabled:true},capabilities),/COMBO_UNIT_CHANGE_NOT_ALLOWED_FOR_COMPONENT/,'unregistered extra refused');
no(()=>editor.noteComboEditorUnit(blueprint,p,'9:9','Oops'),/COMBO_UNIT_NOTE_UNIT_UNKNOWN/,'unknown note unit rejected');
no(()=>editor.noteComboEditorUnit(blueprint,p,'1:1','a'.repeat(141)),/COMBO_UNIT_NOTE_INVALID/,'long notes rejected');
let without=editor.changeComboEditorUnits(blueprint,p,{groupIndex:0,mode:'all'},{field:'addon',id:'bacon',enabled:false},capabilities);
eq(editor.readComboEditorUnits(blueprint,without)[2].addonIds,[],'all removes bacon from Uai 3');
eq(editor.readComboEditorUnits(blueprint,without)[3].addonIds,['queijo'],'all keeps independent cheese');
let all=editor.changeComboEditorUnits(blueprint,initial,{groupIndex:0,mode:'all'},{field:'addon',id:'bacon',enabled:true},capabilities);
eq(editor.readComboEditorUnits(blueprint,all).filter(x=>x.addonIds.includes('bacon')).length,7,'all applies to each Uai');
let undone=editor.changeComboEditorUnits(blueprint,all,{groupIndex:0,mode:'all'},{field:'addon',id:'bacon',enabled:false},capabilities);
eq(undone,initial,'add then remove all returns empty original');
// A beverage in another group must never gain sandwich modifiers.
const family=engine.buildComboBlueprint('combo-familia',[{productId:'uai',quantity:5},{productId:'kuat-2l',quantity:1}]);
const gf=editor.listComboEditorGroups(family);
eq(gf.map(x=>x.productId),['uai','kuat-2l'],'two distinct component groups');
eq(gf.map(x=>x.units.length),[5,1],'five sandwiches plus beverage');
const familyCaps={addonIdsByProduct:{uai:['bacon'],'kuat-2l':[]},removableIdsByProduct:{uai:['cebola'],'kuat-2l':[]}};
no(()=>editor.changeComboEditorUnits(family,editor.emptyComboEditor(family),{groupIndex:1,mode:'all'},{field:'addon',id:'bacon',enabled:true},familyCaps),/COMBO_UNIT_CHANGE_NOT_ALLOWED_FOR_COMPONENT/,'bacon never applied to beverage');
no(()=>editor.changeComboEditorUnits(family,editor.emptyComboEditor(family),{groupIndex:1,mode:'one',unitKeys:['1:2']},{field:'addon',id:'bacon',enabled:true},familyCaps),/COMBO_UNIT_SCOPE_CROSSES_COMPONENTS/,'cannot target another group');
no(()=>editor.readComboEditorPreview(family,p,1,policy),/COMBO_UNIT_PLAN_PRODUCT_MISMATCH|COMBO_UNIT_PLAN_STALE_COMPOSITION/,'plan for other combo rejected');
const missingPrice={...policy,rulesByProductId:{uai:{...rules,addonPriceCents:{queijo:225}}}};
const insufficient=editor.readComboEditorPreview(blueprint,p,1,missingPrice);
eq(insufficient.amountCents,null,'missing price gives no total');
eq(insufficient.amountStatus,'ADDON_PRICE_MISSING','missing price explicit');
eq(insufficient.canAddToCart,false,'missing price cannot open cart');
const stalePolicy={...policy,blueprintFingerprint:'wrong'};
no(()=>editor.readComboEditorPreview(blueprint,p,1,stalePolicy),/COMBO_COMMERCE_POLICY_STALE_OR_FOREIGN/,'stale catalog price rejected');
// UI is never imported by customer flows; test all security boundaries and static JSX.
const ui=read('src/components/ui/ComboUnitConfiguratorDraft.tsx');
const css=read('src/components/ui/ComboUnitConfiguratorDraft.module.css');
const ast=ts.createSourceFile('src/components/ui/ComboUnitConfiguratorDraft.tsx',ui,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
ok(!ast.parseDiagnostics.length,'UI TSX parser clean');
const built=ts.transpileModule(ui,{fileName:'src/components/ui/ComboUnitConfiguratorDraft.tsx',reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.Preserve,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
ok(!(built.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error),'UI TSX transpile clean');
for(const t of ['COMBO_UNIT_EDITOR_ENABLED','changeComboEditorUnits','noteComboEditorUnit','readComboEditorPreview','aria-pressed','type="checkbox"','<textarea','maxLength={140}','disabled aria-disabled="true"','onClick={reset}','role="alert"','data-release="preview-only"'])ok(ui.includes(t),'UI contract '+t);
for(const t of ['safe-area-inset-bottom','prefers-reduced-motion:reduce',':focus-visible','min-height:44px','@media(max-width:370px)'])ok(css.includes(t),'mobile CSS '+t);
for(const pth of ['src/components/ui/ProductDetailsModal.tsx','src/components/ui/CartModal.tsx','src/components/ui/CheckoutModal.tsx','src/lib/integration/orderEvents.ts','src/lib/thermalReceipt.ts','src/app/api/orders/route.ts','src/components/layout/AppShell.tsx']){
 const content=read(pth);
 ok(!content.includes('ComboUnitConfiguratorDraft')&&!content.includes('comboUnitEditorDraft'),'isolated UI not imported by '+pth);
}
for(const [name,source] of [['ui',ui],['model',read('src/lib/comboUnitEditorDraft.ts')]]){
 ok(!/\b(fetch|XMLHttpRequest|setDoc|addDoc|runTransaction|createCustomerOrder|window\.print)\s*\(/.test(source),'no network or write APIs in '+name);
 ok(!/\b(useCartStore|useUIStore|adminDb|firebaseAdmin|orderEvents|buildOrderCreatedEvent|navigator\.share)\b/.test(source),'no cart or relay imports in '+name);
}
const workflow=read('.github/workflows/site-sales-protection.yml');
ok(workflow.includes('node scripts/test-site-r243-combo-editor.cjs'),'R243 sales CI integration');
for(const previous of [237,238,239,240,241])ok(workflow.includes(`node scripts/test-site-r${previous}-`),'retains old R'+previous+' sale gate');
console.log(`R243: ${checks} verificacoes isoladas / UI / vendas OK. Zero pedidos e zero impressao.`);
