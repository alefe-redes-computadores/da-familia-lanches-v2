#!/usr/bin/env node
'use strict';
/* R29: Hermetic policy + runtime checks. No network, provider, Firestore or WhatsApp. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const path=require('node:path');
const read=p=>fs.readFileSync(p,'utf8');
let tests=0;
const ok=(v,name)=>{assert.ok(v,name);tests++;};
const files=[
 'src/lib/tracking/r29CertificationPolicy.ts',
 'src/lib/tracking/r29CertificationServer.ts',
 'src/app/api/admin/dfl360-certification/route.ts',
 'src/components/admin/R29CertificationCard.tsx',
 'src/components/admin/Dfl360OperationsCard.tsx',
];
const edgePath='docs/integration/r29-provider/';
for(const f of [...files,edgePath+'index.ts.txt',edgePath+'policy.ts.txt']){
 const source=read(f);
 const parsed=ts.createSourceFile(f,source,ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(parsed.parseDiagnostics.length===0,`TS syntax ${f}`);
}
const compiled=(name,src)=>ts.transpileModule(src,{fileName:name,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
function pure(file){
 const e={};vm.runInNewContext(compiled(file,read(file)),{exports:e,Date,URL});return e;
}
const policy=pure('src/lib/tracking/r29CertificationPolicy.ts');
const receipt={contract:'dfl.tracking.provider.preflight.v1',version:1,action:'preflight',auth_verified:true,provider_configured:true,delivery_enabled:false,sends_attempted:0,customer_delivery_confirmed:false};
ok(policy.r29ValidPreflight(receipt),'valid preflight contract');
ok(!policy.r29ValidPreflight({...receipt,action:'send_tracking_initial'}),'action restricted');
ok(!policy.r29ValidPreflight({...receipt,sends_attempted:1}),'no send asserted');
ok(!policy.r29ValidPreflight({...receipt,customer_delivery_confirmed:true}),'no fake delivery confirmation');
ok(!policy.r29ValidPreflight({...receipt,private_token:'secret'}),'no private extra fields');
ok(policy.R29_URL==='https://bwggczkzsqcdeayyysmx.supabase.co/functions/v1/dfl-tracking-provider-handoff','fixed Supabase origin');
const checks=policy.r29Checks({},false);
ok(checks.length===12,'complete checklist');
ok(checks.find(x=>x.id==='endpoint').state==='off','missing secrets are OFF');
ok(checks.find(x=>x.id==='entregas').state==='unknown','Entregas not incorrectly certified');
ok(checks.find(x=>x.id==='customer').state==='unknown','WhatsApp receipt not assumed');
ok(checks.find(x=>x.id==='kill').state==='off','kill switch missing is OFF and cannot authorize sending');
ok(policy.r29NoSends.providerSend===false && policy.r29NoSends.tokenIssued===false && policy.r29NoSends.dbWrite===false,'no side effects contract');
const route=read('src/app/api/admin/dfl360-certification/route.ts');
ok(route.includes('verifyIdToken(bearer,true)')&&route.includes('isAdminEmail(claims.email)'),'admin Firebase revocation check');
ok(route.includes('export async function GET')&&!route.includes('export async function POST'),'read-only GET admin');
ok(route.includes("request.nextUrl.searchParams.get('probe')==='1'"),'explicit opt-in probe');
ok(route.includes('no-store')&&route.includes('no-referrer'),'private no-store response');
const server=read('src/lib/tracking/r29CertificationServer.ts');
ok(server.includes("import 'server-only'")&&server.includes('r27ProviderConfig(process.env)'),'server-only guarded by prior config');
ok(server.includes('fetch(R29_URL')&&server.includes("method:'GET'"),'fixed passive probe');
ok(server.includes("'x-dfl-tracking-preflight':'1'")&&server.includes('JSON.stringify(R29_PREFLIGHT)'),'separate non-send authenticated probe');
ok(server.includes("res.status===405?'reachable':'unavailable'"),'405 proves only route availability');
ok(!server.includes('r25SendInitialOnce')&&!server.includes('drainR27AutomaticDelivery'),'never dispatch grant or WhatsApp');
ok(!server.includes('console.log')&&!server.includes('console.error'),'no key logging');
const ui=read('src/components/admin/R29CertificationCard.tsx');
ok(ui.includes("fetch('/api/admin/dfl360-certification?probe=1'")&&ui.includes('getIdToken()'),'admin-only explicit fetch');
ok(!/\buseEffect\s*\(|setInterval\s*\(|onSnapshot\s*\(/.test(ui),'no polling');
ok(ui.includes('nenhum envio')||ui.includes('Nenhuma mensagem enviada'),'no send claim');
const host=read('src/components/admin/Dfl360OperationsCard.tsx');
ok(host.includes('R29CertificationCard')&&host.includes('<R29CertificationCard />'),'integrated in existing Admin central');
const edge=read(edgePath+'index.ts.txt');
ok(edge.includes("x-dfl-tracking-preflight")&&edge.includes("p.action!=='preflight'"),'strict action probe');
ok(edge.includes('keys.length!==3'),'exact preflight payload');
ok(edge.indexOf("if(req.headers.get('x-dfl-tracking-preflight')==='1')")<edge.indexOf("if(env('DFL_TRACKING_HANDOFF_ENABLED')!=='true'"),'probe allowed while send OFF');
ok(edge.includes('sameSecret(incomingSecret,shared)')&&edge.includes('sameSecret(incomingApiKey,allowedKey)'),'dual auth before probe');
ok(edge.includes("db.from('dfl_tracking_provider_attempts_v1').insert")&&edge.includes('await fetch(target'),'one-shot original send guarded');
ok(!/console\.(log|info|warn|error)\(/.test(edge),'no secret payload logs');
const policyEdge=read(edgePath+'policy.ts.txt');
ok(policyEdge.includes('parseP9Request')&&policyEdge.includes('trustedEvolutionMessageId'),'R28 production parse intact');

// Runtime execute deployed Edge Function with a mocked Deno and no real I/O.
const edgeModule={exports:{}};const edgePolicyModule={exports:{}};
vm.runInNewContext(compiled('policy.ts',policyEdge),{exports:edgePolicyModule.exports,URL,Date});
let handle=null;let fetchCalls=0;let dbCalls=0;
const secrets={
 DFL_TRACKING_HANDOFF_ENABLED:'false',DFL_TRACKING_HANDOFF_KILL_SWITCH:'true',
 DFL_TRACKING_HANDOFF_SHARED_SECRET:'S'.repeat(48),
 DFL_TRACKING_HANDOFF_SITE_APIKEY:'sb_secret_'+'A'.repeat(40),
 DFL_EVOLUTION_API_URL:'https://evolution.example',DFL_EVOLUTION_INSTANCE:'DFL',DFL_EVOLUTION_API_KEY:'secretkey',
};
const ctx={exports:edgeModule.exports,require:s=>{
 if(s==='./policy.ts')return edgePolicyModule.exports;
 if(s.startsWith('npm:@supabase/supabase-js@'))return {createClient:()=>{dbCalls++;throw Error('db not expected')}};
 throw Error('unexpected import '+s);
},Date,URL,Response,Request,TextEncoder,Uint8Array,crypto:globalThis.crypto,AbortController,JSON,
 setTimeout,clearTimeout,fetch:async()=>{fetchCalls++;throw Error('external fetch forbidden')},
 Deno:{env:{get:k=>secrets[k]||''},serve:fn=>{handle=fn;}}};
vm.runInNewContext(compiled('index.ts',edge),ctx,{timeout:2500});
ok(typeof handle==='function','function registered Deno.serve');
const body=JSON.stringify(policy.R29_PREFLIGHT);
const call=async({auth=true,action=body,preflight=true,method='POST'}={})=>{
 const headers={'content-type':'application/json'};
 if(auth){headers['x-dfl-tracking-provider-secret']=secrets.DFL_TRACKING_HANDOFF_SHARED_SECRET;headers.apikey=secrets.DFL_TRACKING_HANDOFF_SITE_APIKEY;}
 if(preflight)headers['x-dfl-tracking-preflight']='1';
 return handle(new Request('https://fixture.supabase.co/functions/v1/dfl-tracking-provider-handoff',{method,headers,...(method==='POST'?{body:action}:{})}));
};
(async()=>{
 let res=await call({method:'GET'});ok(res.status===405,'GET cannot trigger sending');
 res=await call({auth:false});ok(res.status===401,'unauthenticated preflight denied');
 res=await call();ok(res.status===200,'preflight available with send OFF');
 const data=await res.json();ok(data.auth_verified===true,'preflight dual auth confirmed');
 ok(data.delivery_enabled===false,'dispatch stays OFF');
 ok(data.provider_configured===true,'provider config checked without contacting Evolution');
 ok(data.sends_attempted===0&&data.customer_delivery_confirmed===false,'no messages or delivery claims');
 res=await call({action:JSON.stringify({...policy.R29_PREFLIGHT,order_id:'AB12345678'})});ok(res.status===422,'extra order ID rejected');
 res=await call({action:JSON.stringify({...policy.R29_PREFLIGHT,action:'send_tracking_initial'})});ok(res.status===422,'preflight cannot masquerade as send');
 res=await call({preflight:false});ok(res.status===503,'actual sends remain disabled');
 ok(fetchCalls===0&&dbCalls===0,'no real provider or DB calls');
 console.log(`R29 P9 CERTIFICATION: ${tests} hermetic contracts PASS; no external network, Firestore, Supabase or WhatsApp.`);
})().catch(error=>{console.error(error);process.exitCode=1});
