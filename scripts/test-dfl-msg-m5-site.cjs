'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
let checks=0;const check=(value,reason)=>{assert.ok(value,reason);checks++};
for(const [path,kind] of [
 ['src/lib/messaging/retryPolicy.ts',ts.ScriptKind.TS],
 ['src/app/api/admin/messaging/retry/route.ts',ts.ScriptKind.TS],
 ['src/app/api/admin/messaging/route.ts',ts.ScriptKind.TS],
 ['src/components/admin/MessagingCenterAdmin.tsx',ts.ScriptKind.TSX],
]){
  check(ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,kind).parseDiagnostics.length===0,`AST ${path}`);
}
const lib=read('src/lib/messaging/retryPolicy.ts');
const post=read('src/app/api/admin/messaging/retry/route.ts');
const get=read('src/app/api/admin/messaging/route.ts');
const ui=read('src/components/admin/MessagingCenterAdmin.tsx');
const css=read('src/components/admin/MessagingCenterAdmin.module.css');
const entFile=read('scripts/test-site-msg-m3.cjs');
check(post.includes('adminAuth.verifyIdToken(bearer,true)'), 'auth token revogado');
check(post.includes('isAdminEmail(user.email)'), 'owner admin');
check(post.includes('DFL_MESSAGING_RETRY_OWNER_UID') && post.includes('DFL_MESSAGING_MANUAL_RETRY_ENABLED'), 'gatilho OFF por padrão');
check(post.includes('adminDb.runTransaction'), 'contagem transacional');
check(post.includes("attempts:5") && post.includes('manual_retry_count:oldCount+1'), 'uma tentativa por toque com contador persistente');
check(post.includes("tx.get(adminDb.collection('Pedidos').doc(orderId))"), 'estado comercial lido em transação');
check(post.includes('drainMessagingIntentFastLane(id)'), 'fastlane existente, sem novo provedor');
check(!post.includes('EVOLUTION_API_KEY') && !post.includes('customer_phone'), 'não expõe API ou telefones');
check(get.includes('retryEnabled:') && get.includes('evaluateManualRetry'), 'estado de retry vem do servidor');
check(ui.includes("fetch('/api/admin/messaging/retry'"), 'somente retry autenticado');
check(ui.includes('confirmRetry === item.id') && ui.includes('Confirmar nova tentativa única'), 'confirmação explícita');
check(ui.includes('item.retry.explanation') && ui.includes('item.retry.remaining'), 'motivo + tentativas visíveis');
check(!ui.includes('onSnapshot(') && !ui.includes('setInterval('),'sem polling');
check(css.includes('.retryCard') && css.includes('.retryActions'), 'visual premium');
check(entFile.includes('MSG-M5: reenvio apenas pelo servidor'), 'legado M3 compatível sem permitir fetch livre');
const evaluate=()=>{
 const m={exports:{}},output=ts.transpileModule(lib,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(output,{module:m,exports:m.exports,require,Date,Number,String,Math,Object}, {timeout:1500});
 return m.exports;
};
const policy=evaluate();const now=Date.now(),iso=(delta)=>new Date(now+delta).toISOString();
const test=(error,expected)=>check(policy.classifyFailure(error).category===expected,error);
test('HTTP 401 unauthorized','blocked_auth');test('SKIPPED_ORDER_CANCELLED','blocked_cancelled');
test('EVOLUTION_NOT_CONFIGURED','blocked_config');test('missing phone','blocked_data');
test('http_503','transient_service');test('fetch failed','transient_network');
test('429 too many requests','transient_rate_limit');test('UNKNOWN_PRIVATE','unknown');
const good=(count=0,last=iso(-10*60000),created=iso(-3600000))=>policy.evaluateManualRetry({status:'failed',error:'timeout',manualRetryCount:count,manualRetryAt:last,createdAt:created,now});
check(good().retryable,'retry 1 permitido');check(good(1).retryable,'retry 2 permitido');
check(good(2).reason==='limit_reached','terceira bloqueada');
check(good(1,iso(-30000)).reason==='cooldown','cooldown');
check(good(0,iso(-3600000),iso(-49*3600000)).reason==='too_old','evento velho');
check(policy.evaluateManualRetry({status:'queued',error:'timeout',manualRetryCount:0,manualRetryAt:null,createdAt:iso(-3600000),now}).reason==='not_failed','queued nao repete');
check(policy.evaluateManualRetry({status:'failed',error:'wrong token 403',manualRetryCount:0,manualRetryAt:null,createdAt:iso(-3600000),now}).reason==='permanent','401/403 nao repete');

(async()=>{
 const compiled=ts.transpileModule(post,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const data={status:'failed',messaging_eligible:false,manual_retry_count:0,manual_retry_at:iso(-800000),created_at:iso(-3600000),last_error:'timeout',order_id:'order-1234',messaging_event_type:'delivery.started'};
 let updates=0,lanes=0,reads=0;
 const intent={exists:true,data:()=>data};
 const order={exists:true,data:()=>({status:'Saiu para Entrega'})};
 const db={collection(name){return {doc(id){return {name,id}}}}, async runTransaction(callback){
   const tx={get:async ref=>{reads++;return ref.name==='Pedidos'?order:intent},update(ref,fields){Object.assign(data,fields);updates++}};
   return callback(tx);
 }};
 const modules={
 'next/server':{NextResponse:{json:(body,opts)=>({body,opts})}},
 '@/lib/integration/server/adminAuth':{adminAuth:{verifyIdToken:async tok=>tok==='owner'?{uid:'ownerUid',email:'admin@dfl.test'}: {uid:'other',email:'admin@dfl.test'}}},
 '@/lib/integration/server/admin':{adminDb:db},
 '@/lib/adminAuthorization':{isAdminEmail:(e)=>e==='admin@dfl.test'},
 '@/lib/integration/server/messagingFastLane':{drainMessagingIntentFastLane:async()=>{lanes++;return {attempted:true,queued:true}}},
 '@/lib/messaging/retryPolicy':policy,
 };
 const m={exports:{}};const env={DFL_MESSAGING_INGEST_URL:'https://test.example',DFL_MESSAGING_INGEST_TOKEN:'secret'};
 vm.runInNewContext(compiled,{module:m,exports:m.exports,require:k=>{assert.ok(modules[k],k);return modules[k]},process:{env},Date,Math,String,Number,console}, {timeout:1500});
 const req=(who='owner',id='intent-msg-v1__abc')=>({headers:{get:key=>key==='authorization'?`Bearer ${who}`:''},text:async()=>JSON.stringify({action:'retry',id})});
 check((await m.exports.POST(req())).opts.status===403,'OFF bloqueia antes do banco');
 check(reads===0 && updates===0 && lanes===0,'OFF sem side effects');
 env.DFL_MESSAGING_MANUAL_RETRY_ENABLED='true'; env.DFL_MESSAGING_RETRY_OWNER_UID='ownerUid';
 check((await m.exports.POST(req('other'))).opts.status===403,'nonowner bloqueado');
 check(reads===0,'nonowner sem banco');
 const first=await m.exports.POST(req());
 check(first.body.ok && first.body.remaining===1 && updates===1 && lanes===1,'primeira tentativa unica');
 check(data.manual_retry_count===1 && data.attempts===5 && data.status==='pending','contagem persistida e status preparado');
 check((await m.exports.POST(req())).opts.status===409,'toque repetido nao repete');
 check(updates===1,'sem escrita duplicada');
 Object.assign(data,{status:'failed',messaging_eligible:false,last_error:'timeout',manual_retry_at:iso(-500000)});
 const second=await m.exports.POST(req());
 check(second.body.ok && second.body.remaining===0 && updates===2 && lanes===2,'segunda tentativa unica');
 Object.assign(data,{status:'failed',messaging_eligible:false,last_error:'timeout',manual_retry_at:iso(-500000)});
 check((await m.exports.POST(req())).opts.status===409,'terceira tentativa bloqueada');
 check(updates===2 && lanes===2,'limite nao altera fila nem chama worker');
 console.log(`MSG-M5 SITE: ${checks} verificações isoladas OK, ZERO rede real.`);
})().catch(error=>{console.error(error);process.exitCode=1});
