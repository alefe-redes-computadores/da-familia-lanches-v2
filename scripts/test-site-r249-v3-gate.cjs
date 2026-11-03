'use strict';
/** R249: production boundary and isolated V3 commercial candidate, never writes orders. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),path=require('node:path');
let count=0;
const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,'R249 '+m);count++};
const ok=(v,m)=>{assert.ok(v,'R249 '+m);count++};
const no=(fn,re,m)=>{assert.throws(fn,re,'R249 '+m);count++};
const read=x=>fs.readFileSync(x,'utf8');
function load(file,imports={}){
 const source=read(file),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,'TS parse '+file);
 const out=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}});
 ok(!(out.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error),'TS transpile '+file);
 const module={exports:{}};
 new Function('require','module','exports',out.outputText)(name=>{
  if(!Object.prototype.hasOwnProperty.call(imports,name))throw Error(`R249 unauthorized import ${file} -> ${name}`);
  return imports[name];
 },module,module.exports);
 return module.exports;
}
const rem=load('src/lib/catalogRemovableIngredients.ts');
const plan=load('src/lib/comboUnitPlan.ts');
const com=load('src/lib/comboUnitCommercial.ts',{'./comboUnitPlan':plan});
const cart=load('src/lib/comboUnitCartDraft.ts',{'./comboUnitPlan':plan,'./comboUnitCommercial':com});
const editor=load('src/lib/comboUnitEditorDraft.ts',{'./comboUnitPlan':plan,'./comboUnitCartDraft':cart});
const batch=load('src/lib/comboUnitBatchDraft.ts',{'./comboUnitPlan':plan,'./comboUnitCommercial':com,'./comboUnitEditorDraft':editor});
const addonPolicy=load('src/lib/catalogAddonPolicy.ts');
const mods=load('src/lib/catalogModifierGroups.ts',{'@/lib/catalogAddonPolicy':addonPolicy});
const products=load('src/data/products.ts').products;
const addons=load('src/data/addons.ts').ADDONS;
const catalog=load('src/lib/catalog.ts',{'@/data/products':{products},'@/data/addons':{ADDONS:addons},'@/lib/catalogModifierGroups':mods,'@/lib/catalogRemovableIngredients':rem});
const lab=load('src/lib/comboUnitCatalogDraft.ts',{'@/lib/catalog':catalog,'@/lib/catalogModifierGroups':mods,'./comboUnitPlan':plan});
const ops=load('src/lib/comboUnitOperationalDraft.ts',{'./comboUnitPlan':plan,'./comboUnitCommercial':com,'./comboUnitCartDraft':cart});
const receiver=load('src/lib/comboUnitReceiverDraft.ts',{'./comboUnitOperationalDraft':ops});
const bridge=load('src/lib/comboUnitBatchHandoffDraft.ts',{'./comboUnitBatchDraft':batch,'./comboUnitCartDraft':cart,'./comboUnitOperationalDraft':ops,'./comboUnitReceiverDraft':receiver});
const thermal=load('src/lib/comboUnitBatchThermalLab.ts');
const engine=load('src/lib/comboUnitServerQuote.ts',{'./comboUnitCatalogDraft':lab,'./comboUnitBatchDraft':batch,'./comboUnitBatchHandoffDraft':bridge,'./comboUnitBatchThermalLab':thermal});
const candidateModule=load('src/lib/comboUnitOrderV3Candidate.ts');
for(const key of ['COMBO_V3_PUBLIC_CHECKOUT_ENABLED','COMBO_V3_ORDERS_ENABLED','COMBO_V3_ENTREGAS_ACCEPTANCE_ENABLED','COMBO_V3_LIVE_PRINT_ENABLED'])eq(candidateModule[key],false,key+' off');
eq(candidateModule.COMBO_V3_SCHEMA,3,'candidate schema v3');
eq(candidateModule.COMBO_V3_CONTRACT,'dfl_site_combo_order_v3_candidate','draft contract');
const configured=products.map(p=>p.id==='uai'?{...p,removableIngredients:rem.parseCatalogRemovableIngredients([{id:'alface',label:'Alface'}],p.detailsItems,p.category,p.bundleItems)}:p);
const l=lab.prepareComboCatalogLab('combo-7-uai',configured,addons);
let raw=batch.createComboBatchDraft(l.blueprint,2);
const scope=n=>({groupIndex:0,mode:'one',unitKeys:[`1:${n}`]});
raw=batch.changeComboBatchUnits(l.blueprint,raw,1,scope(1),{field:'removal',id:'alface',enabled:true},l.capabilities);
raw=batch.changeComboBatchUnits(l.blueprint,raw,2,scope(3),{field:'addon',id:'bacon',enabled:true},l.capabilities);
raw=batch.noteComboBatchUnit(l.blueprint,raw,2,'1:7','Molho separado');
const quote=engine.evaluateServerComboQuote('combo-7-uai',raw,configured,addons);
const v3=candidateModule.prepareComboOrderV3Candidate(quote);
eq(v3.orderSchemaVersion,3,'v3 only as candidate');
eq(v3.state,'certification_only','blocked state');
eq(v3.orderId,null,'not a live order');
eq(v3.eventId,null,'not an outbox event');
eq(v3.idempotencyKey,null,'not an idempotency authorization');
eq(v3.authorization,{checkout:false,payment:false,persist:false,relay:false,print:false,production:false},'all operations denied');
eq(v3.source,'admin_authenticated_server_quote','quote origin');
eq(v3.productId,'combo-7-uai','origin combo');
eq(v3.comboCount,2,'two physical combos');
eq(v3.unitCount,14,'all units');
eq(v3.customizedUnitCount,3,'removal, extra and note');
eq(v3.item.quantity,2,'two combo quantity');
eq(v3.item.lineKind,'combo_with_independent_units','no flattening');
eq(v3.item.basePricePerComboCents,6999,'base catalog cents');
eq(v3.item.baseForOrderCents,13998,'two base combos');
eq(v3.item.extrasForOrderCents,299,'only selected bacon charged');
eq(v3.item.totalCents,14297,'server total');
eq(v3.item.units.length,14,'14 preserved units');
eq(new Set(v3.item.units.map(x=>x.key)).size,14,'unique unit keys');
eq(v3.item.units[0].key,'c1:1:1','first key');
eq(v3.item.units[13].key,'c2:1:7','last key');
eq(v3.item.units.find(u=>u.key==='c1:1:1').removals.map(r=>r.id),['alface'],'only first removal');
eq(v3.item.units.find(u=>u.key==='c2:1:3').addons.map(a=>a.id),['bacon'],'only other combo addon');
eq(v3.item.units.find(u=>u.key==='c1:1:3').addons.length,0,'no bleed to first combo');
eq(v3.item.units.find(u=>u.key==='c2:1:7').note,'Molho separado','note separate');
eq(v3.item.units.filter(x=>x.componentId==='uai').length,14,'no component lost');
eq(v3.item.units.reduce((s,u)=>s+u.extrasCents,0),299,'cent sum');
eq(v3.receiptPreview.printAuthorized,false,'no physical print');
eq(v3.receiptPreview.widths,[58,80],'thermal widths');
ok(v3.receiptPreview.preview58.every(x=>Array.from(x).length<=30),'58mm bounded');
ok(v3.receiptPreview.preview80.every(x=>Array.from(x).length<=42),'80mm bounded');
eq(v3.acceptance.priceRecomputedOnServer,true,'price verified');
eq(v3.acceptance.perUnitIdentityReconciled,true,'individual accounting verified');
eq(v3.acceptance.legacyCheckoutIntact,true,'legacy left in place');
eq(v3.acceptance.receiverV3Supported,false,'receiver still blocks');
eq(v3.acceptance.canonicalOrderPersistenceTested,false,'not persisted');
eq(v3.acceptance.signedRelayWithUnitFieldsTested,false,'v3 relay untested');
eq(v3.acceptance.physicalPrinterTested,false,'v3 hardware untested');
eq(v3.acceptance.liveCheckoutReleased,false,'no public checkout');
eq(v3.acceptance.status,'blocked','final release blocked');
eq(v3.acceptance.blockers.length,5,'five blockers explicit');
eq(candidateModule.prepareComboOrderV3Candidate(quote),v3,'deterministic');
const clone=x=>JSON.parse(JSON.stringify(x));
const attack=(fn,re,name)=>{const x=clone(quote);fn(x);no(()=>candidateModule.prepareComboOrderV3Candidate(x),re,name);};
for(const [name,fn,re] of [
 ['payable true',x=>x.quoteIsPayable=true,/QUOTE_NOT_READ_ONLY/],
 ['checkout true',x=>x.authorization.checkout=true,/QUOTE_NOT_READ_ONLY/],
 ['missing authorization',x=>{delete x.authorization.relay;x.authorization.ghost=false},/QUOTE_NOT_READ_ONLY/],
 ['new schema',x=>x.schema=3,/QUOTE_NOT_READ_ONLY/],
 ['modified source',x=>x.source='client',/QUOTE_NOT_READ_ONLY/],
 ['duplicate key',x=>x.rows[8].key=x.rows[0].key,/UNIT_KEY_INVALID/],
 ['missing unit',x=>x.rows.pop(),/STRUCTURE_INVALID/],
 ['phantom unit',x=>x.rows.push(x.rows[0]),/STRUCTURE_INVALID/],
 ['cross combo identity',x=>x.rows[7].comboNumber=1,/UNIT_IDENTITY_INVALID/],
 ['base injected',x=>x.basePricePerComboCents=100,/TOTAL_INVALID/],
 ['total tampered',x=>x.totalCents+=1,/TOTAL_INVALID/],
 ['extras tampered',x=>x.extrasForOrderCents+=1,/TOTAL_INVALID/],
 ['fractional extra',x=>x.rows[9].addons[0].priceCents=0.1,/ADDON_INVALID/],
 ['unit price tampered',x=>x.rows[9].extrasCents+=2,/UNIT_PRICE_MISMATCH/],
 ['unknown combo',x=>x.combos[0].number=2,/COMBO_PRICE_INVALID/],
 ['combo price tampered',x=>x.combos[1].totalCents+=1,/COMBO_RECONCILIATION_FAILED/],
 ['unsafe note',x=>x.rows[13].note='Hello\nInjected',/UNIT_FIELDS_INVALID/],
 ['duplicate addon',x=>x.rows[9].addons.push(x.rows[9].addons[0]),/ADDON_INVALID/],
 ['ambiguous group',x=>x.rows[2].groupQuantity=5,/GROUP_IDENTITY_INVALID/],
 ['changed customization counter',x=>x.customizedUnitCount=0,/UNIT_TOTAL_RECONCILIATION_FAILED/],
 ['missing print warning',x=>x.kitchenPreview58=['imprimir'],/RECEIPT_PREVIEW_INVALID/],
 ['oversized thermal width',x=>x.kitchenPreview80=['A'.repeat(50)],/RECEIPT_PREVIEW_INVALID/],
 ['foreign product',x=>x.productId='bad/path',/IDENTITY_INVALID/],
 ['unknown blueprint',x=>x.blueprintFingerprint='stale',/IDENTITY_INVALID/],
 ['missing addon label',x=>x.rows[9].addons[0].label='',/ADDON_INVALID/],
 ['noninteger count',x=>x.comboCount=2.5,/QUANTITY_INVALID/],
 ['empty component',x=>x.rows[0].componentId='',/UNIT_IDENTITY_INVALID/],
])attack(fn,re,name);
for(const key of ['checkout','payment','persist','relay','print','production'])eq(v3.authorization[key],false,key+' explicitly denied');
const routeSrc=read('src/app/api/admin/combo-unit-quote/route.ts');
const panelSrc=read('src/components/admin/ComboUnitServerQuotePanel.tsx');
const uiSrc=read('src/components/admin/ComboUnitV3AcceptancePanel.tsx');
const core=read('src/lib/comboUnitOrderV3Candidate.ts');
const live=read('src/app/api/orders/route.ts');
const flow=read('.github/workflows/site-sales-protection.yml');
const event=read('src/lib/integration/orderEvents.ts');
const checkout=read('src/components/ui/CheckoutModal.tsx');
ok(routeSrc.includes('const releaseGate=prepareComboOrderV3Candidate(quote)'),'releaseGate computed after server quote');
ok(routeSrc.indexOf('verifyIdToken')<routeSrc.indexOf('prepareComboOrderV3Candidate(quote)'),'auth before candidate');
ok(routeSrc.includes('NextResponse.json({ok:true,quote,releaseGate},{headers})'),'no paid payload');
ok(!routeSrc.includes('buildOutboxRecord')&&!routeSrc.includes('runTransaction('),'admin quote endpoint cannot write');
ok(panelSrc.includes('ComboUnitV3AcceptancePanel'),'premium Admin renders status');
ok(panelSrc.includes('setReleaseGate(null)'),'avoid stale release state');
ok(panelSrc.includes("gate.acceptance.status!=='blocked'"),'browser refuses forged green status');
ok(uiSrc.includes('AGUARDANDO HOMOLOGAÇÃO'),'honest premium UI');
ok(uiSrc.includes('checkout não')||uiSrc.includes('Checkout')||uiSrc.includes('API de pedidos'),'show blockers');
ok(!/\b(?:fetch|runTransaction|setDoc|window\.print)\s*\(/.test(core),'pure domain functions with no IO');
ok(live.includes('raw.comboUnitCartDraft !== undefined')&&live.includes('CART_INVALID'),'live checkout blocks unit customization');
ok(!live.includes('comboUnitOrderV3Candidate'),'live writer never imports candidate');
ok(!event.includes('comboUnitOrderV3Candidate'),'outbox never imports candidate');
ok(!checkout.includes('ComboUnitV3AcceptancePanel'),'public checkout never mounts admin result');
ok(flow.includes('node scripts/test-site-r249-v3-gate.cjs'),'R249 regression included in CI');
ok(flow.includes('node scripts/test-site-r248-server-quote.cjs'),'R248 test preserved');
const ent=path.resolve(process.cwd(),'../dfl-entregas');
const guardPath=path.join(ent,'lib/integration/site-combo-unit-guard.ts');
if(fs.existsSync(guardPath)){
 const src=fs.readFileSync(guardPath,'utf8');
 ok(src.includes('SITE_COMBO_UNIT_PRODUCTION_SUPPORTED = false'),'real Entregas explicitly not ready');
 ok(src.includes('SITE_LEGACY_ORDER_SCHEMA_MAX = 2'),'real Entregas max v2');
 const g=load(guardPath);eq(g.legacySiteOrderCanPreserveContent({orderSchemaVersion:3,itens:[{unitLines:v3.item.units}]}),false,'v3 rejected by installed Entregas');
 console.log('R249 Entregas: verified installed sibling source, still rejects V3.');
}else{
 const fixture=read('scripts/fixtures/r242-entregas-consumer.ts');
 ok(fixture.includes('preview_only')||fixture.includes('SITE_COMBO')||fixture.includes('schema'),'CI has R242 consumer reference fixture');
 console.log('R249 Entregas: only bundled reference in CI; live sibling check runs in Termux.');
}
console.log(`R249: ${count} isolated checks PASS; order V3 is blocked, no payment, Firestore or relay.`);
