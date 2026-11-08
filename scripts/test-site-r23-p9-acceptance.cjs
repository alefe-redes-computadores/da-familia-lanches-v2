'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const p=read('src/lib/tracking/automaticAcceptancePolicy.ts');
const bridge=read('src/lib/tracking/automaticAcceptance.ts');
const endpoint=read('src/app/api/admin/orders/accept/route.ts');
const repo=read('src/lib/orderRepository.ts');
const tracking=read('src/lib/tracking/server.ts');
const worker=read('src/app/api/integration/worker/route.ts');
let count=0;function ok(v,label){assert.ok(v,label);count++}
for(const [path,script,kind] of [
 ['policy.ts',p,ts.ScriptKind.TS],['bridge.ts',bridge,ts.ScriptKind.TS],['route.ts',endpoint,ts.ScriptKind.TS],
 ['repository.ts',repo,ts.ScriptKind.TS],['tracking.ts',tracking,ts.ScriptKind.TS],['worker.ts',worker,ts.ScriptKind.TS]]){
 const parsed=ts.createSourceFile(path,script,ts.ScriptTarget.Latest,true,kind);
 ok(parsed.parseDiagnostics.length===0,`TS parse ${path}`);
}
const transpiled=ts.transpileModule(p,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exp={};vm.runInNewContext(transpiled,{exports:exp});
const base={sourceSystem:'dfl_site',checkoutChannel:'site',whatsappNotificationsConsent:true,whatsappNotificationsConsentSource:'checkout_r12_explicit',whatsappNotificationsConsentAt:'2026-11-08T14:00:00.000Z',status:'Pendente',customerSnapshot:{phoneE164:'+5534999999999'}};
const at='2026-11-08T14:05:00.000Z';
ok(exp.acceptanceStatus('Pendente')==='Pendente','Pendente admissivel');
ok(exp.acceptanceStatus('Agendado')==='Agendado','Agendado admissivel');
ok(exp.acceptanceStatus('Finalizado')===null,'terminal bloqueado');
ok(exp.acceptedOrderCanNotify(base,at),'consentimento e telefone validos');
for(const [k,v] of [['whatsappNotificationsConsent',false],['whatsappNotificationsConsentSource','inferred'],['sourceSystem','ifood'],['checkoutChannel','whatsapp'],['status','Cancelado'],['customerSnapshot',{phoneE164:'123'}]])
  ok(!exp.acceptedOrderCanNotify({...base,[k]:v},at),`nega ${k}`);
ok(!exp.acceptedOrderCanNotify({...base,whatsappNotificationsConsentAt:'2026-11-08T14:10:00.000Z'},at),'consentimento futuro negado');
ok(!exp.acceptedOrderCanNotify({...base,whatsappNotificationsOptOut:true},at),'opt-out explicito bloqueado');
ok(!exp.acceptedOrderCanNotify({...base,whatsappNotificationsConsentRevokedAt:at},at),'revogacao de consentimento bloqueada');
ok(exp.terminalOrDifferentAcceptance({...base,acceptedAt:at,status:'Finalizado'},at),'bloqueia terminal');
ok(exp.terminalOrDifferentAcceptance({...base,acceptedAt:'2026-11-08T14:00:00.000Z'},at),'bloqueia alteracao de aceite');
ok(!exp.terminalOrDifferentAcceptance({...base,acceptedAt:at},at),'aceite estavel');
ok(repo.includes('if (input.nextStatus === "Aceito") {')&&repo.includes('fetch("/api/admin/orders/accept"'),'aceite usa api autentica');
ok(!repo.includes('acceptedBy: "admin"'),'browser nao forja auditoria');
ok(endpoint.includes('verifyIdToken')&&endpoint.includes('isAdminEmail'),'endpoint exige conta admin');
ok(endpoint.includes('adminDb.runTransaction')&&endpoint.includes('tx.update(ref,{acceptedAt,acceptedBy:uid,acceptedStageAt:now})'),'aceite e fila atomicos');
ok(endpoint.includes('tx.create(intentRef,')&&endpoint.includes('acceptedOrderCanNotify(order,acceptedAt)'),'fila somente consentida');
ok(endpoint.includes('autoAcceptanceEnabled()'),'chamada imediata gated');
ok(bridge.includes("DFL_SITE_TRACKING_AUTO_ACCEPT_ENABLED === '1'")&&bridge.includes("DFL_SITE_TRACKING_ENABLED === '1'"),'OFF por padrao');
ok(bridge.includes('callEntregas(AUTO_ACCEPT_PATH,payload)'),'endpoint P9 correto');
ok(bridge.includes(".where('state','in',['pending','processing'])")&&bridge.includes('adminDb.runTransaction'),'recovery e claim');
ok(bridge.includes('terminalOrDifferentAcceptance')&&bridge.includes('acceptedOrderCanNotify'),'autoridade relida antes de S2S');
ok(bridge.includes('idempotency_key:hash(')&&bridge.includes('event_id:eventId'),'retry idempotente');
ok(!bridge.includes('issue_initial')&&!bridge.includes('opaque_token')&&!bridge.includes('sendWhatsApp'),'sem token ou envio fora de contrato');
ok(tracking.includes('const AUTO_ACCEPT_PATH')&&tracking.includes('typeof AUTO_ACCEPT_PATH'),'assinatura existente reaproveitada');
ok(worker.includes('drainAutoAcceptances')&&worker.includes('const autoAccept=await drainAutoAcceptances'),'cron integrado');
console.log('R23 P9 ACEITE: '+count+' verificacoes hermeticas OK; sem rede, Firestore ou WhatsApp reais.');
