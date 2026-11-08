#!/usr/bin/env node
'use strict';
/** R31: proof of existing-token dual HMAC and OFF-by-default provider receiver.
 * All HTTP, Evolution, Firestore and Supabase operations are mocked. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const vm=require('node:vm');
const crypto=require('node:crypto');
const files=[
 'src/lib/tracking/r27ProviderPolicy.ts',
 'src/lib/tracking/r27ProviderTransport.ts',
 'src/lib/tracking/r31MessagingAuthentication.ts',
 'src/lib/tracking/r29CertificationServer.ts',
 'src/lib/tracking/r29CertificationPolicy.ts',
 'src/lib/tracking/r30ReleasePolicy.ts',
 'src/components/admin/R29CertificationCard.tsx',
 'docs/integration/r31-provider/index.ts.txt',
 'docs/integration/r31-provider/policy.ts.txt',
];
let count=0;const ok=(v,name)=>{assert.ok(v,name);count++;};
const read=p=>fs.readFileSync(p,'utf8');
function compile(p){const s=read(p);const parsed=ts.createSourceFile(p,s,ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(parsed.parseDiagnostics.length===0,`TS parse ${p}`);
 const output=ts.transpileModule(s,{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},reportDiagnostics:true});
 ok(!(output.diagnostics||[]).some(d=>d.category===ts.DiagnosticCategory.Error),`TS transpile ${p}`);
 return output.outputText;
}
for(const p of files)compile(p);
function load(p,dependencies={}){const ex={};vm.runInNewContext(compile(p),{exports:ex,require:id=>{
 if(id in dependencies)return dependencies[id];throw Error('Unexpected dependency '+id);
},URL,Date,Math,Number,Buffer},{timeout:2400,filename:p});return ex;}
const policy=load('src/lib/tracking/r27ProviderPolicy.ts');
const signer=load('src/lib/tracking/r31MessagingAuthentication.ts',{'server-only':{},'node:crypto':crypto});
const ref='bwggczkzsqcdeayyysmx';const url=`https://${ref}.supabase.co/functions/v1/dfl-tracking-provider-handoff`;
const ingest='Ingest-'+('I'.repeat(45));const worker='Worker-'+('W'.repeat(45));
const env={DFL_MESSAGING_INGEST_TOKEN:ingest,DFL_MESSAGING_WORKER_TOKEN:worker};
const cfg=policy.r31ExistingMessagingConfig(env);
ok(cfg&&cfg.url===url,'known provider origin fixed');
ok(!policy.r31ExistingMessagingConfig({}),'no tokens rejects');
ok(!policy.r31ExistingMessagingConfig({...env,DFL_MESSAGING_WORKER_TOKEN:ingest}),'non distinct rejects');
ok(!policy.r31ExistingMessagingConfig({...env,DFL_MESSAGING_WORKER_TOKEN:'weak'}),'short token rejects');
ok(!policy.r31ExistingMessagingConfig({...env,DFL_MESSAGING_WORKER_TOKEN:worker.repeat(40)}),'too long rejects');
ok(!policy.r27DispatchConfigured(env),'existing credentials do not activate sends');
const flags={...env,DFL_SITE_TRACKING_ENABLED:'1',DFL_SITE_TRACKING_AUTO_ACCEPT_ENABLED:'1',
 DFL_SITE_TRACKING_AUTO_ISSUE_ENABLED:'1',DFL_SITE_TRACKING_AUTO_PROVIDER_CERTIFIED:'1',
 DFL_SITE_TRACKING_PROVIDER_TRANSPORT_CERTIFIED:'1',DFL_SITE_TRACKING_AUTO_WORKER_ENABLED:'1',
 DFL_SITE_TRACKING_AUTO_KILL_SWITCH:'false',DFL_SITE_TRACKING_AUTO_ACTIVATED_AT:new Date(Date.now()-60_000).toISOString()};
ok(policy.r27DispatchConfigured(flags),'explicit gates plus trusted credentials recognize staged bridge');
for(const key of ['DFL_SITE_TRACKING_ENABLED','DFL_SITE_TRACKING_AUTO_ACCEPT_ENABLED','DFL_SITE_TRACKING_AUTO_ISSUE_ENABLED',
'DFL_SITE_TRACKING_AUTO_PROVIDER_CERTIFIED','DFL_SITE_TRACKING_PROVIDER_TRANSPORT_CERTIFIED','DFL_SITE_TRACKING_AUTO_WORKER_ENABLED','DFL_SITE_TRACKING_AUTO_KILL_SWITCH']){
 ok(!policy.r27DispatchConfigured({...flags,[key]:undefined}),`missing independent flag ${key}`);
}
ok(!policy.r27DispatchConfigured({...flags,DFL_SITE_TRACKING_AUTO_ACTIVATED_AT:''}),'no historic queue activation');
const payload=JSON.stringify({contract:'dfl.tracking.provider.preflight.v1',version:1,action:'preflight'});
const stamp=Date.now();const signed=signer.r31SignedHeaders(payload,cfg,stamp);
const message=`DFL-P9-R31\n${stamp}\n${payload}`.replaceAll('\\n','\n');
ok(signed['x-dfl-p9-signature-a']===crypto.createHmac('sha256',ingest).update(message).digest('hex'),'ingest HMAC matches canonical body');
ok(signed['x-dfl-p9-signature-b']===crypto.createHmac('sha256',worker).update(message).digest('hex'),'worker HMAC matches canonical body');
ok(signed['x-dfl-p9-signature-a']!==signed['x-dfl-p9-signature-b'],'independent HMACs');
ok(!JSON.stringify(signed).includes(ingest)&&!JSON.stringify(signed).includes(worker),'raw tokens not sent');
ok(signed['x-dfl-p9-timestamp']===String(stamp),'stable millisecond stamp');
assert.throws(()=>signer.r31SignedHeaders(payload,{ingestToken:ingest,workerToken:ingest}),/R31_INVALID_SIGNING_INPUT/);ok(true,'reject reused secret');
const edgeSrc=read('docs/integration/r31-provider/index.ts.txt');
const edgePolicy=load('docs/integration/r31-provider/policy.ts.txt');
let handler=null,fetchCount=0,dbCount=0;
const secrets={...env,DFL_TRACKING_HANDOFF_ENABLED:'false',DFL_TRACKING_HANDOFF_KILL_SWITCH:'true',
 EVOLUTION_API_URL:'https://evolution.invalid',EVOLUTION_INSTANCE:'DFL',EVOLUTION_API_KEY:'fixture'};
vm.runInNewContext(compile('docs/integration/r31-provider/index.ts.txt'),{
 exports:{},require:id=>{
  if(id==='./policy.ts')return edgePolicy;
  if(id.startsWith('npm:@supabase/supabase-js@'))return {createClient:()=>{dbCount++;throw Error('db blocked');}};
  throw Error('Unexpected import '+id);
 },Date,URL,Response,Request,TextEncoder,TextDecoder,Uint8Array,crypto:crypto.webcrypto,AbortController,JSON,
 setTimeout,clearTimeout,fetch:async()=>{fetchCount++;throw Error('provider fetch blocked');},
 Deno:{env:{get:k=>secrets[k]||''},serve:fn=>{handler=fn;}}
},{timeout:2500});
ok(typeof handler==='function','Edge function registered');
const request=async({body=payload,headers={},preflight=true,method='POST'}={})=>{
 const h={'content-type':'application/json',...signed,...headers};
 if(preflight)h['x-dfl-tracking-preflight']='1';
 return handler(new Request(url,{method,headers:h,...(method==='POST'?{body}:{})}));
};
(async()=>{
 let x=await request({method:'GET'});ok(x.status===405,'no GET sends');
 x=await request();ok(x.status===200,'HMAC preflight accepted when dispatch OFF');
 const v=await x.json();
 ok(v.auth_verified===true&&v.sends_attempted===0,'strict no-send ACK');
 ok(v.delivery_enabled===false&&v.customer_delivery_confirmed===false,'no WhatsApp delivery claims');
 ok(v.provider_configured===true,'existing Evolution config seen without sending');
 x=await request({headers:{'x-dfl-p9-signature-a':'0'.repeat(64)}});ok(x.status===401,'bad signature A blocked');
 x=await request({headers:{'x-dfl-p9-signature-b':'0'.repeat(64)}});ok(x.status===401,'bad signature B blocked');
 x=await request({body:JSON.stringify({...JSON.parse(payload),order_id:'ABCD123456'})});ok(x.status===401,'changed body invalidates signatures');
 x=await request({headers:{'x-dfl-p9-timestamp':String(stamp-5*60000)}});ok(x.status===401,'stale timestamp blocked');
 x=await request({preflight:false});ok(x.status===503,'send disabled independently by Supabase');
 const extra=JSON.stringify({...JSON.parse(payload),recipient_e164:'+5534999999999'});
 x=await request({body:extra,headers:signer.r31SignedHeaders(extra,cfg)});ok(x.status===422,'no customer data in preflight');
 x=await request({body:JSON.stringify({...JSON.parse(payload),action:'send_tracking_initial'}),headers:signer.r31SignedHeaders(JSON.stringify({...JSON.parse(payload),action:'send_tracking_initial'}),cfg)});ok(x.status===422,'preflight action cannot send');
 ok(fetchCount===0&&dbCount===0,'zero provider or database activity');
 ok(edgeSrc.indexOf("db.from('dfl_tracking_provider_attempts_v1').insert")<edgeSrc.indexOf('await fetch(target'),'one-shot reservation before network');
 ok(edgeSrc.includes("DFL_TRACKING_HANDOFF_ENABLED')!=='true'")&&edgeSrc.includes("DFL_TRACKING_HANDOFF_KILL_SWITCH')!=='false'"),'Supabase dispatch OFF');
 ok(!/console\.(?:log|error|warn|info)\(/.test(edgeSrc),'no request logs');
 ok(!edgeSrc.includes('dfl_messaging_outbox'),'no legacy persistent queue');
 const site=read('src/lib/tracking/r29CertificationServer.ts');
 ok(site.includes('r31SignedHeaders(payload,existing!)'),'Site probe uses signed existing credentials');
 ok(!site.includes('r25SendInitialOnce'),'Site probe never issues tracking link');
 const live=read('src/lib/tracking/r27ProviderTransport.ts');
 ok(live.includes('r31SignedHeaders(body,existing!)'),'Site transport signs ephemeral body');
 ok(live.includes("redirect:'error'")&&live.includes('AbortSignal.timeout(6500)'),'one-shot strict transport');
 console.log(`R31 EXISTING MESSAGING P9: ${count} hermetic assertions OK; zero external network/DB/WhatsApp.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
