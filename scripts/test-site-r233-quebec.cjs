'use strict';
// R233: synthetic customer journey, no commercial orders, Firestore, API or network calls.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const path=require('node:path');
let passed=0;
const ok=(condition,reason)=>{assert.ok(condition,reason);passed++;};
const rd=p=>fs.readFileSync(p,'utf8');
const loaded=new Map();
function localTS(file){
  if(loaded.has(file))return loaded.get(file);
  const source=rd(file);
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  ok(ast.parseDiagnostics.length===0,`TS valid: ${file}`);
  const code=ts.transpileModule(source,{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};
  const localRequire=spec=>{
    if(spec==='@/lib/addressIntelligence')return localTS('src/lib/addressIntelligence.ts');
    throw Error('R233 unexpected dependency: '+spec);
  };
  loaded.set(file,mod.exports);
  new Function('module','exports','require',code)(mod,mod.exports,localRequire);
  return mod.exports;
}
const address=localTS('src/lib/addressIntelligence.ts');
const catalog=localTS('src/lib/districtCatalog.ts');
const configured=['Centro','Caramuru','Jardim América'];
ok(address.normalizeDistrict('Quebéc')==='quebec','accents normalized');
ok(address.suggestDistricts('Quebec').includes('Jardim Quebec'),'local reference suggests full Quebec name');
ok(!address.inspectDistrict('Quebec',configured).valid,'partial Quebec is not a completed neighborhood');
ok(address.inspectDistrict('Quebec',configured).reason==='incomplete','partial Quebec receives incomplete reason');
ok(address.inspectDistrict('Quebec',configured).suggestions.includes('Jardim Quebec'),'invalid partial has actionable suggestion');
ok(address.inspectDistrict('Jardim Quebec',configured).valid,'canonical Jardim Quebec remains accepted');
ok(address.inspectDistrict('Jardim Quebec').valid,'canonical remains valid without rate catalog');
ok(!address.inspectDistrict('Jardim').valid,'other partial prefixes still blocked');
ok(address.inspectDistrict('Centro').valid,'regular neighborhood unaffected');
ok(address.matchDeliveryRate('Quebec',[{nome:'Jardim Quebec',taxa:6}])===undefined,'partial never causes rate lookup');
ok(address.matchDeliveryRate('Jardim Quebec',[{nome:'Jardim Quebec',taxa:6}])?.taxa===6,'only exact canonical match can use configured rate');
ok(address.matchDeliveryRate('Quebec',[{nome:'Centro',taxa:5}])===undefined,'no synthetic fallback price');
const found=catalog.searchDistrictCatalog('Quebec',configured,8);
ok(found.source==='reference','missing configured term clearly marked as reference');
ok(found.results.includes('Jardim Quebec'),'reference rescues Quebec when rate table has no entry');
ok(found.results.every(name=>address.normalizeDistrict(name)!=='Centro'),'no unrelated configured neighborhood inserted');
const configuredMatch=catalog.searchDistrictCatalog('Quebec',['Centro','Jardim Quebec'],8);
ok(configuredMatch.source==='configured'&&configuredMatch.results.includes('Jardim Quebec'),'configured table match retains priority');
ok(catalog.searchDistrictCatalog('Quebec',[],8).source==='reference','reference only mode preserved');
ok(catalog.searchDistrictCatalog('bairro QUEBEC',configured,8).results.includes('Jardim Quebec'),'prefix bairro and case handled');
ok(catalog.searchDistrictCatalog('bairro inexistente xyz',configured,8).results.length===0,'unknown location not invented');
ok(catalog.searchDistrictCatalog('Cen',configured,8).source==='configured','normal partial configured query unaffected');
ok(catalog.searchDistrictCatalog('',configured,8).source==='configured','empty query continues to use the configured list');
const picker=rd('src/components/ui/DistrictQuickPicker.tsx');
const checkout=rd('src/components/ui/CheckoutModal.tsx');
const pickerCss=rd('src/components/ui/DistrictQuickPicker.module.css');
const checkoutCss=rd('src/components/ui/CheckoutModal.module.css');
for(const [name,source,kind] of [['picker',picker,ts.ScriptKind.TSX],['checkout',checkout,ts.ScriptKind.TSX]]){
 const ast=ts.createSourceFile(name+'.tsx',source,ts.ScriptTarget.Latest,true,kind);
 ok(ast.parseDiagnostics.length===0,name+' JSX syntax');
}
ok(picker.includes('catalog.source === "reference" && configured.length > 0'),'reference results identified visually');
ok(picker.includes('disponibilidade e taxa serão verificadas'),'no coverage promised for reference matches');
ok(picker.includes('Selecione para confirmar o nome'),'select full neighborhood, no silent autocorrection');
ok(picker.includes('onSelect(name)'),'explicit client selection preserved');
ok(checkout.includes('“Quebec” → selecione “Jardim Quebec”'),'clear real-world example at address input');
ok(checkout.includes('inspectDistrict(bairro, configuredDistricts)'),'checkout still enforces neighborhood confirmation');
ok(checkout.includes('matchDeliveryRate(district, list)'),'real rate table remains authority');
ok(checkout.includes('deliveryFeeRequestRef.current += 1'),'stale rate requests still invalidated');
ok(checkout.includes('orderOutcomeUncertain'),'checkout idempotency safety preserved');
ok(pickerCss.includes('.list button > span:first-child')&&pickerCss.includes('font-size:13px'),'mobile result typography corrected');
ok(checkoutCss.includes('.addressForm .districtExample'),'helper mobile style exists');
const api=rd('src/app/api/orders/route.ts');
ok(api.includes('inspectDistrict(district, rates.map')&&api.includes('matchDeliveryRate(district, rates)'),'server controls rate and address validation');
for(const source of [rd('src/lib/districtCatalog.ts'),picker]){
 ok(!/\b(?:fetch|setDoc|addDoc|onSnapshot)\s*\(/.test(source),'catalog and picker do not generate network or database calls');
}
const workflow=rd('.github/workflows/site-sales-protection.yml');
ok(workflow.includes('node scripts/test-site-r233-quebec.cjs'),'CI regression wired to sales protection');
console.log(`R233 QUEBEC: ${passed} contracts passed (reference != service coverage; no actual orders).`);
// R234: automatically exercised by existing Sales Critical CI gate.
require('./test-site-r234-compound-districts.cjs');
