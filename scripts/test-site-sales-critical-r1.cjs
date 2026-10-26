'use strict';
/**
 * DFL SITE P0 Sales Gate R1.
 * Executes the REAL TypeScript /api/orders POST with a strict in-memory Firestore
 * transaction. Never contacts Firebase, Vercel, WhatsApp or the real admin.
 * Detects regressions in serialization, idempotency, pricing and durable queues.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const filename = 'src/app/api/orders/route.ts';
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, {
  fileName: filename, reportDiagnostics: true,
  compilerOptions: {target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}
});
assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,'API compilavel');

// A mock must be strict enough to reproduce the exact type of Firestore failure
// that caused the real 2026-10-25 outage (undefined nested in a product).
function checkFirestoreValue(x, path='document') {
  assert.notEqual(x,undefined,`Firestore rejects undefined at ${path}`);
  if (x===null || typeof x!=='object' || x instanceof Date) return;
  if (Array.isArray(x)) { x.forEach((item,i)=>checkFirestoreValue(item,`${path}[${i}]`)); return; }
  if (Object.getPrototypeOf(x)!==Object.prototype) return; // timestamps/increments
  for (const [k,v] of Object.entries(x)) checkFirestoreValue(v,`${path}.${k}`);
}
const docs = new Map();
const actions = {after:[], relay:0, push:0, traces:[], transactions:0, failures:0};
let injectedFailure = null;
const snapshot=(ref)=>{const data=docs.get(ref.path);return {id:ref.id,ref,exists:data!==undefined,data:()=>data};};
const ref=(path)=>({path,id:path.split('/').pop()});
const firestore={
  doc(path){return ref(path);},
  collection(name){return {doc(id){return ref(`${name}/${id}`)}}},
  async runTransaction(fn){
    actions.transactions++;
    const pending=[];
    const tx={
      async get(reference){return snapshot(reference);},
      create(reference,data){pending.push(['create',reference,data]);},
      set(reference,data,options){pending.push(['set',reference,data,options]);},
      update(reference,data){pending.push(['update',reference,data]);},
    };
    const outcome=await fn(tx);
    if (injectedFailure){const e=injectedFailure;injectedFailure=null;actions.failures++;throw e;}
    for (const [op,r,d] of pending){
      checkFirestoreValue(d,r.path);
      if(op==='create') assert(!docs.has(r.path),`create cannot overwrite: ${r.path}`);
    }
    for(const [op,r,d] of pending){
      docs.set(r.path,op==='create'?d:{...(docs.get(r.path)||{}),...d});
    }
    return outcome;
  }
};
// Realistic snapshot metadata; only an in-process sandbox.
docs.set('settings/delivery',{defaultFee:6});
docs.set('settings/commercial',{});
docs.set('settings/loja',{mode:'force_open'});
docs.set('TaxasDeEntrega/bairros/lista/tabela',{data:[{nome:'Centro',taxa:6}]});
const fv=()=>({kind:'server-timestamp'});
const fieldValue={serverTimestamp:fv,increment:(n)=>({kind:'increment',value:n})};
class Timestamp { toMillis(){return Date.now();} }
const fallbackProduct={id:'sale-test',name:'Teste de venda',category:'lanches',description:'',image:'',price:20,disponivel:true,
  minAddonSelections:undefined,maxAddonSelections:undefined,addonGroups:undefined,detailsTitle:undefined,detailsItems:undefined,
  addonIds:['cheese'],bundleItems:undefined};
const fakeModules={
  'next/server':{
    after(callback){actions.after.push(callback);},
    NextResponse:{json(payload,opts={}){return {status:opts.status||200,body:payload,headers:opts.headers||{}}}}
  },
  '@ctrl/crypto':crypto,
  '@/lib/integration/server/adminAuth':{adminAuth:{verifyIdToken:async()=>({uid:'client-uid',email:'buyer@example.invalid',name:'Cliente'})}},
  'firebase-admin/firestore':{FieldValue:fieldValue,Timestamp},
  '@/lib/integration/server/admin':{adminDb:firestore},
  '@/lib/adminPush/server':{sendAdminNewOrderPush:async()=>{actions.push++;return {sent:1}}},
  '@/data/products':{products:[fallbackProduct]},
  '@/data/addons':{ADDONS:[{id:'cheese',name:'Queijo',price:3,disponivel:true}]},
  '@/lib/integration/orderEvents':{buildOrderCreatedEvent:({orderId,order,occurredAt})=>({
    event_id:`evt-v1__order.created__${orderId}__created`,event_type:'order.created',
    occurred_at:occurredAt,source_system:'dfl_site',entity_type:'order',entity_id:orderId,
    schema_version:1,payload:{orderId,total:order.total}
  })},
  '@/lib/integration/contracts':{buildOutboxRecord:(event,now)=>({...event,status:'pending',attempts:0,created_at:now,updated_at:now})},
  '@/lib/integration/firestore':{INTEGRATION_COLLECTIONS:{outbox:'integration_outbox'}},
  '@/lib/schedulingConfig':{capacityForTime:()=>5,normalizeSchedulingConfig:()=>({}),scheduleSlotId:(v)=>v},
  '@/lib/storeSchedule':{
    normalizeStoreSettings:(data)=>({mode:data?.mode||'auto',testAllowedEmails:data?.testAllowedEmails||[]}),
    evaluateStoreStatus:(settings)=>({isOpen:settings.mode==='force_open'||settings.mode==='auto'}),
    canPlaceImmediateTestOrder:(settings,email)=>settings.mode==='test_open' &&
      Boolean(email)&&settings.testAllowedEmails.includes(String(email).toLowerCase()),
  },
  '@/lib/orderSchedulePolicy':{isScheduledValueAllowed:()=>true},
  '@/lib/catalogAddonPolicy':{addonPolicy:()=>({valid:true}),validAddonSelection:()=>true},
  '@/lib/catalogModifierGroups':{productGroupConfiguration:()=>({valid:true}),inspectProductSelections:()=>({valid:true})},
  '@/lib/commercialSettings':{normalizeCommercialSettings:()=>({}),freeDeliveryThreshold:()=>null},
  '@/lib/addressIntelligence':{inspectDistrict:(d)=>({valid:String(d||'').trim().length>=3}),matchDeliveryRate:(d,rates)=>rates.find(r=>r.nome===d)},
  '@/lib/integration/server/relay':{drainIntegrationOutboxEvent:async()=>{actions.relay++;return {sent:1,failed:0}}},
  '@/lib/server/observability':{errorCode:(e)=>e?.code||e?.name||'Error',startRouteTrace:()=>({id:'trace-test',startedAt:Date.now(),route:'orders.create'}),finishRouteTrace:(tr,outcome,details)=>actions.traces.push({outcome,details})}
};
const exportsObject={};
const sandboxModule={exports:exportsObject};
function fakeRequire(name){ if(name==='node:crypto') return crypto; if(Object.hasOwn(fakeModules,name)) return fakeModules[name]; throw Error(`Sales gate: unexpected import ${name}`); }
new Function('require','module','exports','console',compiled.outputText)(fakeRequire,sandboxModule,exportsObject,{info(){},log(){},warn(){},error(){}});
const route=sandboxModule.exports.POST;
assert.equal(typeof route,'function','Real POST export detected');
let unique=0;
const nextAttempt=()=>`sale_gate_${String(++unique).padStart(22,'0')}`;
function input(override={}){
 const id=override.clientRequestId||nextAttempt();
 const q=override.quantity||1;
 const addons=override.addons||[];
 const cost=(20+ (addons.includes('cheese')?3:0))*q;
 const mode=override.deliveryMode||'pickup';
 const fee=mode==='delivery'?6:0;
 const discount=override.discountAmount||0;
 const order={clientRequestId:id,itens:[{id:'sale-test',quantity:q,selectedAddons:addons.map(id=>({id})),observation:''}],
   userName:'Cliente Teste',userPhone:'(34) 99999-9999',subtotal:cost,taxaEntrega:fee,desconto:discount,total:cost+fee-discount,
   endereco:mode==='pickup'?'RETIRADA NO LOCAL':'Rua de Teste, 15 - Centro',tipoEntrega:mode,metodoPagamento:'pix',
   isAgendamento:override.scheduled||false,scheduledFor:override.scheduled?'2026-11-01T19:00:00-03:00':null,
   customerSnapshot:{name:'Cliente Teste'},deliverySnapshot:mode==='pickup'?null:{cep:'38700-000',street:'Rua de Teste',number:'15',district:override.district||'Centro',complement:'',reference:''}};
 return {subtotal:cost,order,...(override.discountCode?{discount:{code:override.discountCode,expectedDiscount:discount}}:{})};
}
const request=(payload,auth=false)=>({headers:{get:(k)=>k.toLowerCase()==='authorization'&&auth?'Bearer client-test-token':null},text:async()=>JSON.stringify(payload)});
const call=(p,auth=false)=>route(request(p,auth));
let ok=0;
async function check(name,fn){try{await fn();++ok;console.log('✓',name);}catch(e){console.error('✗',name);throw e;}}
(async()=>{
 await check('Convidado: POST real grava pedido + duas filas atomicamente',async()=>{
  const p=input();const before=actions.after.length;const result=await call(p);
  assert.equal(result.status,201,JSON.stringify(result.body));assert.equal(result.body.ok,true);
  assert(result.body.id.startsWith('site_'));
  assert(docs.has('Pedidos/'+result.body.id));
  assert([...docs.keys()].some(k=>k.startsWith('integration_outbox/')));
  assert([...docs.keys()].some(k=>k.startsWith('AdminPushDispatches/')));
  assert.equal(actions.after.length,before+1);
  assert.equal(actions.relay,0);assert.equal(actions.push,0);
  const order=docs.get('Pedidos/'+result.body.id);checkFirestoreValue(order);
  assert.equal(order.itens[0].price,20);assert.equal(order.total,20);
  const nested=order.itens[0];assert(!Object.hasOwn(nested,'addonGroups'),'Campos opcionais undefined proibidos');
  await actions.after.pop()();assert.equal(actions.relay,1);assert.equal(actions.push,1);
 });
 await check('Idempotencia: mesmo request retorna 200 e nao duplica filas',async()=>{
  const p=input();const created=await call(p);assert.equal(created.status,201);
  const before=docs.size;const afterN=actions.after.length;const rep=await call(p);
  assert.equal(rep.status,200);assert.equal(rep.body.id,created.body.id);
  assert.equal(docs.size,before);assert.equal(actions.after.length,afterN);
 });
 await check('Idempotencia: payload diferente no mesmo ID bloqueado',async()=>{
  const p=input();assert.equal((await call(p)).status,201);
  const altered=structuredClone(p);altered.order.metodoPagamento='cartao';
  const n=docs.size;const r=await call(altered);
  assert.equal(r.status,409);assert.equal(r.body.error,'IDEMPOTENCY_CONFLICT');assert.equal(docs.size,n);
 });
 await check('Google: autenticacao e contadores somente apos commit',async()=>{
  const p=input();const r=await call(p,true);assert.equal(r.status,201,JSON.stringify(r.body));
  assert.equal(docs.get('Pedidos/'+r.body.id).userId,'client-uid');
  assert(docs.has('Usuarios/client-uid'));assert(docs.has('Usuarios/client-uid/Loyalty/state'));
 });
 await check('Delivery: endereco correto e taxa autoritativa',async()=>{
  const p=input({deliveryMode:'delivery'});const r=await call(p);assert.equal(r.status,201,JSON.stringify(r.body));
  const doc=docs.get('Pedidos/'+r.body.id);assert.equal(doc.taxaEntrega,6);assert.equal(doc.total,26);assert.equal(doc.deliverySnapshot.district,'Centro');
 });
 await check('Delivery: bairro ausente nao grava pedido',async()=>{
  const p=input({deliveryMode:'delivery',district:'X'});const n=docs.size;const r=await call(p);
  assert.equal(r.status,409);assert.equal(r.body.error,'ADDRESS_INVALID');assert.equal(docs.size,n);
 });
 await check('Adicional: preco calculado no servidor e serializacao segura',async()=>{
  const p=input({addons:['cheese']});const r=await call(p);assert.equal(r.status,201,JSON.stringify(r.body));
  const o=docs.get('Pedidos/'+r.body.id);assert.equal(o.total,23);assert.equal(o.itens[0].selectedAddons[0].name,'Queijo');checkFirestoreValue(o);
 });
 await check('Preco adulterado ou carrinho divergente nao grava',async()=>{
  const p=input();p.order.total=1;const n=docs.size;const r=await call(p);
  assert.equal(r.status,409);assert.equal(r.body.error,'PRICE_CHANGED');assert.equal(docs.size,n);
 });
 await check('Cupom valido desconta sem afetar outro pedido',async()=>{
  docs.set('Cupons/DESC5',{ativo:true,tipo:'fixed',valor:5});
  const p=input({discountCode:'DESC5',discountAmount:5});const r=await call(p);
  assert.equal(r.status,201,JSON.stringify(r.body));assert.equal(docs.get('Pedidos/'+r.body.id).total,15);
 });
 await check('Cupom inexistente nao grava pedido parcial',async()=>{
  const p=input({discountCode:'INVALIDO',discountAmount:5});const n=docs.size;const r=await call(p);
  assert.equal(r.status,409);assert.equal(r.body.error,'COUPON_NOT_FOUND');assert.equal(docs.size,n);
 });
 await check('Agendamento: vaga e data gravadas atomicamente',async()=>{
  const p=input({scheduled:true});const r=await call(p);assert.equal(r.status,201,JSON.stringify(r.body));
  const o=docs.get('Pedidos/'+r.body.id);assert.equal(o.status,'Agendado');assert.equal(o.isAgendamento,true);
  assert([...docs.keys()].some(k=>k.startsWith('schedule_slots/')));
 });
 await check('Erro Firestore: rollback da transacao sem outbox/FCM orfas',async()=>{
  const p=input();const before=docs.size;injectedFailure=Object.assign(new Error('resource exhausted'),{code:8});
  const result=await call(p);assert.equal(result.status,409);assert.equal(result.body.error,'SERVICE_BUSY');assert.equal(docs.size,before);
 });
 await check('Falha inesperada: resposta sem dados internos e sem gravacao',async()=>{
  const p=input();const before=docs.size;injectedFailure=new Error('secret technical error XYZ');
  const result=await call(p);assert.equal(result.status,500);assert.equal(result.body.error,'ORDER_FAILED');assert.equal(docs.size,before);
  assert(actions.traces.some(t=>t.outcome==='error'&&t.details.failureKind));
 });
 await check('Checkout: timeout e rede preservam carrinho e chave de pedido',async()=>{
  const client=fs.readFileSync('src/lib/orderRepository.ts','utf8');
  const ui=fs.readFileSync('src/components/ui/CheckoutModal.tsx','utf8');
  const safety=fs.readFileSync('src/lib/checkoutFallbackSafety.ts','utf8');
  assert(client.includes('ORDER_TIMEOUT')&&client.includes('ORDER_NETWORK'));
  assert(ui.includes('orderAttemptRef.current')&&ui.includes('clearConfirmedCart()'));
  assert(ui.includes('if (submittedCart !== currentCart) return false;'));
  assert(ui.includes('getCheckoutStoreAccess(currentUser?.email, true)'));
  assert(safety.includes('SERVICE_CONFIG'));
 });
 await check('API nao depende do relay nem do push antes de retornar',async()=>{
  const p=source.indexOf('const result = await adminDb.runTransaction');
  const a=source.indexOf('after(async () =>',p);
  const r=source.indexOf('return NextResponse.json(\n      {\n        ok: true,',a);
  assert(p>=0&&a>p&&r>a);
  const between=source.slice(p,r);
  assert(!/^[ \t]{4,8}await\s+(?:sendAdminNewOrderPush|drainIntegrationOutboxEvent)/m.test(between));
 });
 await check('R2: loja fechada rejeita pedido imediato sem gravar nada',async()=>{
   const before=docs.size;docs.set('settings/loja',{mode:'force_closed'});
   const beforeJobs=actions.after.length;
   try{
     const result=await call(input());
     assert.equal(result.status,409);assert.equal(result.body.error,'SCHEDULE_REQUIRED');
     assert.equal(docs.size,before);assert.equal(actions.after.length,beforeJobs);
   }finally{docs.set('settings/loja',{mode:'force_open'});}
 });
 await check('R2: whitelist nao autoriza convidados em modo teste',async()=>{
   const before=docs.size;docs.set('settings/loja',{mode:'test_open',testAllowedEmails:['buyer@example.invalid']});
   try{
     const result=await call(input(),false);
     assert.equal(result.status,409);assert.equal(result.body.error,'SCHEDULE_REQUIRED');assert.equal(docs.size,before);
   }finally{docs.set('settings/loja',{mode:'force_open'});}
 });
 await check('R2: login Google autorizado em modo teste aceita imediato',async()=>{
   docs.set('settings/loja',{mode:'test_open',testAllowedEmails:['buyer@example.invalid']});
   try{
     const r=await call(input(),true);assert.equal(r.status,201,JSON.stringify(r.body));
     assert.equal(docs.get('Pedidos/'+r.body.id).customerMode,'google');
   }finally{docs.set('settings/loja',{mode:'force_open'});}
 });
 await check('R2: modo teste com email diferente rejeita',async()=>{
   const n=docs.size;docs.set('settings/loja',{mode:'test_open',testAllowedEmails:['someoneelse@example.invalid']});
   try{const r=await call(input(),true);assert.equal(r.status,409);assert.equal(r.body.error,'SCHEDULE_REQUIRED');assert.equal(docs.size,n);}
   finally{docs.set('settings/loja',{mode:'force_open'});}
 });
 await check('R2: idempotencia recupera pedido mesmo apos fechar a loja',async()=>{
   const p=input();const first=await call(p);assert.equal(first.status,201);
   const n=docs.size;const jobs=actions.after.length;
   docs.set('settings/loja',{mode:'force_closed'});
   try{const recovered=await call(p);assert.equal(recovered.status,200);assert.equal(recovered.body.id,first.body.id);
     assert.equal(docs.size,n);assert.equal(actions.after.length,jobs);}
   finally{docs.set('settings/loja',{mode:'force_open'});}
 });
 await check('R2: agendamento continua respeitando regra de vagas com loja fechada',async()=>{
   docs.set('settings/loja',{mode:'force_closed'});
   try{const r=await call(input({scheduled:true}));assert.equal(r.status,201,JSON.stringify(r.body));
      assert.equal(docs.get('Pedidos/'+r.body.id).status,'Agendado');}
   finally{docs.set('settings/loja',{mode:'force_open'});}
 });
 console.log(`\nDFL SITE SALES CRITICAL R1+R2: ${ok} cenarios aprovados. REAL POST transpiled; ZERO production writes.`);
})().catch((e)=>{console.error(e.stack||e);process.exitCode=1});
