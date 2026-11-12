#!/usr/bin/env node
'use strict';
/** R67 regression gates: no network, real Firestore, P9, WhatsApp or token issuance. */
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');let n=0;
const ok=(v,label)=>{assert.ok(v,'R67 '+label);n++};
const route=read('src/app/api/admin/orders/accept/route.ts');
const accept=read('src/lib/tracking/automaticAcceptance.ts');
const dispatch=read('src/lib/tracking/r27AutomaticDelivery.ts');
for(const [p,s] of [['accept-route',route],['accept-worker',accept],['p9-worker',dispatch]]) {
 const ast=ts.createSourceFile(p+'.ts',s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,p+' syntax');
 const r=ts.transpileModule(s,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
 ok(!r.diagnostics?.some(x=>x.category===ts.DiagnosticCategory.Error),p+' transpile');
}
ok(route.includes('export const maxDuration=60;'),'async work time budget');
ok(route.includes("if(result.state==='changed' && autoAcceptanceEnabled())"),'no replay for old accepts');
ok(route.includes('drainAutoAcceptances(1,orderId)'),'fastlane accept targeted');
ok(route.includes('drainR27AutomaticDelivery(1,orderId)'),'fastlane issuance targeted');
ok(route.indexOf('drainAutoAcceptances(1,orderId)')<route.indexOf('drainR27AutomaticDelivery(1,orderId)'),'acceptance before issuance');
ok(!route.includes('sendWhatsApp')&&!route.includes('opaque_token'),'no direct link or WhatsApp from endpoint');
ok(accept.includes(".where('state','in',['pending','processing'])")&&accept.includes('const docs=targetOrderId'),'scheduled recovery preserved');
ok(dispatch.includes("where('state','==','pending')")&&dispatch.includes('const docs=targetOrderId'),'pending-only cron preserved');
ok(dispatch.includes('state:\'processing\'')&&dispatch.includes('state:final'),'fenced one-time state preserved');
ok(dispatch.includes('if(targetOrderId && !doc.exists)continue;')&&accept.includes('if(targetOrderId && !doc.exists)continue;'),'missing direct doc ignored; cron legacy docs preserved');
function load(source,deps={},ctx={}) {
 const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const m={exports:{}};
 vm.runInNewContext(output,{module:m,exports:m.exports,require:k=>{if(k in deps)return deps[k];throw Error('R67 unexpected dependency '+k)},console:{info:()=>{}},Date,Math,Number,String,Object,JSON,Array,RegExp,Promise,...ctx},{timeout:1500});
 return m.exports;
}
(async()=>{
 let dbAccesses=0, queryCalls=0, sends=0;
 const id='site_TEST_VALID_12345';
 const d={state:'pending',order_id:id},ref={id};
 const entry={id,ref,exists:true,data:()=>({...d})};
 const db={collection:(name)=>{
    dbAccesses++;
    if(name==='Pedidos')return {doc:()=>({get:async()=>({exists:true,data:()=>({customerSnapshot:{phoneE164:'+5534999999999'}})})})};
    if(name==='tracking_auto_delivery_jobs_v1')return {doc:()=>({get:async()=>entry}),where:()=>{queryCalls++;throw Error('R67 no global queue for targeted acceptance')}};
    throw Error('R67 unexpected collection '+name);
   },runTransaction:async action=>action({get:async()=>({exists:true,data:()=>({...d})}),update:(_ref,patch)=>Object.assign(d,patch)})};
 const deps={'server-only':{},'node:crypto':{randomUUID:()=> 'lease_fixture'},'@/lib/integration/server/admin':{adminDb:db},
  './automaticInitialHandoff':{r25SendInitialOnce:async()=>{sends++;return 'provider_accepted';}},
  './r27ProviderTransport':{r27SendToProvider:()=>{throw Error('No network expected')}},
  './r27ProviderPolicy':{R27_COLLECTION:'tracking_auto_delivery_jobs_v1',r27DispatchConfigured:()=>true},
  './r41PilotRecipient':{r41TrackingPilotRecipient:()=>true}};
 const r27=load(dispatch,deps,{process:{env:{}}});
 const first=await r27.drainR27AutomaticDelivery(1,id);
 ok(first.claimed===1&&first.accepted===1&&d.state==='provider_accepted','targets one job exactly once');
 const second=await r27.drainR27AutomaticDelivery(1,id);
 ok(second.claimed===0&&sends===1,'already processed cannot retry');
 // FIX1: legacy R27 hermetic snapshot intentionally has NO `exists` property.
 // A scheduled Firestore query returns only existing docs; do not filter it again.
 const scheduledState={state:'pending',order_id:id};
 const scheduledDoc={id,ref:{id}};
 let scheduledSends=0, scheduledQueries=0;
 const scheduledDb={collection:(name)=>name==='Pedidos'
   ? {doc:()=>({get:async()=>({exists:true,data:()=>({customerSnapshot:{phoneE164:'+5534999999999'}})})})}
   : {where:(key,op,state)=>{scheduledQueries++;assert.equal(key,'state');assert.equal(op,'==');assert.equal(state,'pending');
       return {limit:()=>({get:async()=>({docs:scheduledState.state==='pending'?[scheduledDoc]:[]})})};}},
   runTransaction:async action=>action({get:async()=>({exists:true,data:()=>({...scheduledState})}),
     update:(_ref,patch)=>Object.assign(scheduledState,patch)})};
 const scheduledDeps={...deps,'@/lib/integration/server/admin':{adminDb:scheduledDb},
   './automaticInitialHandoff':{r25SendInitialOnce:async()=>{scheduledSends++;return 'provider_accepted';}}};
 const scheduled=load(dispatch,scheduledDeps,{process:{env:{}}});
 const cronOnce=await scheduled.drainR27AutomaticDelivery(1);
 ok(cronOnce.claimed===1&&cronOnce.accepted===1&&scheduledState.state==='provider_accepted',
   'R27 legacy scheduled job without exists property is processed once');
 const cronAgain=await scheduled.drainR27AutomaticDelivery(1);
 ok(cronAgain.claimed===0&&scheduledSends===1,'R27 legacy scheduled job never replays');
 ok(scheduledQueries===2,'R27 normal query preserved');
 const before=dbAccesses;
 const bad=await r27.drainR27AutomaticDelivery(1,'bad/path');
 ok(bad.claimed===0&&dbAccesses===before,'invalid target does not touch database');
 ok(queryCalls===0,'targeted path never scans whole queue');
 let reads=0;
 const aDb={collection:()=>{reads++;return {doc:()=>({get:async()=>({exists:false})}),where:()=>{throw Error('target scan not allowed')}}}};
 const aDeps={'server-only':{},'node:crypto':{randomUUID:()=> 'lease_fixture',createHash:()=>({update:()=>({digest:()=> 'hash'})})},
 '@ /unused':{},'@/lib/integration/server/admin':{adminDb:aDb},'@/lib/tracking/server':{callEntregas:()=>{throw Error('No S2S expected')}},
 './automaticAcceptancePolicy':{AUTO_ACCEPT_COLLECTION:'tracking_auto_acceptance_intents_v1',acceptedOrderCanNotify:()=>false,terminalOrDifferentAcceptance:()=>true},
 './r27ProviderPolicy':{R27_COLLECTION:'tracking_auto_delivery_jobs_v1',r27ShouldEnqueue:()=>false},
 './r41PilotRecipient':{r41TrackingPilotRecipient:()=>false}};
 const acceptance=load(accept,aDeps,{process:{env:{DFL_SITE_TRACKING_ENABLED:'1',DFL_SITE_TRACKING_AUTO_ACCEPT_ENABLED:'1'}}});
 const invalid=await acceptance.drainAutoAcceptances(1,'bad/path');
 ok(invalid.claimed===0&&reads===0,'invalid acceptance ID has no database I/O');
 const absent=await acceptance.drainAutoAcceptances(1,id);
 ok(absent.claimed===0&&reads===1,'missing acceptance never calls remote');
 console.log('R67 FASTLANE: '+n+' hermetic assertions OK; no network or messages.');
})().catch(err=>{console.error(err);process.exitCode=1});
