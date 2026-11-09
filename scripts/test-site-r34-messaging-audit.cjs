#!/usr/bin/env node
'use strict';
/** R34: no network, no real Supabase, Firestore, Evolution, WhatsApp or writes. */
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),crypto=require('node:crypto');
const ts=require('typescript');let okCount=0;
const ok=(test,label)=>{assert.ok(test,label);okCount++};
const read=p=>fs.readFileSync(p,'utf8');
const files=['src/lib/messaging/r34AuditPolicy.ts','src/app/api/admin/messaging-360-audit/route.ts','src/components/admin/R34MessagingAuditCard.tsx','src/components/admin/R32ReadyAuditCard.tsx','docs/integration/r34-audit/index.ts.txt'];
for(const p of files){const s=read(p),parsed=ts.createSourceFile(p.endsWith('.txt')?'edge.ts':p,s,ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);ok(parsed.parseDiagnostics.length===0,'TS parse '+p);}
function load(src,deps={},context={}){
 const code=ts.transpileModule(src,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const module={exports:{}};vm.runInNewContext(code,{module,exports:module.exports,require:(id)=>{if(Object.hasOwn(deps,id))return deps[id];throw Error('unexpected require '+id)},Date,Number,String,Map,Set,URL,URLSearchParams,AbortController,AbortSignal,Headers,Request,Response,TextEncoder,TextDecoder,Uint8Array,crypto:crypto.webcrypto,process:{env:{}},...context},{timeout:2000});return module.exports;
}
const policy=load(read('src/lib/messaging/r34AuditPolicy.ts'));
const q={source:'manual',orderId:'entregas:dfl-12345678-1234-1234-1234-123456789abc',eventType:'order.ready'};
ok(policy.r34ValidQuery(q),'manual valid');
ok(policy.r34ValidQuery({...q,source:'site',orderId:'ORDER_123456789'}),'site valid');
ok(policy.r34ValidQuery({...q,source:'entregas',orderId:'ORDER_123456789'}),'entregas valid');
for(const bad of [
 {...q,source:'unknown'}, {...q,orderId:'dfl-123456789012'},
 {...q,orderId:'../../secret'}, {...q,eventType:'send_now'},
 {...q,eventType:'all',phone:'5534999999999'},
 {...q,orderId:'entregas:dfl-123456789abc?x=1'},
 {...q,source:'site'}, {...q,orderId:'entregas:dfl-1'},
])ok(!policy.r34ValidQuery(bad),'query rejects invalid '+JSON.stringify(bad).slice(0,50));
const iso=new Date().toISOString();
const rec={eventType:'order.ready',state:'sent',fingerprint:'a'.repeat(16),createdAt:iso,sentAt:iso,providerAccepted:true,failureCode:null};
const reply={contract:'dfl.messaging.audit.v1',version:1,ok:true,source:'manual',orderId:q.orderId,eventType:q.eventType,checkedAt:iso,records:[rec],sampleLimited:false,customerDeliveryVerified:false};
ok(policy.r34ValidAuditReply(reply,q),'valid sanitized reply');
for(const bad of [
 {...reply,customerDeliveryVerified:true},
 {...reply,phone:'5534999999999'},
 {...reply,records:[{...rec,customer_phone:'5534999999999'}]},
 {...reply,records:[{...rec,providerMessageId:'EVOLUTION-ID'}]},
 {...reply,records:[{...rec,fingerprint:'raw_event_id'}]},
 {...reply,records:[{...rec,eventType:'other'}]},
 {...reply,records:[{...rec,state:'delivered'}]},
 {...reply,records:[{...rec,failureCode:'phone + password'}]},
 {...reply,records:[{...rec,createdAt:'invalid'}]},
 {...reply,records:Array.from({length:25},()=>rec)},
 {...reply,source:'site'}, {...reply,eventType:'delivery.started'}
])ok(!policy.r34ValidAuditReply(bad,q),'response rejects extra/PII or invalid '+JSON.stringify(bad).slice(0,70));
const site=read('src/app/api/admin/messaging-360-audit/route.ts'), edge=read('docs/integration/r34-audit/index.ts.txt'),ui=read('src/components/admin/R34MessagingAuditCard.tsx'),host=read('src/components/admin/R32ReadyAuditCard.tsx');
for(const marker of ["verifyIdToken(bearer,true)","isAdminEmail(claims.email)","DFL_MESSAGING_WORKER_TOKEN","redirect:'error'","cache:'no-store'","r34ValidAuditReply(data,query)"])
 ok(site.includes(marker),'site security: '+marker);
for(const marker of ['Deno.serve','boundedText(req)','async function equal','select(\'source_event_id,event_type,status,created_at,sent_at,provider_message_id,last_error\')','.eq(\'source\',source).eq(\'order_id\',orderId)','limit(25)','data.slice(0,24)','customerDeliveryVerified:false'])
 ok(edge.includes(marker),'edge security: '+marker);
ok(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(/.test(edge),'edge read-only');
ok(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(/.test(site),'Next read-only');
ok(!/setInterval|useEffect\s*\(|onSnapshot\s*\(/.test(ui),'manual only no polls');
ok(host.includes('<R34MessagingAuditCard />'),'existing R32 audit preserved and R34 added');
ok(!ui.includes('x-dfl-messaging-worker-token')&&!ui.includes('DFL_MESSAGING_WORKER_TOKEN'),'secret never client');
let handler=null,dbReads=0,dbWrites=0;
const rows=[{source_event_id:'evt-sensitive-123',event_type:'order.ready',status:'sent',created_at:iso,sent_at:iso,provider_message_id:'PRIVATE_PROVIDER_123',last_error:null,customer_phone:'5534999999999',payload:{opaque_token:'SECRET'}}];
const supabase={from(table){ok(table==='dfl_messaging_outbox','query only messaging table');dbReads++;
 const query={select(cols){ok(!cols.includes('customer_phone')&&!cols.includes('payload'),'query projection excludes private fields');return this},eq(){return this},order(){return this},limit(n){ok(n===25,'query strict limit');return Promise.resolve({data:rows,error:null})},insert(){dbWrites++;throw Error('no write')}};return query;}};
const edgeDep={'npm:@supabase/supabase-js@2.75.0':{createClient:()=>supabase}};
load(edge,edgeDep,{Deno:{env:{get:(k)=>({DFL_MESSAGING_WORKER_TOKEN:'T'.repeat(48),SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'SECRET_SERVICE_ROLE'})[k]||''},serve:(f)=>{handler=f}}});
ok(typeof handler==='function','Deno handler captured');
const body=JSON.stringify({contract:'dfl.messaging.audit.v1',version:1,source:'manual',order_id:q.orderId,event_type:q.eventType});
const request=(token,data=body)=>new Request('https://fixture.supabase.co/functions/v1/dfl-messaging-audit',{method:'POST',headers:{'x-dfl-messaging-worker-token':token,'content-type':'application/json'},body:data});
(async()=>{
 let r=await handler(request('not_the_token'));ok(r.status===401,'unauthorized 401');ok(dbReads===0,'unauthorized zero reads');
 r=await handler(request('T'.repeat(48),JSON.stringify({...JSON.parse(body),phone:'5511111111111'})));ok(r.status===422,'extra fields reject');ok(dbReads===0,'bad input zero reads');
 r=await handler(request('T'.repeat(48)));ok(r.status===200,'valid query accepted');
 const data=await r.json();ok(policy.r34ValidAuditReply(data,q),'real Edge reply matches Site policy');
 ok(!JSON.stringify(data).includes('5534999999999')&&!JSON.stringify(data).includes('PRIVATE_PROVIDER_123')&&!JSON.stringify(data).includes('SECRET'),'no PII/credential in reply');
 ok(data.records[0].providerAccepted===true,'provider ACK boolean, not delivered');ok(data.customerDeliveryVerified===false,'no fabricated delivery');ok(dbWrites===0,'zero DB mutations');
 // Admin proxy: auth before any remote query; domain is fixed and server-side.
 let fetchCalls=0,authCalls=0,allow=true;
 const mockNext={NextResponse:{json:(b,opts)=>({status:opts?.status||200,body:b,headers:opts?.headers})}};
 const proxy=load(site,{'next/server':mockNext,'@/lib/integration/server/adminAuth':{adminAuth:{verifyIdToken:async()=>{authCalls++;return {email:'admin@fixture.test'}}}},'@/lib/adminAuthorization':{isAdminEmail:()=>allow},'@/lib/messaging/r34AuditPolicy':policy},
 {process:{env:{DFL_MESSAGING_WORKER_TOKEN:'T'.repeat(48)}},fetch:async(url,opt)=>{fetchCalls++;ok(url===policy.R34_AUDIT_URL,'fixed Supabase URL');ok(opt.headers['x-dfl-messaging-worker-token']==='T'.repeat(48),'server-only auth');ok(opt.method==='POST'&&opt.cache==='no-store','read-only POST to audit function');return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}})}});
 const req=(auth,qry)=>({headers:{get:(k)=>k==='authorization'?auth:null},nextUrl:{searchParams:{get:(k)=>qry[k]||null}}});
 let out=await proxy.GET(req('',{source:q.source,orderId:q.orderId,eventType:q.eventType}));ok(out.status===401,'no firebase bearer');ok(fetchCalls===0,'no remote request unauthenticated');
 allow=false;out=await proxy.GET(req('Bearer token',{source:q.source,orderId:q.orderId,eventType:q.eventType}));ok(out.status===403,'nonadmin blocked');ok(fetchCalls===0,'no remote request nonadmin');
 allow=true;out=await proxy.GET(req('Bearer token',{source:q.source,orderId:'invalid/id',eventType:q.eventType}));ok(out.status===422,'input validation before remote');ok(fetchCalls===0,'no remote for invalid query');
 out=await proxy.GET(req('Bearer token',{source:q.source,orderId:q.orderId,eventType:q.eventType}));ok(out.status===200,'valid admin audit');ok(out.body.customerDeliveryVerified===false,'proxy retains non-delivery');ok(fetchCalls===1,'one-shot only');
 console.log(`R34 MENSAGERIA 360: ${okCount} verificações herméticas OK; 0 envios, 0 escritas, 0 rede real.`);
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
