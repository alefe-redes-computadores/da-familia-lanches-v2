'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const ts=require('typescript');
const toJs=(file)=>ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true},reportDiagnostics:true}).outputText;
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replace(/\D/g,'');
const env={DFL_MESSAGING_PILOT_ENABLED:'true',DFL_MESSAGING_PILOT_PHONE_E164:'5534999999999',DFL_MESSAGING_INGEST_URL:'https://fixture.supabase.co/functions/v1/dfl-messaging-ingest',DFL_MESSAGING_INGEST_TOKEN:'INGEST_TEST',DFL_MESSAGING_WORKER_URL:'https://fixture.supabase.co/functions/v1/dfl-messaging-worker',DFL_MESSAGING_WORKER_TOKEN:'WORKER_TEST',DFL_MANUAL_MESSAGING_ENABLED:'true',DFL_MANUAL_MESSAGING_SCOPE:'canary'};
const next={NextResponse:{json:(body,opts={})=>({status:opts.status||200,body})}};
let network=[];let scenario='ok';
const fakeFetch=async(url,opts)=>{const u=new URL(url);network.push({url:u.pathname,opts});if(u.pathname.endsWith('/dfl-messaging-ingest')){return new Response(JSON.stringify(scenario==='duplicate'?{ok:true,queued:false,duplicate:true}:{ok:true,queued:true,duplicate:false}),{status:scenario==='ingest-fail'?503:202});}if(u.pathname.endsWith('/dfl-messaging-worker')){if(scenario==='worker-timeout')throw new Error('timeout fixture');return new Response(JSON.stringify({ok:true,active:true,processed:1,sent:1,failed:0}),{status:200});}throw Error('unexpected network '+url)};
function load(file,inject={}){const module={exports:{}};const ctx={module,exports:module.exports,require:(name)=>name==='next/server'?next:inject[name]??require(name),process:{env},Date,URL,Buffer,Intl,AbortController,Headers,Response,fetch:fakeFetch,setTimeout,clearTimeout,console,crypto};vm.runInNewContext(toJs(file),ctx,{timeout:3000});return module.exports;}
const pilot=load('src/app/api/integration/messaging-commission/route.ts',{'@/lib/integration/server/signature':{assertSignedIntegrationRequest:()=>{}}});
const manual=load('src/app/api/integration/manual-messaging/route.ts',{'@/lib/integration/server/signature':{assertSignedIntegrationRequest:()=>{}}});
const req=(data)=>({text:async()=>JSON.stringify(data),headers:{get:(name)=>name==='x-dfl-event-id'?data.event_id:null}});
const evt=(action)=>({protocol:'dfl.messaging.pilot.v1',source:'dfl_entregas',action,day,event_id:'dfl-pilot-1234567890abcdef',phone_sha256:crypto.createHash('sha256').update(env.DFL_MESSAGING_PILOT_PHONE_E164).digest('hex')});
(async()=>{
let n=0;
network=[];scenario='ok';let r=await pilot.POST(req(evt('pilot_send')));
assert.equal(r.status,200);assert.equal(r.body.code,'TEST_ENQUEUED');assert.equal(r.body.workerWake,'acknowledged');assert.equal(r.body.providerDelivered,false);n+=4;
assert.deepEqual(network.map(x=>x.url),['/functions/v1/dfl-messaging-ingest','/functions/v1/dfl-messaging-worker']);assert.equal(network[1].opts.headers['x-dfl-messaging-worker-token'],env.DFL_MESSAGING_WORKER_TOKEN);n+=2;
network=[];scenario='worker-timeout';r=await pilot.POST(req(evt('pilot_send')));assert.equal(r.status,200);assert.equal(r.body.workerWake,'uncertain');assert.equal(network.length,2);n+=3;
network=[];scenario='duplicate';r=await pilot.POST(req(evt('pilot_send')));assert.equal(r.body.code,'ALREADY_ENQUEUED');assert.equal(r.body.workerWake,'not_applicable');assert.equal(network.length,1);n+=3;
network=[];scenario='ok';env.DFL_MESSAGING_WORKER_URL='';r=await pilot.POST(req(evt('pilot_send')));assert.equal(r.body.workerWake,'not_configured');assert.equal(network.length,1);n+=2;env.DFL_MESSAGING_WORKER_URL='https://fixture.supabase.co/functions/v1/dfl-messaging-worker';
const id='dfl-12345678-1234-1234-1234-123456789abc';const manualPayload={source:'manual',event_id:'manual-msg-v1__order.created__'+id,event_type:'order.created',order_id:'entregas:'+id,customer_phone:env.DFL_MESSAGING_PILOT_PHONE_E164,customer_name:'Cliente de homologacao',payload:{delivery_id:id,fulfillment_mode:'delivery'}};
network=[];env.DFL_MANUAL_MESSAGING_SCOPE='all';r=await manual.POST(req(manualPayload));assert.equal(r.status,403);assert.equal(r.body.error,'manual_canary_off');assert.equal(network.length,0);n+=3;
network=[];env.DFL_MANUAL_MESSAGING_SCOPE='canary';manualPayload.customer_phone='5534988888888';r=await manual.POST(req(manualPayload));assert.equal(r.status,403);assert.equal(r.body.error,'manual_phone_not_allowlisted');assert.equal(network.length,0);n+=3;
network=[];manualPayload.customer_phone=env.DFL_MESSAGING_PILOT_PHONE_E164;r=await manual.POST(req(manualPayload));assert.equal(r.status,200);assert.equal(r.body.ok,true);assert.equal(network.length,2);assert.equal(network[0].url,'/functions/v1/dfl-messaging-ingest');n+=4;
console.log(`MSG-M7 SITE: ${n} contratos hermeticos OK (fast lane, idempotencia, canary, bloqueio 403, sem rede real).`);
})().catch(e=>{console.error(e);process.exitCode=1;});
