#!/usr/bin/env node
'use strict';
/** R33: isolated manual pickup and Supabase interop, NO network or real data. */
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');let count=0;
const ok=(p,n)=>{assert.ok(p,n);count++};
const path='src/lib/messaging/r33ManualPickupPolicy.ts';
const policy=read(path),api=read('src/app/api/integration/manual-messaging/route.ts');
for(const [name,source] of [[path,policy],['manual-messaging/route.ts',api]]){
 const ast=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,'TS AST '+name);
}
const exp={};vm.runInNewContext(ts.transpileModule(policy,{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exp,Date});
const now=Date.now(),created=new Date(now-12_000).toISOString(),id='dfl-12345678-1234-1234-1234-123456789abc',key='a'.repeat(64);
const createdEvent={source:'manual',event_type:'order.created',order_id:'entregas:'+id,event_id:`manual-msg-v2__order.created__${id}__${key}`,occurred_at:created,payload:{delivery_id:id,fulfillment_mode:'pickup',manual_pickup_v1:true,manual_messaging_opt_in_v1:true,notify_whatsapp:true,completed:false,created_at:created,transition_key:key}};
ok(exp.r33ValidManualPickup(createdEvent,now),'new pickup registered and opted in');
const readyAt=new Date(now-8_000).toISOString(),readyEvent={...createdEvent,event_type:'order.ready',event_id:`manual-msg-v2__order.ready__${id}__${key}`,occurred_at:readyAt,payload:{...createdEvent.payload,pickup_ready_at:readyAt}};
ok(exp.r33ValidManualPickup(readyEvent,now),'pickup ready after persistence');
const reject=[
 ['wrong source',{...createdEvent,source:'site'}],
 ['bad ID',{...createdEvent,order_id:'entregas:evil'}],
 ['wrong ID key',{...createdEvent,event_id:createdEvent.event_id.replace(/a{64}$/,'b'.repeat(64))}],
 ['delivery mode',{...createdEvent,payload:{...createdEvent.payload,fulfillment_mode:'delivery'}}],
 ['optin false',{...createdEvent,payload:{...createdEvent.payload,manual_messaging_opt_in_v1:false}}],
 ['notify false',{...createdEvent,payload:{...createdEvent.payload,notify_whatsapp:false}}],
 ['pickup flag missing',{...createdEvent,payload:{...createdEvent.payload,manual_pickup_v1:undefined}}],
 ['completed',{...createdEvent,payload:{...createdEvent.payload,completed:true}}],
 ['wrong timestamp',{...createdEvent,payload:{...createdEvent.payload,created_at:new Date(now-60_000).toISOString()}}],
 ['created already ready',{...createdEvent,payload:{...createdEvent.payload,pickup_ready_at:readyAt}}],
 ['stale created',{...createdEvent,occurred_at:new Date(now-16*60_000).toISOString(),payload:{...createdEvent.payload,created_at:new Date(now-16*60_000).toISOString()}}],
 ['stale ready',{...readyEvent,occurred_at:new Date(now-8*60_000).toISOString(),payload:{...readyEvent.payload,pickup_ready_at:new Date(now-8*60_000).toISOString()}}],
 ['future timestamp',{...readyEvent,occurred_at:new Date(now+45_000).toISOString(),payload:{...readyEvent.payload,pickup_ready_at:new Date(now+45_000).toISOString()}}],
 ['wrong event',{...createdEvent,event_type:'delivery.started'}],
 ['ready as next stop',{...readyEvent,payload:{...readyEvent.payload,previous_stop_completed:true}}],
 ['missing payload',{...createdEvent,payload:null}],
];for(const [label,v] of reject)ok(!exp.r33ValidManualPickup(v,now),'reject '+label);
const env={DFL_MANUAL_PICKUP_ENABLED:'true',DFL_MANUAL_PICKUP_KILL_SWITCH:'false',DFL_MANUAL_PICKUP_SCOPE:'canary',DFL_MANUAL_MESSAGING_ENABLED:'true',DFL_MANUAL_MESSAGING_KILL_SWITCH:'false',DFL_MESSAGING_PILOT_PHONE_E164:'5534999999999'};
ok(exp.r33ManualPickupCanary(env,'5534999999999'),'explicit test phone canary');
ok(!exp.r33ManualPickupCanary({},'5534999999999'),'OFF by default');
ok(!exp.r33ManualPickupCanary(env,'5534988888888'),'block non-test phone');
ok(!exp.r33ManualPickupCanary(env,'invalid'),'phone validation');
for(const field of ['DFL_MANUAL_PICKUP_ENABLED','DFL_MANUAL_PICKUP_KILL_SWITCH','DFL_MANUAL_PICKUP_SCOPE','DFL_MANUAL_MESSAGING_ENABLED','DFL_MANUAL_MESSAGING_KILL_SWITCH','DFL_MESSAGING_PILOT_PHONE_E164']){
 ok(!exp.r33ManualPickupCanary({...env,[field]:undefined},'5534999999999'),'missing '+field+' fails closed');
}
ok(api.includes("const EVENTS=new Set(['order.created','delivery.started','delivery.completed'])"),'v1 events unchanged');
ok(api.includes('const r32NextStop=eventType===\'delivery.next_stop\''),'R32 next-stop untouched');
ok(api.includes('const pickupEnvelope='),'R33 v2-only identity');
ok(api.includes("r33ValidManualPickup(data)"),'R33 payload and time contract');
ok(api.includes('r33ManualPickupCanary(process.env,phone)'),'R33 independent switch');
ok(api.includes("obj.fulfillment_mode!==(pickupEnvelope?'pickup':'delivery')"),'pickup and delivery disjoint');
ok(api.indexOf('assertSignedIntegrationRequest(')<api.indexOf('r33ValidManualPickup(data)'),'HMAC mandatory before pickup');
ok(api.indexOf('r33ManualPickupCanary(process.env,phone)')<api.indexOf('const ingest='),'gate before outbox');
ok(api.includes('result.body.duplicate===true')&&api.includes('workerWake'),'old dedupe and wake unchanged');
ok(api.includes('deliveryVerified:false'),'API ACK does not imply delivery');
ok(!api.includes('console.log')&&!api.includes('console.error'),'no PII logging');
const docs=read('docs/integration/DFL-SITE-R33-CONTRATO.md');
for(const term of ['DFL_MANUAL_PICKUP_ENABLED','DFL_MANUAL_PICKUP_INGEST_ENABLED','DFL_MANUAL_PICKUP_WORKER_ENABLED','DFL_MANUAL_NEXT_STOP_INGEST_ENABLED','manual-msg-v2__order.ready__','R300'])ok(docs.includes(term),'documented '+term);
console.log(`R33 MANUAL PICKUP: ${count} hermetic contracts OK; sem rede, Firestore, Supabase ou WhatsApp.`);
