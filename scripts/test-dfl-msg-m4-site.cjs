'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const read = p => fs.readFileSync(p,'utf8');
const page = read('src/components/admin/MessagingCenterAdmin.tsx');
const route = read('src/app/api/admin/messaging-readiness/route.ts');
let checks = 0;
const ok = (cond, desc) => {assert.ok(cond, desc);checks++;console.log('MSG-M4 SITE OK:',desc)};
for(const [file,kind] of [['src/components/admin/MessagingCenterAdmin.tsx',ts.ScriptKind.TSX],['src/app/api/admin/messaging-readiness/route.ts',ts.ScriptKind.TS]]){
 const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,kind);
 ok(!source.parseDiagnostics.length,`AST valido ${file}`);
}
ok(route.includes('adminAuth.verifyIdToken(bearer, true)'),'token com revogacao validada');
ok(route.includes('isAdminEmail(decoded.email)'),'somente emails de administradores');
ok(route.indexOf('verifyIdToken(bearer, true)')<route.indexOf("adminDb.collection('integration_notification_intents')"),'sem consultas antes de autorizar');
ok(route.includes(".orderBy('created_at', 'desc').limit(LIMIT).get()"),'amostra limitada e ordenada');
ok(route.includes("const LIMIT = 100"),'limite 100 fixo');
ok(!/\.onSnapshot\(|setInterval\(|setTimeout\(|\.update\(|\.delete\(|\.set\(/.test(route),'sem polling, listener ou writes');
ok(!/customer_phone|customer_name|payload|provider_message_id|secret:\s*process\.env/.test(route),'nao devolve PII, payload ou segredo');
ok(page.includes('onClick={() => void inspectBridges()}'),'consulta exige clique humano');
ok(page.includes("fetch('/api/admin/messaging-readiness'"),'endpoint de diagnostico integrado');
ok(page.includes('controller.abort()'),'timeout fisico na consulta');
ok(page.includes('setBridge(result)'),'mostra dado confirmado, nao inventado');
ok(page.includes("Object.values(bridge.summary.entregas)"),'resumo logistico visivel');
ok(/não confirma entrega no whatsapp/i.test(page),'nao confunde enfileirado com entregue');

(async()=>{
 const compiled=ts.transpileModule(route,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 let queries=0,verified=0;
 const documents=[
   {data:()=>({messaging_source:'site',status:'queued',created_at:'2026-11-05T13:00:00Z',customer_phone:'5534999999999',payload:{private:'no'}})},
   {data:()=>({messaging_source:'entregas',status:'failed',created_at:'2026-11-04T11:00:00Z',last_error:'PRIVATE'})},
   {data:()=>({messaging_source:'entregas',status:'pending',created_at:'2026-11-04T12:00:00Z'})},
 ];
 const modules={
   'next/server':{NextResponse:{json:(body,opts)=>({body,opts})}},
   '@/lib/integration/server/adminAuth':{adminAuth:{verifyIdToken:async token=>{verified++; if(token==='bad')throw Error('bad');return {email:token==='owner'?'admin@example.com':'other@example.com'};}}},
   '@/lib/integration/server/admin':{adminDb:{collection:()=>{queries++;return {orderBy:()=>({limit:n=>{assert.equal(n,100);return {get:async()=>({size:documents.length,docs:documents})}}})}}}},
   '@/lib/adminAuthorization':{isAdminEmail:email=>email==='admin@example.com'},
 };
 const exports={};const module={exports};
 vm.runInNewContext(compiled,{module,exports,require:key=>{if(!(key in modules))throw Error('unexpected module '+key);return modules[key]},process:{env:{}},Date,Number,String,console}, {timeout:1500});
 const GET=module.exports.GET;
 const req=token=>({headers:{get:()=>token?'Bearer '+token:null}});
 const blocked=await GET(req());ok(blocked.opts.status===401,'anonimo bloqueado 401');
 ok(queries===0,'anonimo nao gera leitura Firestore');
 const invalid=await GET(req('bad'));ok(invalid.opts.status===401,'token invalido bloqueado');
 const denied=await GET(req('stranger'));ok(denied.opts.status===403,'outro usuario bloqueado');
 ok(queries===0,'sem leitura para usuarios proibidos');
 const allowed=await GET(req('owner'));ok(allowed.opts.status===200 && allowed.body.ok===true,'admin autorizado consulta resumo');
 ok(allowed.body.summary.entregas.failed===1 && allowed.body.summary.entregas.pending===1,'classifica falha e pendencia do Entregas');
 ok(allowed.body.summary.site.queued===1,'classifica aceite da fila do Site');
 ok(!JSON.stringify(allowed.body).includes('5534999999999') && !JSON.stringify(allowed.body).includes('PRIVATE'),'resposta sem PII ou erro bruto');
 ok(verified===3,'todos os tokens passaram por verificacao');
 console.log(`MSG-M4 SITE: ${checks} contratos aprovados, ZERO rede/WhatsApp/Firestore real.`);
})().catch(e=>{console.error(e);process.exit(1)})
