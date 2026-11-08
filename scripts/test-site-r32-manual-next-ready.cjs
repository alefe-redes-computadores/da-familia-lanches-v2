#!/usr/bin/env node
'use strict';
/** R32 hermetic contracts: pure functions + targeted source audits; no network. */
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require('typescript');let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;};
const read=x=>fs.readFileSync(x,'utf8');
const files=[
 'src/lib/messaging/r32ManualNextStopPolicy.ts',
 'src/lib/messaging/r32ReadyAuditPolicy.ts',
 'src/app/api/admin/messaging-ready-audit/route.ts',
 'src/components/admin/R32ReadyAuditCard.tsx',
 'src/app/api/integration/manual-messaging/route.ts',
 'src/components/admin/MessagingCenterAdmin.tsx'
];
for(const file of files){const src=read(file);const ast=ts.createSourceFile(file,src,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(!ast.parseDiagnostics.length,'TS AST '+file);}
const load=file=>{const e={};vm.runInNewContext(ts.transpileModule(read(file),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:e,Date,URL,Set});return e;};
const next=load('src/lib/messaging/r32ManualNextStopPolicy.ts');
const ready=load('src/lib/messaging/r32ReadyAuditPolicy.ts');
const now=Date.now();const at=new Date(now-5000).toISOString();
const id='dfl-12345678-1234-1234-1234-123456789abc',key='a'.repeat(64);
const input={source:'manual',event_type:'delivery.next_stop',order_id:'entregas:'+id,event_id:`manual-msg-v2__delivery.next_stop__${id}__${key}`,
 occurred_at:at,payload:{delivery_id:id,fulfillment_mode:'delivery',manual_messaging_opt_in_v1:true,notify_whatsapp:true,
 route_id:'route_12345678',route_started:true,route_closed:false,previous_stop_completed:true,
 previous_stop_group_id:'stop_01',next_stop_group_id:'stop_02',previous_stop_completed_at:at,
 planned_stop:2,total_stops:6,pending_stop_rank:1,stops_ahead:0,snapshot_version:12,transition_key:key}};
ok(next.r32ValidManualNextStop(input,now),'valid signed envelope structure');
for(const [field,value] of [['previous_stop_completed',false],['route_started',false],['route_closed',true],
 ['pending_stop_rank',2],['stops_ahead',1],['planned_stop',1],['planned_stop',7],['total_stops',1],
 ['snapshot_version',0],['previous_stop_group_id','stop_02'],['route_id',''],
 ['manual_messaging_opt_in_v1',false],['notify_whatsapp',false],['transition_key','garbage'],
 ['fulfillment_mode','pickup']]){
 ok(!next.r32ValidManualNextStop({...input,payload:{...input.payload,[field]:value}},now),'reject '+field+'='+value);
}
ok(!next.r32ValidManualNextStop({...input,source:'site'},now),'manual-only');
ok(!next.r32ValidManualNextStop({...input,event_type:'delivery.started'},now),'no route-start substitution');
ok(!next.r32ValidManualNextStop({...input,event_id:input.event_id.replace(/a+$/,'b'.repeat(64))},now),'event ID must match transition');
ok(!next.r32ValidManualNextStop({...input,payload:{...input.payload,delivery_id:'dfl-other123456789abc'}},now),'order identity');
ok(!next.r32ValidManualNextStop({...input,occurred_at:new Date(now-15*60_000).toISOString(),payload:{...input.payload,previous_stop_completed_at:new Date(now-15*60_000).toISOString()}},now),'no replay old route');
ok(!next.r32ValidManualNextStop({...input,payload:{...input.payload,previous_stop_completed_at:new Date(now-60_000).toISOString()}},now),'completion date authority');
const canary={DFL_MANUAL_NEXT_STOP_ENABLED:'true',DFL_MANUAL_NEXT_STOP_KILL_SWITCH:'false',DFL_MANUAL_NEXT_STOP_SCOPE:'canary',DFL_MANUAL_MESSAGING_ENABLED:'true',DFL_MANUAL_MESSAGING_KILL_SWITCH:'false',DFL_MESSAGING_PILOT_PHONE_E164:'5534999999999'};
ok(!next.r32ManualNextStopCanary({},'5534999999999'),'OFF by default');
ok(next.r32ManualNextStopCanary(canary,'5534999999999'),'explicit pilot only');
for(const [k,v] of [['DFL_MANUAL_NEXT_STOP_ENABLED','false'],['DFL_MANUAL_NEXT_STOP_ENABLED',undefined],
 ['DFL_MANUAL_NEXT_STOP_KILL_SWITCH','true'],['DFL_MANUAL_NEXT_STOP_KILL_SWITCH',undefined],
 ['DFL_MANUAL_NEXT_STOP_SCOPE','consented_customers'],['DFL_MANUAL_MESSAGING_ENABLED','false'],
 ['DFL_MANUAL_MESSAGING_KILL_SWITCH','true']])ok(!next.r32ManualNextStopCanary({...canary,[k]:v},'5534999999999'),'gate '+k);
ok(!next.r32ManualNextStopCanary(canary,'5534988888888'),'not any customer');
ok(!next.r32ManualNextStopCanary(canary,'invalid'),'invalid phone');
ok(ready.r32ValidOrderId('12345678'),'audit valid id');
ok(!ready.r32ValidOrderId('../../admin'),'path injection rejected');
ok(!ready.r32ValidOrderId('short'),'nonmatching ID rejected');
const sensitive={status:'suppressed',messaging_event_type:'order.ready',suppressed_reason:'r24_obsolete_ready_stage',
 customer_phone:'5534999999999',opaque_token:'DoNotExpose',provider_api_key:'SECRET',source_event_id:'evt-12345678901234567890'};
const redacted=ready.r32RedactedIntent(sensitive);
ok(redacted.state==='suppressed'&&redacted.reason==='r24_obsolete_ready_stage','suppression explains blocked notice');
ok(!JSON.stringify(redacted).includes('5534999')&&!JSON.stringify(redacted).includes('DoNotExpose'),'do not expose PII');
const out=ready.r32RedactedOutbox({status:'pending',event_type:'order.updated',payload:{status:'Pronto',customer_phone:'SECRET'},customer_phone:'PII'});
ok(out.stage==='Pronto'&&out.state==='pending','ready outbox redacted');
ok(!JSON.stringify(out).includes('SECRET')&&!JSON.stringify(out).includes('PII'),'outbox payload never echoed');
ok(ready.r32ReadyReason({orderExists:false,status:'',outboxCount:0,intents:[],gate:null})==='order_not_found','no order');
ok(ready.r32ReadyReason({orderExists:true,status:'Pronto',outboxCount:0,intents:[],gate:null})==='no_ready_outbox_in_sample','missing event');
ok(ready.r32ReadyReason({orderExists:true,status:'Pronto',outboxCount:1,intents:[{state:'queued'}],gate:null})==='queued_not_delivered','queued is not delivered');
ok(ready.r32ReadyReason({orderExists:true,status:'Pronto',outboxCount:1,intents:[{state:'suppressed'}],gate:null})==='intent_suppressed','suppressed');
const route=read('src/app/api/integration/manual-messaging/route.ts');
ok(route.includes("const EVENTS=new Set(['order.created','delivery.started','delivery.completed'])"),'legacy event set unchanged');
ok(route.includes('const r32NextStop=')&&route.includes('r32ValidManualNextStop(data)'),'new guarded event only');
ok(route.includes('r32ManualNextStopCanary(process.env,phone)'),'separate canary gate before Supabase');
ok(route.indexOf('assertSignedIntegrationRequest(')<route.indexOf('r32ValidManualNextStop(data)'),'HMAC before physical contract');
ok(route.includes('result.body.duplicate===true')&&route.includes('workerWake'),'existing dedupe/wake unchanged');
const api=read('src/app/api/admin/messaging-ready-audit/route.ts');
ok(api.includes('verifyIdToken(bearer,true)')&&api.includes('isAdminEmail(claims.email)'),'admin revocation + role');
ok(api.includes("where('entity_id','==',orderId)")&&api.includes("where('order_id','==',orderId)"),'directed bounded queries');
ok(api.includes('limit(R32_AUDIT_MAX_ROWS)')&&api.includes('no-store'),'bounded reads and no-store');
ok(!/\.update\(|\.create\(|\.delete\(|\.set\(/.test(api),'read only');
ok(!api.includes('customer_phone')&&!api.includes('opaque_token')&&!api.includes('secretKey'),'no PII returned in route');
const ui=read('src/components/admin/R32ReadyAuditCard.tsx');
ok(ui.includes('getIdToken()')&&ui.includes('messaging-ready-audit?orderId='),'secure Admin lookup');
ok(!/useEffect\s*\(|onSnapshot\s*\(|setInterval\s*\(/.test(ui),'no polling');
ok(ui.includes('Queued não significa entregue'),'honest provider status');
const host=read('src/components/admin/MessagingCenterAdmin.tsx');
ok(host.includes('<R32ReadyAuditCard />')&&host.includes('<Dfl360OperationsCard />'),'existing DFL360 UI preserved');
console.log(`R32 Site: ${n} hermetic contracts OK; no real Firestore/Supabase/WhatsApp calls.`);
