'use strict';
/** R247: Admin-only visible combo lab + premium accessibility, 58/80 previews, legacy boundaries. */
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
let checks=0;
const ok=(v,m)=>{assert.ok(v,`R247 ${m}`);checks++;};
const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,`R247 ${m}`);checks++;};
const bad=(fn,re,m)=>{assert.throws(fn,re,`R247 ${m}`);checks++;};
function load(p,imports={}) {
 const source=read(p),parsed=ts.createSourceFile(p,source,ts.ScriptTarget.ESNext,true,p.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(parsed.parseDiagnostics.length===0,'syntax '+p);
 const compiled=ts.transpileModule(source,{fileName:p,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});
 ok(!(compiled.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error),'transpile '+p);
 const mod={exports:{}};new Function('require','module','exports',compiled.outputText)(key=>{
  if(!Object.prototype.hasOwnProperty.call(imports,key))throw Error('R247 unexpected runtime require '+p+' -> '+key);
  return imports[key];
 },mod,mod.exports);
 return mod.exports;
}
const jsxFiles=['src/components/admin/ComboUnitPremiumLabAdmin.tsx','src/components/ui/ComboUnitBatchConfiguratorDraft.tsx','src/components/ui/ComboUnitBatchAuditDraft.tsx'];
for(const p of jsxFiles){const source=read(p),parsed=ts.createSourceFile(p,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 ok(!parsed.parseDiagnostics.length,'JSX TS parser '+p);
 const out=ts.transpileModule(source,{fileName:p,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
 ok(!(out.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error),'JSX transpile '+p);
}
const admin=read('src/components/admin/CatalogAdmin.tsx');
const overlay=read('src/components/admin/ComboUnitPremiumLabAdmin.tsx');
const editor=read('src/components/ui/ComboUnitBatchConfiguratorDraft.tsx');
const audit=read('src/components/ui/ComboUnitBatchAuditDraft.tsx');
const mainCss=read('src/components/admin/ComboUnitPremiumLabAdmin.module.css');
const editorCss=read('src/components/ui/ComboUnitBatchConfiguratorDraft.module.css');
const auditCss=read('src/components/ui/ComboUnitBatchAuditDraft.module.css');
const critical=read('.github/workflows/site-sales-protection.yml');
const appShell=read('src/components/layout/AppShell.tsx');
const checkout=read('src/components/ui/CheckoutModal.tsx');
const cartModal=read('src/components/ui/CartModal.tsx');
const orderApi=read('src/app/api/orders/route.ts');
const receipt=read('src/lib/thermalReceipt.ts');
const relay=read('src/lib/integration/orderEvents.ts');
// The feature becomes observable only inside an already-authenticated administrative workflow.
for(const [condition,name] of [
 [admin.includes('import { ComboUnitPremiumLabAdmin }'), 'admin imports premium isolated dialog'],
 [admin.includes('const [comboLabId, setComboLabId] = useState<string | null>(null);'), 'admin local state only'],
 [admin.includes('productMode === "edit" && productDraft.bundleItems.length > 0'), 'only existing saved combo editor shows launch'],
 [admin.includes('setComboLabId(productDraft.id)'), 'launch selects real catalog product'],
 [admin.includes('data-dfl-combo-preview="admin-only"'), 'visual lab marked admin-only'],
 [admin.includes('comboId={comboLabId} products={products} addons={addons}'), 'catalog source is existing hook'],
 [admin.includes('onClose={() => setComboLabId(null)}'), 'modal can close without mutations'],
 [!appShell.includes('ComboUnitPremiumLabAdmin'), 'public shell cannot mount lab'],
 [!checkout.includes('ComboUnitPremiumLabAdmin'), 'checkout does not mount lab'],
 [!cartModal.includes('ComboUnitPremiumLabAdmin'), 'cart does not mount lab'],
 [!orderApi.includes('ComboUnitPremiumLabAdmin'), 'orders API does not see lab'],
 [!receipt.includes('ComboUnitPremiumLabAdmin'), 'real receipt does not see lab'],
 [!relay.includes('ComboUnitPremiumLabAdmin'), 'relay does not see lab'],
 [overlay.includes('data-dfl-combo-lab="admin-only"'), 'root explicitly admin-only'],
 [overlay.includes('role="dialog" aria-modal="true"'), 'accessible dialog'],
 [overlay.includes('aria-labelledby="dfl-r247-title"'), 'dialog title linked'],
 [overlay.includes('event.key === "Escape"'), 'Escape closes overlay'],
 [overlay.includes('event.key !== "Tab"'), 'keyboard focus containment'],
 [overlay.includes('previous?.focus()'), 'restores focus on close'],
 [overlay.includes('closeRef.current?.focus()'), 'initial close focus'],
 [overlay.includes('onClose();'), 'close handler connected'],
 [overlay.includes('onMouseDown={event =>'), 'background tap closes'],
 [overlay.includes('ComboUnitBatchConfiguratorDraft'), 'real R244 engine mounted, no duplicate simulator'],
 [overlay.includes('initialQuantity={2}'), 'two combos ready for demonstration'],
 [overlay.includes('products={products} addons={addons}'), 'no invented catalog'],
 [overlay.includes('Preço cadastrado'), 'catalog base visible'],
 [overlay.includes('não autorização'), 'price explicitly non-authoritative'],
 [overlay.includes('não utilizar os preços para cobrar clientes'), 'non-payment warning'],
 [!/(fetch\(|setDoc\(|addDoc\(|runTransaction\(|window\.print\(|localStorage\.)/.test(overlay), 'admin dialog performs no writes, requests or prints'],
 [editor.includes('buildComboBatchThermalLab(audit,paper)'), 'thermal R246 engine reused'],
 [editor.includes('useState<ThermalLabSize>("58")'), '58mm default'],
 [editor.includes('setPaper("80")'), '80mm interactive selection'],
 [editor.includes('ticket.lines.join("\\n")'), 'real preview lines visible'],
 [editor.includes('aria-pressed={active}'), 'addon and removal selection accessibility'],
 [editor.includes('data-partial={count>0&&!active}'), 'partial multi-selection visible'],
 [editor.includes('copyComboBatchPlan'), 'independent combo duplicate explicit'],
 [editor.includes('noteComboBatchUnit'), 'individual note retained'],
 [editor.includes('readComboBatchPreview'), 'per-combo real quote preview'],
 [editor.includes('prepareComboBatchHandoffPreview'), 'per-combo receiver audit retained'],
 [editor.includes('Adicionar ao carrinho — não liberado'), 'cart action disabled by design'],
 [editor.includes('<button disabled type="button">'), 'button truly disabled'],
 [audit.includes('Nenhuma alteração operacional foi realizada.'), 'audit message preserves operator boundary'],
 [critical.includes('node scripts/test-site-r247-premium-admin-lab.cjs'), 'R247 joined sales critical gate'],
 [critical.includes('node scripts/test-site-r246-removals-thermal.cjs'), 'R246 regression preserved'],
 [critical.includes('node scripts/test-site-r245-combo-joint.cjs'), 'R245 cross app regression preserved'],
 [critical.includes('node scripts/test-site-sales-critical-r1.cjs'), 'production sales regression preserved'],
 [critical.includes('node scripts/test-site-sales-r6-guard.cjs'), 'production safety regression preserved'],
 [orderApi.includes('tx.create(orderRef, canonicalOrder)'), 'real production transaction remains canonical'],
 [orderApi.includes('raw.comboUnitCartDraft !== undefined'), 'unsupported fields fail closed'],
 [receipt.includes('buildThermalReceiptHtml'), 'real print implementation preserved'],
 [relay.includes('buildDflSiteOrderPayloadV1'), 'legacy relay payload preserved'],
 [mainCss.includes('position:fixed;inset:0;z-index:100000'), 'premium overlay above admin editor'],
 [mainCss.includes('height:100dvh'), 'mobile viewport and keyboard stable'],
 [mainCss.includes('env(safe-area-inset-bottom'), 'Android bottom inset'],
 [mainCss.includes('overscroll-behavior:contain'), 'isolated scroll surface'],
 [mainCss.includes('prefers-reduced-motion:reduce'), 'reduced motion support'],
 [mainCss.includes(':focus-visible'), 'visible keyboard focus'],
 [editorCss.includes('button[data-active="true"]'), 'premium selected option'],
 [editorCss.includes('button[data-partial="true"]'), 'premium partially selected option'],
 [editorCss.includes('.thermalSection'), 'thermal card premium styling'],
 [editorCss.includes('.ticket pre'), 'ticket text print-like layout'],
 [editorCss.includes('prefers-reduced-motion:reduce'), 'editor reduced motion support'],
 [auditCss.includes('.segment'), 'kitchen result premium cards'],
 [auditCss.includes('prefers-reduced-motion:reduce'), 'audit reduced motion support']
])ok(condition,name);
// Real catalog + engines test the same input intended for the admin visual lab.
const removal=load('src/lib/catalogRemovableIngredients.ts');
const engine=load('src/lib/comboUnitPlan.ts');
const commerce=load('src/lib/comboUnitCommercial.ts',{'./comboUnitPlan':engine});
const cart=load('src/lib/comboUnitCartDraft.ts',{'./comboUnitPlan':engine,'./comboUnitCommercial':commerce});
const unitEditor=load('src/lib/comboUnitEditorDraft.ts',{'./comboUnitPlan':engine,'./comboUnitCartDraft':cart});
const batch=load('src/lib/comboUnitBatchDraft.ts',{'./comboUnitPlan':engine,'./comboUnitCommercial':commerce,'./comboUnitEditorDraft':unitEditor});
const ap=load('src/lib/catalogAddonPolicy.ts');
const modifiers=load('src/lib/catalogModifierGroups.ts',{'@/lib/catalogAddonPolicy':ap});
const catalog=load('src/lib/comboUnitCatalogDraft.ts',{
 '@/lib/catalog':{availableAddonsForProduct:(p,arr)=>p.category==='bebidas'?[]:arr.filter(a=>a.disponivel!==false&&(p.addonIds===undefined||p.addonIds.includes(a.id)))},
 '@/lib/catalogModifierGroups':modifiers,'@/lib/catalogRemovableIngredients':removal,'./comboUnitPlan':engine,
});
const operational=load('src/lib/comboUnitOperationalDraft.ts',{'./comboUnitPlan':engine,'./comboUnitCommercial':commerce,'./comboUnitCartDraft':cart});
const receiver=load('src/lib/comboUnitReceiverDraft.ts',{'./comboUnitOperationalDraft':operational});
const bridge=load('src/lib/comboUnitBatchHandoffDraft.ts',{'./comboUnitBatchDraft':batch,'./comboUnitCartDraft':cart,'./comboUnitOperationalDraft':operational,'./comboUnitReceiverDraft':receiver});
const thermal=load('src/lib/comboUnitBatchThermalLab.ts',{'./comboUnitBatchHandoffDraft':bridge});
const products=load('src/data/products.ts').products, addons=load('src/data/addons.ts').ADDONS;
const uai=products.find(p=>p.id==='uai');
ok(uai&&uai.detailsItems?.includes('Bacon'),'canonical Uai base from real catalog');
const configuredProducts=products.map(p=>p.id==='uai'?{...p,removableIngredients:removal.parseCatalogRemovableIngredients([{id:'alface',label:'Alface'}],p.detailsItems,p.category,p.bundleItems)}:p);
const lab=catalog.prepareComboCatalogLab('combo-7-uai',configuredProducts,addons);
eq(lab.payable,false,'catalog from UI remains draft-only');
eq(lab.policy.status,'draft','no server approval inferred');
let b=batch.createComboBatchDraft(lab.blueprint,2);
eq(b.plans.length,2,'two independently customizable combos');
const one=n=>({groupIndex:0,mode:'one',unitKeys:[`1:${n}`]});
b=batch.changeComboBatchUnits(lab.blueprint,b,1,one(2),{field:'removal',id:'alface',enabled:true},lab.capabilities);
b=batch.changeComboBatchUnits(lab.blueprint,b,2,one(3),{field:'addon',id:'bacon',enabled:true},lab.capabilities);
b=batch.noteComboBatchUnit(lab.blueprint,b,2,'1:7','Molho separado');
const preview=batch.readComboBatchPreview(lab.blueprint,b,lab.policy);
eq(preview.unitCount,14,'14 individual units');
eq(preview.customizedUnits,3,'three distinct customized units');
eq(preview.comboCount,2,'two combos in preview');
const packet=bridge.prepareComboBatchHandoffPreview(lab,b);
eq(packet.canSend,false,'relay always blocked');
eq(packet.authorized,{checkout:false,charge:false,print:false,relay:false,production:false},'all authorization disabled');
eq(packet.unitCount,14,'all 14 units in handoff');
eq(packet.units.find(x=>x.batchUnitKey==='c1:1:2').removals[0].label,'Alface','combo 1 unit 2 no lettuce');
eq(packet.units.find(x=>x.batchUnitKey==='c2:1:3').addons[0].label,'Bacon','combo 2 unit 3 with bacon');
eq(packet.units.find(x=>x.batchUnitKey==='c1:1:3').addons,[],'combo 1 no unauthorized bacon');
eq(packet.units.find(x=>x.batchUnitKey==='c2:1:7').note,'Molho separado','unit-specific note');
eq(packet.totalPreviewCents,14297,'2 combos at R$ 69.99 plus one R$ 2.99 bacon');
for(const paper of ['58','80']){
 const ticket=thermal.buildComboBatchThermalLab(packet,paper);
 eq(ticket.state,'preview_only',paper+' view only');
 eq(ticket.paperMm,Number(paper),paper+' output dimension');
 eq(ticket.canPrint,false,paper+' never prints');
 eq(ticket.canCharge,false,paper+' never charges');
 eq(ticket.canRelay,false,paper+' never relays');
 ok(ticket.lines.every(s=>Array.from(s).length<=ticket.columns),paper+' line width safe');
 ok(ticket.lines.some(s=>s.includes('COMBO 1/2')),paper+' first combo visible');
 ok(ticket.lines.some(s=>s.includes('COMBO 2/2')),paper+' second combo visible');
 ok(ticket.lines.some(s=>s.includes('SEM Alface')),paper+' removed ingredient on ticket');
 ok(ticket.lines.some(s=>s.includes('+ Bacon')),paper+' addon on ticket');
 ok(ticket.lines.join(' ').includes('Molho separado'),paper+' unit note on ticket');
 ok(ticket.html.includes('NAO IMPRIMIR'),paper+' explicit non-print marker');
 ok(!ticket.html.includes('window.print'),paper+' html inert');
}
bad(()=>thermal.buildComboBatchThermalLab(packet,'90'),/PAPER_INVALID/,'unknown paper refuses');
bad(()=>thermal.buildComboBatchThermalLab({...packet,canSend:true},'58'),/PACKET_INVALID/,'tampered relay blocked');
eq(JSON.stringify(b).includes('customerSnapshot'),false,'draft contains no customer identity');
console.log(`R247: ${checks} verificações de interface, isolamento, catálogo e bobinas aprovadas.`);
