'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');let n=0;
const check=(yes,name)=>{assert.ok(yes,name);n++;};
const corePath='src/lib/addressPreviewCore.ts';
const compiled=ts.transpileModule(read(corePath),{fileName:corePath,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
check(!(compiled.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error),'motor sem erro de transpilacao');
const mod={exports:{}};new Function('module','exports',compiled.outputText)(mod,mod.exports);
const {readPreviewInput,inspectGeoapifyAddress,readRouteDistanceKm,addressText}=mod.exports;
const input={district:'Centro',street:'Rua Major Gote',number:'120'};
check(readPreviewInput(input).street==='Rua Major Gote','entrada normalizada preserva rua');
for(const a of [null,[],{}, {district:'C',street:'Rua Major Gote',number:'120'},
{district:'Centro',street:'Rua',number:'120'},
{district:'Centro',street:'Rua Major Gote',number:''},
{district:'Centro',street:'Rua Major Gote',number:'<script>'},
{district:'Centro',street:'Rua Major Gote',number:'999\n1'},
{district:'Centro',street:'Rua Major Gote',number:'1'.repeat(22)}])check(readPreviewInput(a)===null,'rejeita payload incompleto ou hostil');
check(addressText('Av. São José')==='sao jose','comparacao sem acentos/abreviacoes');
const make=(extra={})=>({street:'Rua Major Gote',housenumber:'120',district:'Centro',city:'Patos de Minas',state:'Minas Gerais',state_code:'MG',country_code:'br',lat:-18.58,lon:-46.52,rank:{confidence:.92},...extra});
const preview=p=>inspectGeoapifyAddress(input,{results:[p]});
check(preview(make()).state==='confirmed','endereco forte encontrado');
check(preview(make({housenumber:'121'})).state==='review','numero diferente nunca e confirmado');
check(preview(make({street:'Rua das Flores'})).state==='review','rua diferente nao e confirmada');
check(preview(make({city:'Uberlandia'})).state==='not_found','cidade fora da operacao ignorada');
check(preview(make({country_code:'us'})).state==='not_found','pais fora da operacao ignorado');
check(preview(make({state:'Sao Paulo',state_code:'SP'})).state==='not_found','estado errado ignorado');
check(preview(make({lat:999})).state==='review','coordenada absurda nao confirmada');
check(preview(make({rank:{confidence:.25}})).state==='review','confianca baixa nao confirma');
check(preview(make({housenumber:undefined})).state==='review','sem numero nao confirma');
check(inspectGeoapifyAddress(input,{results:[]}).state==='not_found','sem resultados continua manual');
check(preview(make()).point?.lat===-18.58,'coordenada apenas no motor interno');
check(readRouteDistanceKm({results:[{distance:4750}]} )===4.8,'distancia oficial e em metros');
check(readRouteDistanceKm({results:[{distance:-1}]})===null,'distancia negativa rejeitada');
check(readRouteDistanceKm({results:[{distance:200000}]})===null,'distancia absurda rejeitada');
check(readRouteDistanceKm({results:[]})===null,'sem rota nao inventa distancia');
const api=read('src/app/api/address/preview/route.ts');const ui=read('src/components/ui/AddressMapPreview.tsx');const css=read('src/components/ui/AddressMapPreview.module.css');
for(const token of ['GEOAPIFY_ADDRESS_PREVIEW_ENABLED','GEOAPIFY_API_KEY','GEOAPIFY_ROUTE_PREVIEW_ENABLED','DFL_STORE_LAT','DFL_STORE_LON','countrycode:br','mode","drive','cache:"no-store"','Cache-Control','ORIGIN_DENIED','RATE_LIMITED','get("content-length")','AbortController','inspectGeoapifyAddress','readRouteDistanceKm'])check(api.includes(token),'endpoint protegido: '+token);
for(const token of ['NEXT_PUBLIC_DFL_ADDRESS_PREVIEW_ENABLED','"/api/address/preview"','AbortController','controller.current?.abort()','onClick={()=>void query()}','role="status"','Não é cotação de frete','Não é cotação']){if(token==='Não é cotação')continue;check(ui.includes(token),'componente opcional: '+token);}
check(!/createCustomerOrder|sendAdminNewOrderPush|runTransaction|addDoc\(|setDoc\(|deliveryFee|setDeliveryFee/.test(api),'geocodificacao nao grava nem determina taxa');
check(!/createCustomerOrder|runTransaction|setDeliveryFee|orderAttemptRef/.test(ui),'componente nao altera pedido ou frete');
check(!/GEOAPIFY_API_KEY/.test(ui),'segredo nunca exposto no frontend');
check(api.includes('inspected.state==="confirmed"'),'rota so para endereco confirmado');
check(api.includes('distanceKm!==null?{distanceKm}'), 'distancia opcional, sem valor falso');
check(css.includes('focus-visible')&&css.includes('min-height:44px'),'acessibilidade mobile');
const checkout=read('src/components/ui/CheckoutModal.tsx');
check(checkout.includes('DFL-R39-GEOAPIFY-ON-DEMAND')&&checkout.includes('<AddressMapPreview district={bairro} street={rua} number={numero} />'),'integra no checkout existente');
check(checkout.includes('const canAdvance = nameReady && phoneReady && addressReady && items.length > 0'),'nao muda bloqueio original');
check(checkout.includes('orderAttemptRef')&&checkout.includes('createCustomerOrder'),'idempotencia preservada');
for(const p of [corePath,'src/app/api/address/preview/route.ts','src/components/ui/AddressMapPreview.tsx','src/components/ui/CheckoutModal.tsx']){
 const tree=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 check(tree.parseDiagnostics.length===0,'TS/TSX sem erro: '+p);
}
console.log(`R39 GEOAPIFY: ${n} contratos aprovados`);
