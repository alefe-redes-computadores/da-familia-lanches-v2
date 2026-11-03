'use strict';
/** R248: both real combo engines and administrative dry-run endpoint; never writes. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const read=file=>fs.readFileSync(file,'utf8');
let checks=0;
function eq(a,b,description){assert.deepStrictEqual(a,b,'R248 '+description);checks++}
function ok(value,description){assert.ok(value,'R248 '+description);checks++}
function no(fn,match,description){assert.throws(fn,match,'R248 '+description);checks++}
function load(file,imports={}){
 const source=read(file);const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(parsed.parseDiagnostics.length===0,'syntax '+file);
 const built=ts.transpileModule(source,{fileName:file,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 ok(!(built.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error),'transpile '+file);
 const module={exports:{}};new Function('require','module','exports',built.outputText)(key=>{
  if(!Object.prototype.hasOwnProperty.call(imports,key))throw Error('R248 forbidden import '+file+' -> '+key);
  return imports[key];
 },module,module.exports);
 return module.exports;
}
const removal=load('src/lib/catalogRemovableIngredients.ts');
const plan=load('src/lib/comboUnitPlan.ts');
const commerce=load('src/lib/comboUnitCommercial.ts',{'./comboUnitPlan':plan});
const cart=load('src/lib/comboUnitCartDraft.ts',{'./comboUnitPlan':plan,'./comboUnitCommercial':commerce});
const unitEditor=load('src/lib/comboUnitEditorDraft.ts',{'./comboUnitPlan':plan,'./comboUnitCartDraft':cart});
const batch=load('src/lib/comboUnitBatchDraft.ts',{'./comboUnitPlan':plan,'./comboUnitCommercial':commerce,'./comboUnitEditorDraft':unitEditor});
const ap=load('src/lib/catalogAddonPolicy.ts');
const mod=load('src/lib/catalogModifierGroups.ts',{'@/lib/catalogAddonPolicy':ap});
const fixtureProducts=load('src/data/products.ts').products;
const fixtureAddons=load('src/data/addons.ts').ADDONS;
const catalog=load('src/lib/catalog.ts',{
  '@/data/products':{products:fixtureProducts},
  '@/data/addons':{ADDONS:fixtureAddons},
  '@/lib/catalogModifierGroups':mod,
  '@/lib/catalogRemovableIngredients':removal,
});
const lab=load('src/lib/comboUnitCatalogDraft.ts',{'@/lib/catalog':catalog,'@/lib/catalogModifierGroups':mod,'./comboUnitPlan':plan});
const operational=load('src/lib/comboUnitOperationalDraft.ts',{'./comboUnitPlan':plan,'./comboUnitCommercial':commerce,'./comboUnitCartDraft':cart});
const receiver=load('src/lib/comboUnitReceiverDraft.ts',{'./comboUnitOperationalDraft':operational});
const bridge=load('src/lib/comboUnitBatchHandoffDraft.ts',{'./comboUnitBatchDraft':batch,'./comboUnitCartDraft':cart,'./comboUnitOperationalDraft':operational,'./comboUnitReceiverDraft':receiver});
const thermal=load('src/lib/comboUnitBatchThermalLab.ts');
const quoteEngine=load('src/lib/comboUnitServerQuote.ts',{'./comboUnitCatalogDraft':lab,'./comboUnitBatchDraft':batch,'./comboUnitBatchHandoffDraft':bridge,'./comboUnitBatchThermalLab':thermal});
const candidate=load('src/lib/comboUnitOrderV3Candidate.ts');
const products=fixtureProducts,addons=fixtureAddons;
eq(quoteEngine.COMBO_SERVER_QUOTE_CHECKOUT_ENABLED,false,'checkout flag always off');
eq(quoteEngine.COMBO_SERVER_QUOTE_VERSION,1,'version fixed');
const uai=products.find(p=>p.id==='uai');ok(uai,'Uai exists in real packaged catalog');
const configured=products.map(p=>p.id==='uai'?{...p,removableIngredients:removal.parseCatalogRemovableIngredients([{id:'alface',label:'Alface'}],p.detailsItems,p.category,p.bundleItems)}:p);
const currentLab=lab.prepareComboCatalogLab('combo-7-uai',configured,addons);
let draft=batch.createComboBatchDraft(currentLab.blueprint,2);
const one=n=>({groupIndex:0,mode:'one',unitKeys:[`1:${n}`]});
draft=batch.changeComboBatchUnits(currentLab.blueprint,draft,1,one(1),{field:'removal',id:'alface',enabled:true},currentLab.capabilities);
draft=batch.changeComboBatchUnits(currentLab.blueprint,draft,2,one(3),{field:'addon',id:'bacon',enabled:true},currentLab.capabilities);
draft=batch.noteComboBatchUnit(currentLab.blueprint,draft,2,'1:7','Molho separado');
const original=JSON.stringify(draft),sourceProducts=JSON.stringify(configured),sourceAddons=JSON.stringify(addons);
const result=quoteEngine.evaluateServerComboQuote('combo-7-uai',draft,configured,addons);
eq(result.status,'review_only','review-only quote');
eq(result.schema,1,'schema 1');
eq(result.source,'server_catalog_snapshot','source declares server snapshot');
eq(result.authorization,{checkout:false,payment:false,order:false,print:false,relay:false,production:false},'all commercial permissions blocked');
eq(result.quoteIsPayable,false,'never payable');
eq(result.productId,'combo-7-uai','requested product matches');
eq(result.blueprintFingerprint,currentLab.blueprint.fingerprint,'fingerprint matches trusted catalog');
eq(result.comboCount,2,'two separate combos');
eq(result.unitCount,14,'14 distinct lanches');
eq(result.customizedUnitCount,3,'distinct changed units');
eq(result.basePricePerComboCents,6999,'base price from catalog, cents');
eq(result.extrasForOrderCents,299,'only combo 2 addon charged');
eq(result.totalCents,14297,'full total from server input');
eq(result.combos.length,2,'two individual commercial totals');
eq(result.combos[0].totalCents,6999,'first combo unchanged');
eq(result.combos[1].totalCents,7298,'second combo addon charged');
eq(result.combos[0].extrasCents,0,'no extras in first combo');
eq(result.combos[1].extrasCents,299,'only second combo charged');
eq(result.rows.length,14,'row count matches physical units');
eq(new Set(result.rows.map(r=>r.key)).size,14,'no collisions');
eq(result.rows[0].key,'c1:1:1','first individual key');
eq(result.rows[13].key,'c2:1:7','last individual key');
eq(result.rows.find(r=>r.key==='c1:1:1').removals[0].id,'alface','first combo removal preserved');
eq(result.rows.find(r=>r.key==='c2:1:3').addons[0].label,'Bacon','second combo addon preserved');
eq(result.rows.find(r=>r.key==='c1:1:3').addons.length,0,'no bleed across combos');
eq(result.rows.find(r=>r.key==='c2:1:7').note,'Molho separado','note scoped to second combo');
eq(result.rows.reduce((n,r)=>n+r.extrasCents,0),299,'all row extras reconcile');
eq(JSON.stringify(draft),original,'untrusted batch not mutated');
eq(JSON.stringify(configured),sourceProducts,'trusted products not mutated');
eq(JSON.stringify(addons),sourceAddons,'trusted addons not mutated');
eq(quoteEngine.evaluateServerComboQuote('combo-7-uai',draft,configured,addons),result,'pure deterministic result');
for(const [key,width] of [['kitchenPreview58',30],['kitchenPreview80',42]]){
 ok(result[key].length>24,key+' has enough kitchen information');
 ok(result[key].every(line=>Array.from(line).length<=width),key+' width constrained');
 ok(result[key].some(line=>line.includes('NAO IMPRIMIR')),key+' explicitly cannot print');
 ok(result[key].some(line=>line.includes('Bacon')),key+' bacon preserved');
 ok(result[key].some(line=>line.includes('Alface')),key+' removal preserved');
 ok(result[key].some(line=>line.includes('Molho separado')),key+' note preserved');
 ok(result[key].some(line=>line.includes('COMBO 1/2')),key+' first combo header');
 ok(result[key].some(line=>line.includes('COMBO 2/2')),key+' second combo header');
}
const changedCombo=configured.map(p=>p.id==='combo-7-uai'?{...p,price:79.99}:p);
const newPrice=quoteEngine.evaluateServerComboQuote('combo-7-uai',draft,changedCombo,addons);
eq(newPrice.totalCents,16297,'server price change replaces stale browser total');
eq(newPrice.basePricePerComboCents,7999,'updated catalog base, not client price');
const changedAddons=addons.map(a=>a.id==='bacon'?{...a,price:4.99}:a);
eq(quoteEngine.evaluateServerComboQuote('combo-7-uai',draft,configured,changedAddons).totalCents,14497,'server addon price replaces stale browser addon');
const familyLab=lab.prepareComboCatalogLab('combo-familia-uai',configured,addons);
let family=batch.createComboBatchDraft(familyLab.blueprint,2);
family=batch.changeComboBatchUnits(familyLab.blueprint,family,2,one(2),{field:'addon',id:'bacon',enabled:true},familyLab.capabilities);
const familyQuote=quoteEngine.evaluateServerComboQuote('combo-familia-uai',family,configured,addons);
eq(familyQuote.comboCount,2,'family combo repeats independently');
eq(familyQuote.unitCount,12,'family 5 Uai + drink x 2');
eq(familyQuote.totalCents,12297,'two family combos + second bacon');
eq(familyQuote.rows.filter(r=>r.componentId==='kuat-2l').length,2,'both bottles preserved');
ok(familyQuote.rows.filter(r=>r.componentId==='kuat-2l').every(r=>r.addons.length===0),'no bacon on soda');
const forbiddenPlan={...draft,plans:draft.plans.map((p,i)=>i===0?{...p,blueprintFingerprint:'stale'}:p)};
no(()=>quoteEngine.evaluateServerComboQuote('combo-7-uai',forbiddenPlan,configured,addons),/STALE/, 'stale blueprint blocked');
no(()=>quoteEngine.evaluateServerComboQuote('combo-7-uai',{...draft,payable:true},configured,addons),/DRAFT_STALE_OR_UNSAFE/,'payable flag cannot authorize quote');
no(()=>quoteEngine.evaluateServerComboQuote('combo-7-uai',{...draft,status:'order'},configured,addons),/DRAFT_STALE_OR_UNSAFE/,'order status rejected');
no(()=>quoteEngine.evaluateServerComboQuote('combo-7-uai',{...draft,plans:[...draft.plans,...Array(30).fill(draft.plans[0])]},configured,addons),/PLANS_INVALID/,'quantity >30 blocked');
no(()=>quoteEngine.evaluateServerComboQuote('combo-familia-uai',draft,configured,addons),/DRAFT_STALE_OR_UNSAFE/,'foreign combo blocked');
no(()=>quoteEngine.evaluateServerComboQuote('combo-7-uai',draft,configured.filter(p=>p.id!=='uai'),addons),/COMPONENT_UNAVAILABLE/,'missing server component blocked');
no(()=>quoteEngine.evaluateServerComboQuote('combo-7-uai',draft,configured.map(p=>p.id==='uai'?{...p,disponivel:false}:p),addons),/COMPONENT_UNAVAILABLE/,'paused component blocked');
no(()=>quoteEngine.evaluateServerComboQuote('combo-7-uai',draft,configured,addons.map(a=>a.id==='bacon'?{...a,disponivel:false}:a)),/UNIT_ADDON_NOT_ALLOWED/,'paused addon blocked');
no(()=>quoteEngine.evaluateServerComboQuote('combo-7-uai',draft,configured,addons.filter(a=>a.id!=='bacon')),/UNIT_ADDON_NOT_ALLOWED/,'missing addon blocked');
no(()=>quoteEngine.evaluateServerComboQuote('combo-7-uai',draft,configured.map(p=>p.id==='uai'?{...p,removableIngredients:[]}:p),addons),/UNIT_REMOVAL_NOT_ALLOWED/,'revoked removal blocked');
no(()=>quoteEngine.evaluateServerComboQuote('bad/path',draft,configured,addons),/COMBO_ID_INVALID/,'invalid doc path rejected');
no(()=>quoteEngine.evaluateServerComboQuote('combo-7-uai',draft,configured,addons.map(a=>a.id==='bacon'?{...a,price:2.345}:a)),/ADDON_PRICE_INVALID/,'fractional cents blocked');
no(()=>quoteEngine.evaluateServerComboQuote('combo-7-uai',draft,configured.map(p=>p.id==='combo-7-uai'?{...p,price:Infinity}:p),addons),/COMBO_PRICE_INVALID/,'infinite price blocked');
const source=read('src/lib/comboUnitServerQuote.ts');
for(const [value,name] of [
 [!/(?:fetch\(|runTransaction\(|\.set\(|\.update\(|\.delete\(|window\.print\(|localStorage\.)/.test(source),'server quote engine has no I/O'],
 [source.includes('prepareComboCatalogLab')&&source.includes('parseComboBatchDraft'),'policy and batch revalidated'],
 [source.includes('prepareComboBatchHandoffPreview'),'per-unit receiver projection used'],
 [source.includes("buildComboBatchThermalLab(preview,'58')"),'58mm from same packet'],
 [source.includes("buildComboBatchThermalLab(preview,'80')"),'80mm from same packet'],
 [source.includes('UNIT_COUNT_INVALID'),'full unit count verified'],
 [source.includes('DUPLICATE_UNIT'),'duplicate unit check'],
 [source.includes('EXTRAS_RECONCILIATION_FAILED'),'sum of extras verified'],
 [source.includes('quoteIsPayable:false'),'quote never payable'],
 [source.includes('checkout:false,payment:false,order:false,print:false,relay:false,production:false'),'all write gates false'],
])ok(value,name);
for(const file of ['src/app/api/admin/combo-unit-quote/route.ts','src/components/admin/ComboUnitServerQuotePanel.tsx','src/components/ui/ComboUnitBatchConfiguratorDraft.tsx']){
 const code=read(file);const parsed=ts.createSourceFile(file,code,ts.ScriptTarget.ESNext,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(!parsed.parseDiagnostics.length,'parse '+file);
 const output=ts.transpileModule(code,{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 ok(!output.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),'transpile '+file);
}
const route=read('src/app/api/admin/combo-unit-quote/route.ts'),ui=read('src/components/admin/ComboUnitServerQuotePanel.tsx'),editor=read('src/components/ui/ComboUnitBatchConfiguratorDraft.tsx'),css=read('src/components/admin/ComboUnitServerQuotePanel.module.css');
for(const [v,name] of [
 [route.indexOf('verifyIdToken')<route.indexOf("collection('CatalogoProdutos')"),'authentication precedes DB'],
 [route.includes('isAdminEmail(verified.email)'),'admin allowlist enforced'],
 [route.includes("Object.keys(body).sort().join(',')!=='batch,comboId,schema'"),'no supplied price payload permitted'],
 [route.includes("doc(comboId).get()"),'server reads real combo'],
 [route.includes(".doc(id).get()"),'server reads components'],
 [route.includes("collection('CatalogoAdicionais').limit(250).get()"),'server reads current addon catalog'],
 [route.includes('normalizeRemoteProductRecord')&&route.includes('normalizeRemoteAddonRecord'),'server uses existing catalog normalizers'],
 [route.includes('evaluateServerComboQuote(comboId,body.batch,products,[...byAddonId.values()])'),'caller cannot supply source prices'],
 [route.includes("'Cache-Control':'private, no-store, max-age=0'"),'server response no-store'],
 [!route.includes('runTransaction(')&&!route.includes('.doc('+'x'+').set(')&&!route.includes('tx.create(')&&!route.includes('.update('),'server endpoint no writes'],
 [!route.includes('order.created')&&!route.includes('buildOutboxRecord'),'server endpoint no event'],
 [ui.includes('auth.currentUser?.getIdToken()'),'frontend authenticated request'],
 [ui.includes('Conferir com o servidor'),'manual button visible'],
 [ui.includes('controller.signal.aborted'),'abort races protected'],
 [ui.includes('Cache')===false,'UI no custom stale cache'],
 [ui.includes("cache:'no-store'"),'frontend no-store'],
 [ui.includes('next.authorization.order!==false'),'client rejects payability response'],
 [ui.includes('Diferença em relação à prévia local'),'price drift highlighted'],
 [ui.includes('aria-pressed={paper===\'58\'}')&&ui.includes('aria-pressed={paper===\'80\'}'),'58/80 controls accessible'],
 [ui.includes('Conferência de montagem'),'kitchen preview shown'],
 [editor.includes('key={serverQuoteRevision}'),'old quote cleared on editor change'],
 [editor.includes('setServerQuoteRevision(v=>v+1)'),'quote invalidated when batch changes'],
 [editor.includes('ComboUnitServerQuotePanel'),'integrated inside lab not public checkout'],
 [editor.includes('Adicionar ao carrinho — não liberado'),'checkout remains blocked'],
 [css.includes('linear-gradient')&&css.includes('env(')===false,'premium styling supplied without overlay collisions'],
 [css.includes('prefers-reduced-motion:reduce'),'reduced motion respected'],
 [read('.github/workflows/site-sales-protection.yml').includes('node scripts/test-site-r248-server-quote.cjs'),'CI test registered'],
 [read('src/app/api/orders/route.ts').includes('raw.comboUnitCartDraft !== undefined'),'production order API still blocks unit draft'],
 [!read('src/components/ui/CheckoutModal.tsx').includes('ComboUnitServerQuotePanel'),'public checkout never mounts admin quote'],
 [!read('src/lib/thermalReceipt.ts').includes('ComboUnitServerQuotePanel'),'live printer independent'],
])ok(v,name);
// Exercise the route with a fake *read-only* Firestore, covering authentication and tampering.
let reads=0, verifyCalls=0, allow=true, credentialsOk=true;
const remoteProducts=new Map(), remoteAddons=new Map();
const fakeDb={collection:(name)=>({
 doc:(id)=>({get:async()=>{reads++;const v=remoteProducts.get(id);return {exists:v!==undefined,data:()=>v};}}),
 limit:(number)=>({get:async()=>{eq(number,250,'bound on addon catalog query');reads++;return {size:remoteAddons.size,docs:[...remoteAddons].map(([id,data])=>({id,data:()=>data}))};}}),
})};
const nextResponse={json:(body,init={})=>({body,status:init.status||200,headers:init.headers||{}})};
const fakeAuth={verifyIdToken:async()=>{verifyCalls++;if(!credentialsOk)throw Error('BAD_AUTH');return {email:allow?'admin@example.com':'intruder@example.com'};}};
const fakeRequest=(body,token='Bearer good')=>({headers:{get:name=>name==='authorization'?token:null},text:async()=>typeof body==='string'?body:JSON.stringify(body)});
const routeModule=load('src/app/api/admin/combo-unit-quote/route.ts',{
 'next/server':{NextResponse:nextResponse},'@/lib/integration/server/adminAuth':{adminAuth:fakeAuth},
 '@/lib/integration/server/admin':{adminDb:fakeDb},'@/lib/adminAuthorization':{isAdminEmail:email=>email==='admin@example.com'},
 '@/data/products':{products},'@/data/addons':{ADDONS:addons},
 '@/lib/catalog':{...catalog,normalizeRemoteAddonRecord:(id,raw)=>({id,name:raw.name,price:raw.price,disponivel:raw.disponivel!==false})},'@/lib/comboUnitServerQuote':quoteEngine,
 '@/lib/comboUnitOrderV3Candidate':candidate,
});
(async()=>{
 const firstReads=reads;
 const unauth=await routeModule.POST(fakeRequest({schema:1,comboId:'combo-7-uai',batch:draft},''));
 eq(unauth.status,401,'unauthenticated rejected');eq(reads,firstReads,'no DB for missing token');
 allow=false;
 const forbidden=await routeModule.POST(fakeRequest({schema:1,comboId:'combo-7-uai',batch:draft}));
 eq(forbidden.status,403,'nonadmin rejected');eq(reads,firstReads,'no DB for nonadmin');
 allow=true;
 const injected=await routeModule.POST(fakeRequest({schema:1,comboId:'combo-7-uai',batch:draft,price:0}));
 eq(injected.status,400,'client price key rejected');eq(reads,firstReads,'no DB for unknown request key');
 const path=await routeModule.POST(fakeRequest({schema:1,comboId:'../bad',batch:draft}));
 eq(path.status,400,'invalid path rejected');eq(reads,firstReads,'no DB for invalid ID');
 const invalidJson=await routeModule.POST(fakeRequest('{!'));
 eq(invalidJson.status,400,'bad JSON rejected');eq(reads,firstReads,'no DB for malformed JSON');
 const tooLarge=await routeModule.POST(fakeRequest('a'.repeat(200001)));
 eq(tooLarge.status,413,'oversized request blocked');eq(reads,firstReads,'no DB for huge request');
 const okRes=await routeModule.POST(fakeRequest({schema:1,comboId:'combo-7-uai',batch:draft}));
 eq(okRes.status,409,'unknown removal in fallback is rejected safely');
 eq(okRes.body.error,'CATALOG_OR_COMBO_CHANGED','safe error, no stack');
 eq(okRes.headers['Cache-Control'],'private, no-store, max-age=0','even failure not cached');
 remoteProducts.set('uai',{...uai,removableIngredients:configured.find(p=>p.id==='uai').removableIngredients});
 const accepted=await routeModule.POST(fakeRequest({schema:1,comboId:'combo-7-uai',batch:draft}));
 eq(accepted.status,200,'admin read-only quote works with current server rules');
 eq(accepted.body.quote.totalCents,14297,'API authoritative total computed');
 eq(accepted.body.quote.authorization.order,false,'API explicitly disallows order');
 eq(accepted.body.quote.rows.length,14,'API has independent units');
 eq(accepted.body.quote.kitchenPreview58.some(x=>x.includes('NAO IMPRIMIR')),true,'API print preview inert');
 remoteProducts.set('combo-7-uai',{...products.find(p=>p.id==='combo-7-uai'),price:79.99});
 const changed=await routeModule.POST(fakeRequest({schema:1,comboId:'combo-7-uai',batch:draft}));
 eq(changed.body.quote.totalCents,16297,'API responds to authoritative product change');
 remoteAddons.set('bacon',{...addons.find(a=>a.id==='bacon'),price:4.99});
 const addonChanged=await routeModule.POST(fakeRequest({schema:1,comboId:'combo-7-uai',batch:draft}));
 eq(addonChanged.body.quote.totalCents,16497,'API responds to authoritative addon change');
 const wrong=await routeModule.POST(fakeRequest({schema:1,comboId:'combo-7-uai',batch:forbiddenPlan}));
 eq(wrong.status,409,'API rejects stale client plan');
 credentialsOk=false;
 const badAuth=await routeModule.POST(fakeRequest({schema:1,comboId:'combo-7-uai',batch:draft}));
 eq(badAuth.status,503,'failed token verification never reaches quote');
 ok(reads>=10,'real data reads exercised');ok(verifyCalls>=10,'admin authorization exercised');
 console.log(`R248: ${checks} verificações aprovadas; pedido, impressão, relay e escrita ausentes.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
