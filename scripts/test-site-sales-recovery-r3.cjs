'use strict';
/* Testa a funcao real do cliente e a invariancia pos-commit do checkout.
   Nunca chama rede, Firebase ou pedidos de producao. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const repository=fs.readFileSync('src/lib/orderRepository.ts','utf8');
const checkout=fs.readFileSync('src/components/ui/CheckoutModal.tsx','utf8');
const route=fs.readFileSync('src/app/api/orders/route.ts','utf8');
const ast=ts.createSourceFile('src/lib/orderRepository.ts',repository,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const fn=ast.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text==='createCustomerOrder');
assert(fn, 'R3: funcao real createCustomerOrder nao encontrada');
const transpiled=ts.transpileModule(fn.getText(ast).replace(/^export\s+/,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}});
assert.equal((transpiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
let sent=[],responses=[],timeoutDelay=[],aborts=0,cleared=0,tokenCalls=0;
const w={setTimeout(fn,ms){timeoutDelay.push(ms);return timeoutDelay.length},clearTimeout(){cleared++}};
const auth={currentUser:null};
const fetch=async(url,opts)=>{
 assert.equal(url,'/api/orders');assert.equal(opts.method,'POST');
 assert.equal(opts.headers['content-type'],'application/json');
 assert(opts.signal);sent.push({...opts,url});
 const r=responses.shift();if(typeof r==='function')return r(opts);if(r instanceof Error)throw r;
 return {ok:r?.status<400,json:async()=>r?.body};
};
const create=new Function('auth','window','fetch','AbortController','DOMException',transpiled.outputText+'\nreturn createCustomerOrder;')(auth,w,fetch,AbortController,DOMException);
const payload=()=>({userId:null,order:{clientRequestId:'fixed_unchanged_tracking_1234567',itens:[{id:'p',quantity:1}],total:20},subtotal:20,discount:null});
let done=0;
const check=async(name,fn)=>{await fn();done++;console.log('✓',name)};
const failCode=async(p,code)=>assert.rejects(create(p),e=>e?.message===code);
(async()=>{
 await check('HTTP 201 confirmado retorna ID e nunca altera tracking',async()=>{
   const p=payload();responses.push({status:201,body:{ok:true,id:'site_abcd'}});
   const a=await create(p);assert.equal(a.id,'site_abcd');assert.equal(JSON.parse(sent.at(-1).body).order.clientRequestId,p.order.clientRequestId);
 });
 await check('HTTP 200 resposta idempotente retorna mesmo ID',async()=>{
   const p=payload();responses.push({status:200,body:{ok:true,id:'site_abcd',reused:true}});
   assert.equal((await create(p)).id,'site_abcd');assert.equal(sent.length,2);
 });
 await check('HTTP 409 com conflito nao mascara duplicidade',async()=>{
   responses.push({status:409,body:{ok:false,error:'IDEMPOTENCY_CONFLICT'}});
   await failCode(payload(),'IDEMPOTENCY_CONFLICT');
 });
 await check('HTTP 409 loja fechou aponta agendamento',async()=>{
   responses.push({status:409,body:{ok:false,error:'SCHEDULE_REQUIRED'}});
   await failCode(payload(),'SCHEDULE_REQUIRED');
 });
 await check('HTTP 500 nao se transforma em sucesso falso',async()=>{
   responses.push({status:500,body:{ok:false,error:'ORDER_FAILED'}});
   await failCode(payload(),'ORDER_FAILED');
 });
 await check('Resposta 201 sem ID nao pode limpar carrinho',async()=>{
   responses.push({status:201,body:{ok:true}});await failCode(payload(),'ORDER_FAILED');
 });
 await check('AbortError tratado como resultado incerto; sem retry automatico',async()=>{
   const n=sent.length;responses.push(new DOMException('aborted','AbortError'));
   await failCode(payload(),'ORDER_TIMEOUT');assert.equal(sent.length,n+1);
 });
 await check('Erro de rede tratado como incerto; sem retry automatico',async()=>{
   const n=sent.length;responses.push(new TypeError('Failed to fetch'));
   await failCode(payload(),'ORDER_NETWORK');assert.equal(sent.length,n+1);
 });
 await check('JSON invalido nao gera resposta de sucesso',async()=>{
   responses.push(()=>({ok:true,json:async()=>{throw Error('JSON_INVALID')}}));
   await failCode(payload(),'ORDER_FAILED');
 });
 await check('Autenticacao Google usa token da conta atual',async()=>{
   auth.currentUser={uid:'u1',getIdToken:async()=>{tokenCalls++;return 'valid-test-token'}};
   responses.push({status:201,body:{ok:true,id:'site_google'}});
   assert.equal((await create({...payload(),userId:'u1'})).id,'site_google');
   assert.equal(sent.at(-1).headers.authorization,'Bearer valid-test-token');assert.equal(tokenCalls,1);
   auth.currentUser=null;
 });
 await check('Usuario errado e bloqueado ANTES do POST',async()=>{
   const n=sent.length;await failCode({...payload(),userId:'other'},'AUTH_REQUIRED');assert.equal(sent.length,n);
 });
 await check('Timeout de 20 segundos e limpeza do temporizador',async()=>{
   assert(timeoutDelay.length>=10&&timeoutDelay.every(t=>t===20000));assert(cleared>=10);
 });
 await check('Ambos os perfis identificam commit antes de qualquer pos-processamento',async()=>{
   const ids=(checkout.match(/confirmedOrderId = created\.id;/g)||[]).length;assert.equal(ids,2);
   const i=checkout.indexOf('const created = await createCustomerOrder({');
   const commit=checkout.indexOf('confirmedOrderId = created.id;',i);
   const whatsapp=checkout.indexOf('const whatsappMessage = buildOrderWhatsAppMessage',i);
   assert(i>=0&&commit>i&&whatsapp>commit);
   assert(checkout.indexOf('confirmedOrderId = created.id;',checkout.indexOf('const created=await createCustomerOrder'))>0);
 });
 await check('Falha pos-commit nunca vira erro de pedido sem registro',async()=>{
   const catchpos=checkout.indexOf('if (confirmedOrderId) {');
   const failpos=checkout.indexOf('console.error("Erro ao salvar pedido", error);',catchpos);
   assert(catchpos>0&&failpos>catchpos);
   const safe=checkout.slice(catchpos,failpos);
   assert(safe.includes('openModal("order-success"'));
   assert(safe.includes('setOrderOutcomeUncertain(false)'));
   assert(safe.includes('setFallbackWhatsAppUrl("")'));
   assert(!safe.includes('canOfferManualOrderFallback'));
 });
 await check('Perfil nao bloqueia comprovante do pedido Google',async()=>{
   assert(checkout.includes('const persistProfileAfterSuccess = async () =>'));
   const show=checkout.indexOf('openModal("order-success", {',checkout.indexOf('const whatsappMessage = buildOrderWhatsAppMessage'));
   const persist=checkout.indexOf('void persistProfileAfterSuccess();',show);
   assert(show>=0&&persist>show);
   const between=checkout.slice(checkout.indexOf('confirmedOrderId = created.id;',checkout.indexOf('const created = await createCustomerOrder')),show);
   assert(!between.includes('await saveUserProfile(')||between.includes('const persistProfileAfterSuccess = async ()'));
 });
 await check('Fallback de WhatsApp nao usado para resposta incerta',async()=>{
   const safety=fs.readFileSync('src/lib/checkoutFallbackSafety.ts','utf8');
   assert(safety.includes('SERVICE_CONFIG'));
   assert(!safety.includes('"ORDER_NETWORK"')&&!safety.includes('"ORDER_TIMEOUT"'));
 });
 await check('A integridade do commit e idempotencia da API continuam ativas',async()=>{
   for(const s of ['tx.create(orderRef, canonicalOrder)','requestFingerprint','clientRequestId','after(async () =>','tx.create(adminDb.collection("AdminPushDispatches").doc(pushDispatchId)'])assert(route.includes(s),s);
 });
 await check('R3 conectada ao gate e ao check de vendas',async()=>{
   for(const p of ['scripts/test-site-v88-v90-release-gate.cjs','.github/workflows/site-sales-protection.yml','.github/workflows/build-admin-android.yml'])assert(fs.readFileSync(p,'utf8').includes('scripts/test-site-sales-recovery-r3.cjs'),p);
 });
 console.log(`\nDFL SITE SALES GATE R3 — ${done} cenarios aprovados (HTTP real do cliente simulado). Nenhum pedido real.`);
})().catch(e=>{console.error(e.stack||e);process.exitCode=1});
