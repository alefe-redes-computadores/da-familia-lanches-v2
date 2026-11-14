#!/usr/bin/env node
'use strict';
/** R70 site: hermetic signed routing, no network or real WhatsApp. */
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),crypto=require('node:crypto');
let n=0;const ok=(b,msg)=>{assert.ok(b,'R70 SITE '+msg);n++};
const path='src/app/api/integration/manual-tracking/route.ts';
const src=fs.readFileSync(path,'utf8');
const transport=fs.readFileSync('src/lib/tracking/r27ProviderTransport.ts','utf8');
const syntax=ts.createSourceFile(path,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
ok(syntax.parseDiagnostics.length===0,'AST Site');
ok(transport.includes("source:'site'|'manual'='site'"),'fonte site continua padrão');
ok(transport.includes('`entregas:${input.order_id}`'),'origem separada do Site');
ok(transport.includes("source==='manual'&&!/^dfl-"),'ID manual forte');
ok(!/console\.|localStorage|sessionStorage/.test(src),'não registra token ou dados privados');
const js=ts.transpileModule(src,{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
let sends=0;
const requires={
 'next/server':{NextResponse:{json:(data,opts)=>({data,status:opts.status})}},
 '@/lib/integration/server/signature':{assertSignedIntegrationRequest:x=>{if(x.signature!=='approved'||x.expectedEventId!==x.eventId)throw Error('signature');}},
 '@/lib/tracking/r27ProviderTransport':{r27SendToProvider:async(input,source)=>{sends++;ok(source==='manual','manual source');ok(input.order_id.startsWith('dfl-'),'manual id');return {result:'accepted_by_provider',provider_event_id:'provider-event-8888'};}},
 '@/lib/tracking/r27ProviderPolicy':{r27DispatchConfigured:env=>env.DFL_SITE_TRACKING_ENABLED==='1',r27ValidHandoffInput:v=> /^dfl-[\w-]{12,75}$/.test(v.order_id)&& /^https:\/\/dafamilialanches.com.br\/acompanhar#t=[A-Za-z0-9_-]{43}$/.test(v.url)&&/^\+55\d{11}$/.test(v.recipient_e164)&&Date.parse(v.expires_at)>Date.now()&&Date.parse(v.expires_at)<Date.now()+91*60_000},
};
const m={exports:{}};
new Function('require','module','exports',js)(id=>{if(id in requires)return requires[id];throw Error('unexpected module '+id)},m,m.exports);
const prev=process.env;
const ready={...process.env,DFL_SITE_TRACKING_ENABLED:'1',DFL_MANUAL_MESSAGING_ENABLED:'true',DFL_MANUAL_MESSAGING_SCOPE:'consented_customers',DFL_MANUAL_MESSAGING_ROLLOUT_APPROVED:'true',DFL_MANUAL_MESSAGING_KILL_SWITCH:'false'};
const order='dfl-12345678-1234-1234-1234-123456789abc';
const envelope={contract:'dfl.tracking.manual.handoff.v1',version:1,action:'send_initial',
  event_id:`manual-tracking-initial__${order}`,delivery_id:order,recipient_e164:'+5534999999999',
  tracking_link:'https://dafamilialanches.com.br/acompanhar#t='+'A'.repeat(43),
  expires_at:new Date(Date.now()+90*60000).toISOString(),consent_granted:true};
const req=(body,signature='approved')=>({text:async()=>JSON.stringify(body),headers:{get:n=>n==='x-dfl-signature'?signature:n==='x-dfl-event-id'?body.event_id:'other'}});
(async()=>{
  process.env={...ready,DFL_MANUAL_MESSAGING_ENABLED:'false'};
  let x=await m.exports.POST(req(envelope));ok(x.status===403,'switch OFF');ok(sends===0,'OFF zero provider');
  process.env=ready;
  x=await m.exports.POST(req(envelope));ok(x.status===200&&x.data.result==='accepted_by_provider','signed eligible handoff');ok(sends===1,'one forward');
  x=await m.exports.POST(req(envelope,'invalid'));ok(x.status===401&&sends===1,'HMAC invalid denied');
  x=await m.exports.POST(req({...envelope,consent_granted:false}));ok(x.status===422,'no consent denied');
  x=await m.exports.POST(req({...envelope,tracking_link:'https://evil.test/acompanhar#t='+'A'.repeat(43)}));ok(x.status===422,'host change denied');
  x=await m.exports.POST(req({...envelope,expires_at:new Date(Date.now()+120*60000).toISOString()}));ok(x.status===422,'too long TTL denied');
  x=await m.exports.POST(req({...envelope,delivery_id:'other'}));ok(x.status===422,'untrusted ID denied');
  ok(sends===1,'bad inputs never provider');
  console.log(`R70 SITE: ${n} verificações herméticas OK; zero rede real, WhatsApp e Firestore.`);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{process.env=prev});
