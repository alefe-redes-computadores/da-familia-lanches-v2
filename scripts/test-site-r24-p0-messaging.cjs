#!/usr/bin/env node
'use strict';
/* Testes herméticos R24: não acessam rede, Firestore, WhatsApp nem provedor. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
let passed=0;
function ok(condition,label){assert.ok(condition,label);passed++;}
const guardPath='src/lib/integration/server/r24MessageStateGuard.ts';
const policyPath='src/lib/integration/server/messagingR11Policy.ts';
const projectionPath='src/lib/integration/server/messagingProjection.ts';
for(const path of [guardPath,policyPath,projectionPath]){
  const src=fs.readFileSync(path,'utf8');
  const parsed=ts.createSourceFile(path,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
  ok(parsed.parseDiagnostics.length===0,`parse ${path}`);
}
const source=fs.readFileSync(guardPath,'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const compiledExports={};vm.runInNewContext(code,{exports:compiledExports});
const guard=compiledExports.r24MessageStateGuard;
const stage=(status,tipoEntrega='delivery',more={})=>({status,tipoEntrega,...more});
ok(guard('order.production',stage('Em Produção'))===null,'produção atual continua');
ok(guard('order.ready',stage('Pronto'))===null,'pronto atual continua');
ok(guard('order.ready',stage('Em Produção'))==='r24_obsolete_ready_stage','pronto retroativo bloqueado');
ok(guard('order.production',stage('Pronto'))==='r24_obsolete_production_stage','produção retroativa bloqueada');
ok(guard('order.ready',stage('Cancelado'))==='r24_obsolete_after_terminal','cancelado bloqueia pronto');
ok(guard('order.created',stage('Finalizado'))==='r24_obsolete_after_terminal','recebimento atrasado bloqueado');
ok(guard('delivery.next_stop',stage('Finalizado'))==='r24_obsolete_after_terminal','próxima parada atrasada bloqueada');
ok(guard('delivery.next_stop',stage('Saiu para Entrega','delivery',{deliveryOperationalCompleted:true}))==='r24_obsolete_after_terminal','conclusão operacional bloqueia próxima parada');
ok(guard('delivery.started',stage('Saiu para Entrega','pickup'))==='r24_pickup_has_no_delivery_notification','retirada sem saída para entrega');
ok(guard('delivery.completed',stage('Finalizado','pickup'),'delivery.completed')==='r24_pickup_has_no_delivery_notification','retirada sem entrega completada');
ok(guard('delivery.completed',stage('Finalizado','delivery'),'order.updated')==='r24_not_authoritative_delivery_completion','site não forja conclusão');
ok(guard('delivery.completed',stage('Finalizado','delivery'),'delivery.completed')===null,'entrega real mantida');
ok(guard('delivery.completed',stage('Cancelado','delivery'),'delivery.completed')==='r24_delivery_after_cancellation','cancelamento prevalece');
ok(guard('order.cancelled',stage('Cancelado'))===null,'cancelamento legítimo preservado');
ok(guard('order.cancelled',stage('Pronto'))==='r24_cancel_event_no_longer_current','cancelamento obsoleto bloqueado');
ok(guard('delivery.failed',stage('Saiu para Entrega','delivery'))===null,'falha em trânsito preservada');
const policy=fs.readFileSync(policyPath,'utf8');
const proj=fs.readFileSync(projectionPath,'utf8');
ok(policy.includes("eventType.startsWith('delivery.')")&&policy.includes("return 'pickup_logistics_suppressed';")&&!policy.includes("!(eventType === 'delivery.completed'"),'R11 sem exceção pickup');
const pickupBranch=proj.match(/if \(n === "finalizado" && text\(payload\.tipoEntrega\) === "pickup"\) \{\s*(?:\/\/[^\n]*\n\s*)?return null;\s*\}/);
ok(Boolean(pickupBranch),'finalizado pickup não vira delivery.completed');
ok(proj.includes('r24MessageStateGuard(eventType, order, text(data.source_event_type))'),'último gate no claim transacional');
ok(proj.includes('r24MessageStateGuard(eventType, current'),'gate já na criação dos estágios');
ok(proj.includes('messaging_eligible:false')&&proj.includes('"commercial_stage_after_delivery_completed"'),'supressão durável V30 preservada');
ok(proj.includes('const reason = r24Reason || r11SiteMessageGate('),'R11 preservado após R24');
ok(!proj.includes('setInterval('),'nenhum polling novo');
console.log(`R24 P0: ${passed} verificações herméticas APROVADAS; sem rede, Firestore ou WhatsApp.`);
