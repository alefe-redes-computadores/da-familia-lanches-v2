#!/usr/bin/env node
'use strict';
/** R75 P1: zero network/Firestore/Supabase/WhatsApp. Signed read-only proxy simulations. */
const fs=require('node:fs'), assert=require('node:assert/strict'), ts=require('typescript'), crypto=require('node:crypto');
const path='src/app/api/integration/messaging-owner-audit/route.ts';
const src=fs.readFileSync(path,'utf8');
let checks=0;const ok=(x,m)=>{assert.ok(x,'R75 SITE '+m);checks++};
for(const file of [path,'src/lib/messaging/r34AuditPolicy.ts']){
  ok(ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS).parseDiagnostics.length===0,'AST '+file);
}
for(const t of ['assertSignedIntegrationRequest','r34ValidQuery','r34ValidAuditReply','DFL_MESSAGING_WORKER_TOKEN','R34_AUDIT_URL','redirect: \'error\'','cache: \'no-store\'','AbortSignal.timeout(5500)',"obj.event_type !== 'all'"])ok(src.includes(t),'contrato '+t);
ok(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(|sendWhatsApp\(|workerWake|issueGrant\(/.test(src),'no dispatch/mutation');
function load(file,deps,context={}){
  const js=ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const m={exports:{}};
  new Function('require','module','exports','fetch','process','AbortSignal','Date',js)((id)=>{if(Object.hasOwn(deps,id))return deps[id];throw Error('unexpected dependency '+id)},m,m.exports,context.fetch,context.process||process,AbortSignal,Date);
  return m.exports;
}
const policy=load('src/lib/messaging/r34AuditPolicy.ts',{});
let remoteReads=0;
const id='dfl-12345678-1234-1234-1234-123456789abc';
const eventId=`r75-owner-audit-v1__${id}`;
const body=JSON.stringify({event_id:eventId,source:'manual',order_id:`entregas:${id}`,event_type:'all'});
const sig='K'.repeat(48);
const env={DFL_MESSAGING_WORKER_TOKEN:'W'.repeat(48),DFL_INTEGRATION_SIGNING_SECRET:sig};
const now=new Date().toISOString();
const record={eventType:'order.created',state:'dead_letter',fingerprint:'1'.repeat(16),createdAt:now,sentAt:null,providerAccepted:false,failureCode:'R33_PROVIDER_OR_STATE_UNCERTAIN_REVIEW'};
const sample={contract:'dfl.messaging.audit.v1',version:1,ok:true,source:'manual',orderId:`entregas:${id}`,eventType:'all',checkedAt:now,records:[record],sampleLimited:false,customerDeliveryVerified:false};
let payload=sample;
const proxy=load(path,{
  'next/server':{NextResponse:{json:(obj,opts)=>({status:opts.status,body:obj,headers:opts.headers})}},
  '@/lib/integration/server/signature':{assertSignedIntegrationRequest:({body,timestamp,signature,eventId:head,expectedEventId})=>{
    if(head!==expectedEventId||Math.abs(Date.now()-Number(timestamp))>300000||signature!==crypto.createHmac('sha256',sig).update(`${timestamp}.${body}`,'utf8').digest('hex'))throw Error('bad signature');
  }},
  '@/lib/messaging/r34AuditPolicy':policy,
},{process:{env},fetch:async(url,opts)=>{
  remoteReads++;ok(url===policy.R34_AUDIT_URL,'Supabase URL fixed');
  ok(opts.method==='POST'&&opts.cache==='no-store'&&opts.redirect==='error','upstream read-only');
  ok(opts.headers['x-dfl-messaging-worker-token']===env.DFL_MESSAGING_WORKER_TOKEN,'credential server-only');
  return {ok:true,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify(payload)};
}});
function request(raw,auth=true,ct='application/json'){
 const stamp=String(Date.now());const sign=crypto.createHmac('sha256',sig).update(`${stamp}.${raw}`,'utf8').digest('hex');
 const h={'content-type':ct,'x-dfl-timestamp':stamp,'x-dfl-signature':auth?sign:'invalid','x-dfl-event-id':eventId};
 return {headers:{get:key=>h[key]||null},text:async()=>raw};
}
(async()=>{
 let r=await proxy.POST(request(body,false));ok(r.status===401,'signature required');ok(remoteReads===0,'unsigned 0 reads');
 r=await proxy.POST(request(JSON.stringify({...JSON.parse(body),phone:'5534999999999'})));ok(r.status===422,'extra PII field rejected');ok(remoteReads===0,'invalid query 0 reads');
 r=await proxy.POST(request(body,true,'text/plain'));ok(r.status===415,'content-type strict');
 r=await proxy.POST(request(body));ok(r.status===200,'signed allowed');ok(remoteReads===1,'one bounded upstream query');
 ok(r.body.customerDeliveryVerified===false&&r.body.records[0].state==='dead_letter','states preserved without delivery claims');
 ok(!JSON.stringify(r.body).includes('phone'),'no PII');
 payload={...sample,records:[{...record,customer_phone:'5534999999999'}]};
 r=await proxy.POST(request(body));ok(r.status===502,'reject extra provider PII');
 console.log(`R75 SITE P1: ${checks} verificações herméticas; assinatura, privacidade e zero envios OK`);
})().catch(err=>{console.error(err.stack||err);process.exitCode=1});
