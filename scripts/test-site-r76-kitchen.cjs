#!/usr/bin/env node
'use strict';
/** Sem rede. Contrato Site e separação pickup vs kitchen. */
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
let checks=0;const ok=(v,n)=>{assert.ok(v,`R76 SITE: ${n}`);checks++};
const policy='src/lib/messaging/r76KitchenPolicy.ts',route='src/app/api/integration/manual-messaging/route.ts';
for(const p of [policy,route]){const ast=ts.createSourceFile(p,fs.readFileSync(p,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);ok(ast.parseDiagnostics.length===0,'AST '+p);}
const js=ts.transpileModule(fs.readFileSync(policy,'utf8'),{fileName:policy,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};new Function('module','exports',js)(m,m.exports);
const {r76KitchenEnabled:enabled,r76ValidKitchenEvent:valid,r76KitchenAudienceAllowed:audience}=m.exports;
const env={DFL_R76_KITCHEN_ENABLED:'true',DFL_R76_KITCHEN_KILL_SWITCH:'false',DFL_R76_KITCHEN_ROLLOUT_APPROVED:'true',DFL_R76_KITCHEN_WORKER_CERTIFIED:'true',DFL_MANUAL_MESSAGING_ENABLED:'true',DFL_MANUAL_MESSAGING_KILL_SWITCH:'false'};
const pilotEnv={...env,DFL_MESSAGING_PILOT_PHONE_E164:'5534999999999',DFL_R76_KITCHEN_AUDIENCE_MODE:'pilot',DFL_R76_KITCHEN_GENERAL_APPROVED:'false'};
ok(audience(pilotEnv,'5534999999999'),'pilot allowed');
ok(!audience(pilotEnv,'5534988888888'),'other phone forbidden');
ok(!audience({...pilotEnv,DFL_MESSAGING_PILOT_PHONE_E164:undefined},'5534999999999'),'missing pilot denied');
ok(!audience({...pilotEnv,DFL_R76_KITCHEN_AUDIENCE_MODE:'general'},'5534988888888'),'unapproved general denied');
ok(audience({...pilotEnv,DFL_R76_KITCHEN_AUDIENCE_MODE:'general',DFL_R76_KITCHEN_GENERAL_APPROVED:'true'},'5534988888888'),'explicit general allowed');
ok(enabled(env),'all gates on');for(const [k,v] of Object.entries(env))ok(!enabled({...env,[k]:v==='true'?'false':'true'}),'fail closed '+k);
const now=Date.now(),created=new Date(now-120000).toISOString(),started=new Date(now-60000).toISOString(),ready=new Date(now-30000).toISOString(),id='dfl-12345678-1234-1234-1234-123456789abc',key='a'.repeat(64);
const payload={delivery_stage_v1:true,delivery_id:id,fulfillment_mode:'delivery',logistics_provider:'dfl',origin:'loja',source_system:'dfl_entregas',notify_whatsapp:true,manual_messaging_opt_in_v1:true,created_at:created,preparation_started_at:started,transition_key:key};
const entry=(type,p,at)=>({source:'manual',event_type:type,event_id:`manual-msg-v2__${type}__${id}__${key}`,order_id:`entregas:${id}`,occurred_at:at,payload:p});
const prep=entry('order.production',payload,started),finished=entry('order.ready',{...payload,preparation_ready_at:ready},ready);
ok(valid(prep,now,created),'valid production');ok(valid(finished,now,created),'valid ready');
for(const field of ['delivery_stage_v1','notify_whatsapp','manual_messaging_opt_in_v1'])ok(!valid({...prep,payload:{...payload,[field]:false}},now,created),'consent/marker '+field);
for(const invalid of [{...prep,source:'site'},{...prep,event_id:'bad'},{...prep,order_id:'entregas:other'},{...prep,occurred_at:ready},{...prep,payload:{...payload,preparation_ready_at:ready}},{...prep,payload:{...payload,fulfillment_mode:'pickup'}},{...prep,payload:{...payload,logistics_provider:'ifood'}},{...prep,payload:{...payload,origin:'unknown'}},{...prep,payload:{...payload,source_system:'dfl_site'}}])ok(!valid(invalid,now,created),'invalid envelope');
ok(!valid(finished,now,new Date(now+100000).toISOString()),'pre activation');
ok(!valid({...finished,occurred_at:new Date(now-600000).toISOString()},now,created),'stale');
const source=fs.readFileSync(route,'utf8');for(const anchor of ['const kitchenEnvelope=','r76ValidKitchenEvent','r76KitchenEnabled','assertSignedIntegrationRequest','r33ValidManualPickup','r32ValidManualNextStop'])ok(source.includes(anchor),'route '+anchor);
ok(source.includes('!kitchenEnvelope'),'pickup remains separate');
ok(source.includes('r76KitchenAudienceAllowed(process.env,phone)'),'site audience guard');
console.log(`R76 P2 SITE: ${checks} verificações herméticas OK, sem rede nem envios.`);
