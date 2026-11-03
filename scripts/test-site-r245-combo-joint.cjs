'use strict';
/** R245 joint contract rehearsal. Reads Entregas R242 source from sibling repo.
 * NO Firestore, API, order creation, payments, print or relay. */
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const ts=require('typescript');
let checks=0;const eq=(a,b,s)=>{assert.deepStrictEqual(a,b,'R245 '+s);checks++};
const ok=(a,s)=>{assert.ok(a,'R245 '+s);checks++};
const bad=(fn,re,s)=>{assert.throws(fn,re,'R245 '+s);checks++};
const read=p=>fs.readFileSync(p,'utf8');
function load(p,imports={}){
 const source=read(p), ast=ts.createSourceFile(p,source,ts.ScriptTarget.ESNext,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,'syntax '+p);
 const out=ts.transpileModule(source,{fileName:p,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 ok(!(out.diagnostics||[]).some(e=>e.category===ts.DiagnosticCategory.Error),'transpile '+p);
 const mod={exports:{}};
 new Function('require','module','exports',out.outputText)(name=>{
  if(!Object.prototype.hasOwnProperty.call(imports,name))throw Error('R245 unexpected require '+name+' in '+p);
  return imports[name];
 },mod,mod.exports);
 return mod.exports;
}
const engine=load('src/lib/comboUnitPlan.ts');
const commerce=load('src/lib/comboUnitCommercial.ts',{'./comboUnitPlan':engine});
const cart=load('src/lib/comboUnitCartDraft.ts',{'./comboUnitPlan':engine,'./comboUnitCommercial':commerce});
const editor=load('src/lib/comboUnitEditorDraft.ts',{'./comboUnitPlan':engine,'./comboUnitCartDraft':cart});
const batch=load('src/lib/comboUnitBatchDraft.ts',{'./comboUnitPlan':engine,'./comboUnitCommercial':commerce,'./comboUnitEditorDraft':editor});
const groupsPolicy=load('src/lib/catalogAddonPolicy.ts');
const groups=load('src/lib/catalogModifierGroups.ts',{'@/lib/catalogAddonPolicy':groupsPolicy});
const catalog=load('src/lib/comboUnitCatalogDraft.ts',{'@/lib/catalog':{
 availableAddonsForProduct:(p,arr)=>p.category==='bebidas'?[]:arr.filter(a=>a.disponivel!==false&&(p.addonIds===undefined||p.addonIds.includes(a.id)))
},'@/lib/catalogModifierGroups':groups,'./comboUnitPlan':engine});
const ops=load('src/lib/comboUnitOperationalDraft.ts',{'./comboUnitPlan':engine,'./comboUnitCommercial':commerce,'./comboUnitCartDraft':cart});
const receiver=load('src/lib/comboUnitReceiverDraft.ts',{'./comboUnitOperationalDraft':ops});
const removals=load('src/lib/comboUnitIngredientRulesDraft.ts');
const bridge=load('src/lib/comboUnitBatchHandoffDraft.ts',{
 './comboUnitBatchDraft':batch,'./comboUnitCartDraft':cart,'./comboUnitOperationalDraft':ops,'./comboUnitReceiverDraft':receiver,
});
for(const [source,flag] of [[engine,'COMBO_UNIT_CUSTOMIZATION_ENABLED'],[commerce,'COMBO_UNIT_COMMERCE_ENABLED'],[cart,'COMBO_UNIT_CART_DRAFT_ENABLED'],[batch,'COMBO_UNIT_BATCH_LAB_ENABLED'],[receiver,'COMBO_UNIT_RECEIVER_ENABLED'],[ops,'COMBO_UNIT_OPERATIONAL_ENABLED'],[removals,'COMBO_UNIT_REMOVAL_RULES_ENABLED'],[bridge,'COMBO_UNIT_BATCH_HANDOFF_ENABLED']])eq(source[flag],false,flag+' remains OFF');
eq(bridge.COMBO_UNIT_BATCH_HANDOFF_SCHEMA,1,'schema');
eq(bridge.COMBO_UNIT_BATCH_HANDOFF_CONTRACT,'dfl_site_combo_batch_preview_v1','contract');
const products=load('src/data/products.ts').products,addons=load('src/data/addons.ts').ADDONS;
const uai=products.find(p=>p.id==='uai');
ok(Boolean(uai),'real Uai exists');ok(uai.detailsItems.includes('Bacon'),'real Uai lists bacon ingredient');
const removalDraft=removals.prepareComboRemovalRulesDraft(products,[{productId:'uai',ingredients:[{id:'bacon',label:'Bacon'},{id:'alface',label:'Alface'}]}]);
eq(removalDraft.schema,1,'removal schema');eq(removalDraft.status,'preview_only','removal preview');eq(removalDraft.liveCatalogMutation,false,'no mutation');
eq(removalDraft.declaredProductCount,1,'product count');eq(removalDraft.declaredIngredientCount,2,'ingredient count');
eq(removalDraft.removableByProductId.uai.map(r=>r.id),['bacon','alface'],'explicit ingredient IDs');
const options=removals.removalRulesAsCatalogLabOptions(removalDraft);
const lab=catalog.prepareComboCatalogLab('combo-7-uai',products,addons,options);
eq(lab.capabilities.removableIdsByProduct.uai,['bacon','alface'],'lab consumes explicit removal rules');
eq(lab.policy.status,'draft','policy still draft');eq(lab.payable,false,'no commercial enable');
let draft=batch.createComboBatchDraft(lab.blueprint,2);
const one=n=>({groupIndex:0,mode:'one',unitKeys:[`1:${n}`]});
draft=batch.changeComboBatchUnits(lab.blueprint,draft,1,one(1),{field:'removal',id:'bacon',enabled:true},lab.capabilities);
draft=batch.changeComboBatchUnits(lab.blueprint,draft,1,one(2),{field:'removal',id:'alface',enabled:true},lab.capabilities);
draft=batch.noteComboBatchUnit(lab.blueprint,draft,1,'1:7','Molho separado');
draft=batch.changeComboBatchUnits(lab.blueprint,draft,2,one(3),{field:'addon',id:'bacon',enabled:true},lab.capabilities);
draft=batch.changeComboBatchUnits(lab.blueprint,draft,2,{groupIndex:0,mode:'selected',unitKeys:['1:4','1:5']},{field:'addon',id:'bacon',enabled:true},lab.capabilities);
const oldDraft=JSON.stringify(draft),oldLab=JSON.stringify(lab);
const result=bridge.prepareComboBatchHandoffPreview(lab,draft);
eq(result.schema,1,'handoff schema');eq(result.status,'preview_only','handoff status');eq(result.canSend,false,'relay prohibited');
eq(result.authorized,{checkout:false,charge:false,print:false,relay:false,production:false},'all permissions OFF');
eq(result.comboCount,2,'two independent combos');eq(result.unitCount,14,'14 distinct units');
eq(result.segments.length,2,'one R241 receiver preview per physical combo');
ok(result.segments[0].identity!==result.segments[1].identity,'unique segment identity');
eq(new Set(result.units.map(x=>x.batchUnitKey)).size,14,'unique whole-batch unit keys');
eq(result.units[0].batchUnitKey,'c1:1:1','combo 1 unit 1');eq(result.units[13].batchUnitKey,'c2:1:7','combo 2 unit 7');
eq(result.units.find(x=>x.batchUnitKey==='c1:1:1').removals[0].label,'Bacon','first combo bacon removal');
eq(result.units.find(x=>x.batchUnitKey==='c1:1:2').removals[0].label,'Alface','first combo alface removal');
eq(result.units.find(x=>x.batchUnitKey==='c1:1:7').note,'Molho separado','first combo note');
eq(result.units.find(x=>x.batchUnitKey==='c2:1:7').note,'','second combo no note');
eq(result.units.find(x=>x.batchUnitKey==='c2:1:3').addons[0].id,'bacon','second combo 3 addon');
eq(result.units.filter(x=>x.batchComboNumber===1&&x.addons.length).length,0,'first has no paid addons');
eq(result.units.filter(x=>x.batchComboNumber===2&&x.addons.length).length,3,'second has 3 addons');
const baconPrice=lab.additionPricesCents.bacon;
eq(result.extrasForOrderCents,baconPrice*3,'extra cents from 3 bacon addons only');
eq(result.segments[0].extrasCents,0,'removals no automatic discount');
eq(result.segments[1].extrasCents,baconPrice*3,'second extras intact');
eq(result.totalPreviewCents,lab.policy.baseComboPriceCents*2+baconPrice*3,'total reconciled');
eq(result.totalPreviewCents,result.segments.reduce((v,s)=>v+s.totalCents,0),'segment totals sum');
ok(result.kitchenPreviewLines.some(x=>x.includes('c1:1:1')&&x.includes('SEM Bacon')),'kitchen first combo removal');
ok(result.kitchenPreviewLines.some(x=>x.includes('c2:1:3')&&x.includes('+ Bacon')),'kitchen second combo addon');
ok(result.kitchenPreviewLines.some(x=>x.includes('Molho separado')),'kitchen note');
ok(result.kitchenPreviewLines[0].includes('NAO PRODUZIR'),'kitchen clearly inert');
eq(result.segments[0].receiverDraft.source.quantity,1,'first individual draft quantity=1');
eq(result.segments[1].receiverDraft.source.quantity,1,'second individual draft quantity=1');
for(const segment of result.segments){
 eq(segment.receiverDraft.contract,'dfl_site_combo_units_preview_v1','R241 compatible inner contract');
 eq(receiver.reviewComboUnitReceiverCompatibility(segment.receiverDraft).sendAllowed,false,'R241 segment refused by live receiver');
 eq(segment.receiverDraft.orderId,null,'no order id');eq(segment.receiverDraft.eventId,null,'no event id');
 eq(segment.receiverDraft.authorization.print,false,'print off');eq(segment.receiverDraft.authorization.relay,false,'relay off');
}
eq(bridge.reviewBatchReceiverCompatibility(result).reason,'JOINT_HOMOLOGATION_REQUIRED','receptor needs joint homologation');
eq(bridge.reviewBatchReceiverCompatibility(result,{supports:['dfl_site_combo_unit_lines_v1']}).canSend,false,'forged support claim cannot send');
eq(JSON.stringify(draft),oldDraft,'no batch mutation');eq(JSON.stringify(lab),oldLab,'no catalog mutation');
eq(bridge.revalidateComboBatchHandoffPreview(JSON.parse(JSON.stringify(result)),lab,draft),result,'JSON recomputed and verified');
eq(bridge.prepareComboBatchHandoffPreview(lab,draft),result,'deterministic full packet');
bad(()=>bridge.revalidateComboBatchHandoffPreview({...result,canSend:true},lab,draft),/DRAFT_MODIFIED_OR_STALE/,'cannot toggle send');
bad(()=>bridge.revalidateComboBatchHandoffPreview({...result,totalPreviewCents:1},lab,draft),/DRAFT_MODIFIED_OR_STALE/,'total tamper refused');
bad(()=>bridge.revalidateComboBatchHandoffPreview({...result,units:result.units.slice(1)},lab,draft),/DRAFT_MODIFIED_OR_STALE/,'deleted unit refused');
bad(()=>bridge.reviewBatchReceiverCompatibility({...result,authorized:{...result.authorized,relay:true}}),/SENDER_NOT_OFF/,'relay switch denied');
bad(()=>bridge.reviewBatchReceiverCompatibility({...result,segments:[{...result.segments[0],receiverDraft:{...result.segments[0].receiverDraft,sendAllowed:true}},result.segments[1]]}),/SEGMENT_NOT_OFF/,'segment send refused');
const html=bridge.previewComboBatchAuditHtml(result);
ok(html.includes('NAO IMPRIMIR'),'HTML marked preview');ok(!html.includes('window.print')&&!html.includes('<button'),'HTML has no print control');
let xss=batch.noteComboBatchUnit(lab.blueprint,draft,1,'1:7','<img src=x onerror=alert(1)>');
const safeHtml=bridge.previewComboBatchAuditHtml(bridge.prepareComboBatchHandoffPreview(lab,xss));
ok(safeHtml.includes('&lt;img')&&!safeHtml.includes('<img'),'HTML escaped untrusted notes');
const fresh=batch.createComboBatchDraft(lab.blueprint,2);
const resultFresh=bridge.prepareComboBatchHandoffPreview(lab,fresh);
eq(resultFresh.totalPreviewCents,2*lab.policy.baseComboPriceCents,'empty choices base only');
eq(resultFresh.extrasForOrderCents,0,'empty extras zero');
const clone=batch.copyComboBatchPlan(lab.blueprint,draft,2,1);
const cloned=bridge.prepareComboBatchHandoffPreview(lab,clone);
eq(cloned.segments[0].totalCents,cloned.segments[1].totalCents,'explicit clone makes equal prices');
eq(cloned.units.find(x=>x.batchUnitKey==='c1:1:3').addons[0].id,'bacon','explicit clone applies selections');
const three=bridge.prepareComboBatchHandoffPreview(lab,batch.resizeComboBatchDraft(lab.blueprint,draft,3));
eq(three.unitCount,21,'three independent combos');eq(three.segments.length,3,'three receiver subdrafts');
eq(three.segments[2].extrasCents,0,'new third plan starts clean');
const uaiFallback=uai.detailsItems;
bad(()=>removals.prepareComboRemovalRulesDraft(products,[{productId:'uai',ingredients:[{id:'cebola',label:'Cebola'}]}]),/INGREDIENT_NOT_IN_STRUCTURED_DETAILS/,'do not claim onion on Uai absent in structured list');
ok(!uaiFallback.includes('Cebola'),'Uai catalog lists no onion');
bad(()=>removals.prepareComboRemovalRulesDraft(products,[{productId:'kuat-2l',ingredients:[{id:'gelo',label:'Gelo'}]}]),/PRODUCT_INELIGIBLE/,'drinks cannot have burger removals');
bad(()=>removals.prepareComboRemovalRulesDraft(products,[{productId:'combo-7-uai',ingredients:[{id:'bacon',label:'Bacon'}]}]),/PRODUCT_INELIGIBLE/,'nested/combo removals disallowed');
bad(()=>removals.prepareComboRemovalRulesDraft(products,[{productId:'uai',ingredients:[{id:'bacon',label:'Bacon'},{id:'bacon',label:'Bacon'}]}]),/INGREDIENT_DUPLICATED/,'duplicate removal ID refused');
bad(()=>removals.prepareComboRemovalRulesDraft(products,[{productId:'uai',ingredients:[{id:'bad id',label:'Bacon'}]}]),/INGREDIENT_INVALID/,'bad ingredient ID refused');
bad(()=>removals.prepareComboRemovalRulesDraft(products,[{productId:'uai',ingredients:[{id:'bacon',label:'Bacon\nNOTA'}]}]),/INGREDIENT_INVALID/,'multiline label refused');
bad(()=>removals.prepareComboRemovalRulesDraft(products,[{productId:'missing',ingredients:[]}]),/PRODUCT_INELIGIBLE/,'missing product refused');
bad(()=>removals.prepareComboRemovalRulesDraft(products,[{productId:'uai',ingredients:[]},{productId:'uai',ingredients:[]}]),/DECLARATION_INVALID/,'duplicate product declaration refused');
bad(()=>removals.removalRulesAsCatalogLabOptions({...removalDraft,liveCatalogMutation:true}),/DRAFT_INVALID/,'removal policy cannot be promoted to live');
const family=catalog.prepareComboCatalogLab('combo-familia-uai',products,addons,options);
const fam=bridge.prepareComboBatchHandoffPreview(family,batch.createComboBatchDraft(family.blueprint,2));
eq(fam.unitCount,12,'family 5 snacks and drink * 2');
eq(fam.units.filter(x=>x.productId==='kuat-2l').length,2,'two drinks distinct');
eq(fam.units.filter(x=>x.productId==='kuat-2l'&&x.addons.length).length,0,'beverages never inherit bacon');
// Live adapters must remain closed; source must not import experimental projection.
for(const file of ['src/app/api/orders/route.ts','src/components/ui/CheckoutModal.tsx','src/lib/integration/orderEvents.ts','src/lib/thermalReceipt.ts']){
 const code=read(file);
 ok(!code.includes('comboUnitBatchHandoffDraft'),'no experimental import in '+file);
}
ok(read('src/app/api/orders/route.ts').includes('tx.create(orderRef, canonicalOrder)'),'real transaction unchanged');
ok(!read('src/components/layout/AppShell.tsx').includes('ComboUnitBatchAuditDraft'),'audit UI not in public shell');
const ui=read('src/components/ui/ComboUnitBatchConfiguratorDraft.tsx');
ok(ui.includes('prepareComboBatchHandoffPreview')&&ui.includes('ComboUnitBatchAuditDraft'),'lab connected to cross-system readout');
const audit=read('src/components/ui/ComboUnitBatchAuditDraft.tsx');
ok(audit.includes('data-release="preview-only"')&&audit.includes('Conferência da cozinha'),'audit accessible and marked OFF');
ok(audit.includes('Nenhuma alteração operacional'),'lab warns operation unchanged');
const css=read('src/components/ui/ComboUnitBatchAuditDraft.module.css');
ok(css.includes('safe-area-inset-bottom')&&css.includes('prefers-reduced-motion'),'mobile safe and reduce motion');
const workflow=read('.github/workflows/site-sales-protection.yml');
ok(workflow.includes('node scripts/test-site-r245-combo-joint.cjs'),'new test gated');
ok(workflow.includes('node scripts/test-site-r244-catalog-batch.cjs')&&workflow.includes('node scripts/test-site-r241-receiver-compat.cjs'),'previous regression gates retained');
for(const file of ['src/lib/comboUnitIngredientRulesDraft.ts','src/lib/comboUnitBatchHandoffDraft.ts','src/components/ui/ComboUnitBatchAuditDraft.tsx']){
 const code=read(file);ok(!/\b(?:fetch|setDoc|addDoc|runTransaction|print)\s*\(/.test(code),'no I/O '+file);
}
// Always exercise the pinned R242 parser fixture in Site CI (which doesn't clone Entregas).
// On the owner's Termux ALSO exercise the current sibling Entregas source, so drift blocks publication.
const fixture=load('scripts/fixtures/r242-entregas-consumer.ts');
const deliveriesRoot=process.env.DFL_ENTREGAS_REPO||path.join(os.homedir(),'projects','dfl-entregas');
const receiverFile=path.join(deliveriesRoot,'lib/integration/site-combo-unit-preview.ts');
const readers=[['R242 verified fixture',fixture]];
if(fs.existsSync(receiverFile)){
  readers.push(['live sibling Entregas',load(receiverFile)]);
  const entGuard=read(path.join(deliveriesRoot,'lib/integration/site-combo-unit-guard.ts'));
  ok(entGuard.includes('SITE_COMBO_UNIT_PRODUCTION_SUPPORTED = false'),'sibling Entregas production combo flag remains OFF');
} else if(process.env.CI!=='true') throw Error('R245: repositório irmão Entregas não encontrado para homologação cruzada');
for(const [name,receiving] of readers){
  eq(receiving.SITE_COMBO_UNIT_PREVIEW_ENABLED,false,name+' remains OFF');
  eq(receiving.SITE_COMBO_UNIT_PREVIEW_CONTRACT,'dfl_site_combo_units_preview_v1',name+' parser contract');
  for(let i=0;i<result.segments.length;i++){
    const parsed=receiving.inspectSiteComboUnitPreview(JSON.parse(JSON.stringify(result.segments[i].receiverDraft)));
    eq(parsed.comboQuantity,1,name+' accepts one independent combo');
    eq(parsed.units.length,7,name+' preserves seven Uai');
    eq(parsed.totalPreviewCents,result.segments[i].totalCents,name+' preserves cent amounts');
    eq(parsed.canPersist,false,name+' never persists');
    eq(parsed.canRelay,false,name+' never relays');
    eq(parsed.canCharge,false,name+' never charges');
  }
  bad(()=>receiving.inspectSiteComboUnitPreview(JSON.parse(JSON.stringify(result))),/SITE_COMBO_PREVIEW_/,name+' refuses batch wrapper');
}
console.log(`R245: ${checks} verificacoes SITE + ${readers.map(x=>x[0]).join(' + ')}. 0 pedidos, 0 Firestore, 0 impressao, 0 relay.`);
