#!/usr/bin/env node
'use strict';
/* R25 hermetic gate: never contacts real Firebase, Entregas, Supabase or WhatsApp. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const crypto=require('node:crypto');
let passed=0;
const ok=(v,label)=>{assert.ok(v,label);passed++};
const file=p=>fs.readFileSync(p,'utf8');
const policyPath='src/lib/tracking/automaticInitialPolicy.ts';
const servicePath='src/lib/tracking/automaticInitialHandoff.ts';
const transportPath='src/lib/tracking/server.ts';
for(const p of [policyPath,servicePath,transportPath]){
  const parsed=ts.createSourceFile(p,file(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  ok(parsed.parseDiagnostics.length===0,`parse TS ${p}`);
}
const compile=(p,mocks,extra={})=>{
  const text=ts.transpileModule(file(p),{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports={};
  vm.runInNewContext(text,{exports,require:n=>{
    if(n==='node:crypto')return crypto;
    if(Object.hasOwn(mocks,n))return mocks[n];
    throw Error('Unexpected module: '+n);
  },Date,Buffer,process:{env:{}},...extra},{filename:p});
  return exports;
};
const underlying={
  acceptedOrderCanNotify:(d,at)=>d.whatsappNotificationsConsent===true && d.checkoutChannel==='site' &&
    d.sourceSystem==='dfl_site' && !d.whatsappNotificationsOptOut &&
    !!d.customerSnapshot?.phoneE164 && Number.isFinite(Date.parse(at)),
  terminalOrDifferentAcceptance:(d,at)=>d.acceptedAt!==at || ['Cancelado','Finalizado'].includes(d.status),
};
const policy=compile(policyPath,{'./automaticAcceptancePolicy':underlying});
const now=Date.now(),at=new Date(now-30_000).toISOString(), id='ORDER_00102';
const order={status:'Pendente',sourceSystem:'dfl_site',checkoutChannel:'site',
  whatsappNotificationsConsent:true,acceptedAt:at,customerSnapshot:{phoneE164:'+5534999999999'}};
const acceptance={state:'acknowledged',order_id:id,event_id:`site-R21-accepted-${id}`,accepted_at:at};
ok(policy.r25Eligible(order,acceptance),'ack P9 + order current');
ok(!policy.r25Eligible({...order,status:'Cancelado'},acceptance),'terminal blocked');
ok(!policy.r25Eligible({...order,whatsappNotificationsOptOut:true},acceptance),'opt-out blocked');
ok(!policy.r25Eligible(order,{...acceptance,state:'pending'}),'ack not confirmed');
ok(!policy.r25Eligible(order,{...acceptance,accepted_at:new Date().toISOString()}),'acceptance mismatch');
ok(!policy.r25Eligible(order,{...acceptance,event_id:'wrong'}),'event mismatch');
ok(!policy.r25Eligible({...order,acceptedAt:new Date(now-25*3600_000).toISOString()},acceptance),'stale accepted denied');
ok(!policy.r25Eligible({...order,acceptedAt:new Date(now+10*60_000).toISOString()},acceptance),'future denied');
ok(policy.r25ValidOrderId(id)&&!policy.r25ValidOrderId('../abc')&&!policy.r25ValidOrderId('short'),'strict order ID');
const issue=policy.r25IssueBody(id,'+5534999999999','a'.repeat(64));
ok(issue.contract==='dfl.tracking.automatic'&&issue.action==='issue_initial'&&issue.requested_ttl_minutes===45,'P9 issue shape');
ok(issue.acceptance_event_id===`site-R21-accepted-${id}`,'stable acceptance reference');
const issued={contract:'dfl.tracking.automatic',version:1,action:'issue_initial',status:'issued_pending_provider',
  grant_id:'a'.repeat(64),opaque_token:'b'.repeat(43),expires_at:new Date(now+45*60_000).toISOString(),
  one_time_only:true,delivery_confirmed:false};
ok(policy.r25ValidIssueReply(issued),'strict valid token response');
ok(!policy.r25ValidIssueReply({...issued,opaque_token:'bad'}),'bad token denied');
ok(!policy.r25ValidIssueReply({...issued,expires_at:new Date(now+60*60_000).toISOString()}),'bad TTL denied');
ok(!policy.r25ValidIssueReply({...issued,delivery_confirmed:true}),'false delivery claim denied');
ok(!policy.r25ValidIssueReply({...issued,grant_id:'invalid'}),'bad grant denied');
ok(!policy.r25ValidIssueReply({...issued,opaque_token:'c'.repeat(43),one_time_only:false}),'reuse denied');
ok(policy.r25EphemeralLink('b'.repeat(43)).startsWith('https://dafamilialanches.com.br/acompanhar#t='),'fragment-only URL');
const receipt={result:'accepted_by_provider',provider_event_id:'provider-12345678'};
ok(policy.r25ValidReceipt(receipt),'provider receipt valid');
ok(!policy.r25ValidReceipt({...receipt,provider_event_id:'a'}),'provider id invalid');
ok(!policy.r25ValidReceipt({...receipt,result:'delivered'}),'delivery cannot be claimed');
const receiptBody=policy.r25ReceiptBody(id,'a'.repeat(64),'c'.repeat(64),receipt);
ok(receiptBody.action==='provider_receipt'&&receiptBody.canonical_order_key===`site:${id}`,'receipt contract');
const transport=file(transportPath);
ok(transport.includes("AUTO_ISSUE_PATH")&&transport.includes("AUTO_RECEIPT_PATH"),'HMAC endpoint allowlist');
const serviceSource=file(servicePath);
ok(!/console\.|sessionStorage|localStorage|NEXT_PUBLIC_/.test(serviceSource),'no logged tokens or client storage');
ok(!/sendWhatsApp|supabase\.(?:from|functions)/.test(serviceSource),'no invented provider/outbox');
ok(serviceSource.includes("state:'reserved'")&&serviceSource.includes("tx.create(ref"),'reserve first');
ok(serviceSource.includes("state:'review_required'")&&serviceSource.includes("provider_transport_uncertain"),'uncertain outcome quarantined');
ok(!serviceSource.includes('export async function POST'),'not exposed as public API');
function dbFixture({current=order, ack=acceptance, existing=false}={}) {
  const docs=new Map();
  if(current) docs.set(`Pedidos/${id}`,{...current});
  if(ack) docs.set(`tracking_auto_acceptance_intents_v1/${id}`,{...ack});
  if(existing) docs.set(`tracking_auto_initial_handoffs_v1/${id}`,{state:'reserved'});
  const refs=new Map();
  function ref(coll,docId){
    const path=`${coll}/${docId}`;
    if(!refs.has(path))refs.set(path,{
      path,
      async get(){return {exists:docs.has(path),data:()=>docs.get(path)};},
      async update(p){if(!docs.has(path))throw Error('not_found');docs.set(path,{...docs.get(path),...p});},
    });
    return refs.get(path);
  }
  const db={collection(name){return {doc(docId){return ref(name,docId);}}},
    async runTransaction(fn){return fn({
      get:r=>r.get(),
      create(r,data){if(docs.has(r.path))throw Error('duplicate');docs.set(r.path,{...data});},
      update(r,data){if(!docs.has(r.path))throw Error('not_found');docs.set(r.path,{...docs.get(r.path),...data});},
    });}};
  return {db,docs};
}
const env={DFL_SITE_TRACKING_ENABLED:'1',DFL_SITE_TRACKING_AUTO_ACCEPT_ENABLED:'1',
 DFL_SITE_TRACKING_AUTO_ISSUE_ENABLED:'1',DFL_SITE_TRACKING_AUTO_PROVIDER_CERTIFIED:'1'};
function service(fixture,impl,envVars=env){
  const calls=[];
  const send=async(path,payload)=>{calls.push({path,payload});return impl(path,payload,fixture)};
  const exported=compile(servicePath,{
    'server-only':{},
    '@/lib/integration/server/admin':{adminDb:fixture.db},
    '@/lib/tracking/server':{callEntregas:send},
    './automaticAcceptancePolicy':{AUTO_ACCEPT_COLLECTION:'tracking_auto_acceptance_intents_v1'},
    './automaticInitialPolicy':policy,
  },{process:{env:envVars}});
  return {exported,calls};
}
const defaultRemote=async(path)=>path.endsWith('/issue')?
  {ok:true,status:201,data:{...issued,expires_at:new Date(Date.now()+45*60_000).toISOString()}}:
  {ok:true,status:200,data:{ok:true,code:'recorded',provider_state:'accepted_by_provider',customer_delivery_confirmed:false}};
(async()=>{
  const off=service(dbFixture(),defaultRemote,{});
  ok(await off.exported.r25SendInitialOnce(id,async()=>receipt)==='off','OFF yields no side effects');
  ok(off.calls.length===0,'OFF no S2S');
  const fixture=dbFixture();
  const run=service(fixture,defaultRemote);let invoked=0;let ephem='';
  const result=await run.exported.r25SendInitialOnce(id,async message=>{
    invoked++;ephem=message.url;return receipt;
  });
  ok(result==='provider_accepted','provider accepted not delivered');
  ok(invoked===1&&ephem.includes('#t='),'provider called once with ephemeral token');
  ok(run.calls.length===2&&run.calls[0].path.endsWith('/issue')&&run.calls[1].path.endsWith('/receipt'),'issue then receipt S2S');
  const saved=fixture.docs.get(`tracking_auto_initial_handoffs_v1/${id}`);
  ok(saved.state==='provider_accepted','durable state accepted');
  ok(!JSON.stringify(saved).includes('bbbb')&&!JSON.stringify(saved).includes('5534')&&!JSON.stringify(saved).includes('acompanhar'),'no token/phone/url persistence');
  ok(await run.exported.r25SendInitialOnce(id,async()=>{throw Error('duplicate')})==='already_reserved','duplicate no second issuance');
  ok(run.calls.length===2,'no duplicate S2S calls');
  const errored=dbFixture();const erroredSvc=service(errored,defaultRemote);
  ok(await erroredSvc.exported.r25SendInitialOnce(id,async()=>{throw Error('network unclear')})==='review_required','unknown provider outcome quarantined');
  ok(errored.docs.get(`tracking_auto_initial_handoffs_v1/${id}`).state==='review_required','review state persisted');
  const failIssue=dbFixture();const issueSvc=service(failIssue,async()=>({ok:false,status:503,data:null}));
  ok(await issueSvc.exported.r25SendInitialOnce(id,async()=>receipt)==='review_required','issue uncertain no provider call');
  ok(failIssue.docs.get(`tracking_auto_initial_handoffs_v1/${id}`).state==='review_required','issue uncertainty persisted');
  const badReceipt=dbFixture();const receiptSvc=service(badReceipt,async path=>path.endsWith('/issue')?
    {ok:true,status:201,data:{...issued,expires_at:new Date(Date.now()+45*60_000).toISOString()}}:
    {ok:false,status:503,data:null});
  ok(await receiptSvc.exported.r25SendInitialOnce(id,async()=>receipt)==='review_required','receipt transport uncertainty quarantined');
  const ineligible=service(dbFixture({current:{...order,status:'Cancelado'}}),defaultRemote);
  ok(await ineligible.exported.r25SendInitialOnce(id,async()=>receipt)==='ineligible','terminal order denied');
  ok(ineligible.calls.length===0,'terminal no S2S');
  console.log(`R25 P9: ${passed} hermetic contracts PASS; no network, real Firestore or WhatsApp.`);
})().catch(e=>{console.error(e);process.exitCode=1;});
