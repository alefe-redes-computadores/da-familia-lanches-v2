// DFL SITE R40 P0 — teste isolado de seguranca da allowlist + regressao
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const file = path.join(__dirname, '../src/lib/integration/server/messagingR11Policy.ts');
const src = fs.readFileSync(file, 'utf8');
const js = ts.transpileModule(src, {fileName:file, compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const out = {exports:{}};
vm.runInNewContext(js, out, {filename:'messagingR11Policy.cjs'});
const gate = out.exports.r11SiteMessageGate;
assert.equal(typeof gate, 'function');
const env = {
 DFL_MESSAGING_R11_SITE_ENABLED:'true',
 DFL_MESSAGING_R11_KILL_SWITCH:'false',
 DFL_MESSAGING_R11_SCOPE:'canary',
 DFL_MESSAGING_R11_APPROVED_PHONES_E164:'5534999999999',
 DFL_MESSAGING_R11_APPROVED_EVENTS:'order.created',
 DFL_MESSAGING_R11_CANCEL_ENABLED:'true',
};
const order = {status:'Cancelado',tipoEntrega:'delivery',whatsappNotificationsConsent:true,whatsappNotificationsConsentAt:'2026-11-09T23:06:18.502Z'};
const test = (type='order.cancelled',source='order.updated',e=env,o=order,phone='5534999999999') => gate({eventType:type,sourceEventType:source,phone,order:o,env:e});
let count=0;
function ck(actual,expected,label){assert.equal(actual,expected,label);count++;}
ck(test(),null,'cancelamento do pedido elegivel');
ck(test('order.cancelled','order.updated',{...env,DFL_MESSAGING_R11_CANCEL_ENABLED:'false'}),'template_event_not_enabled','flag OFF');
ck(test('order.cancelled','order.created'),'template_event_not_enabled','origem errada');
ck(test('order.cancelled','order.updated',env,{...order,status:'Pendente'}),'template_event_not_enabled','sem cancelamento efetivo');
ck(test('order.cancelled','order.updated',env,{...order,whatsappNotificationsConsent:false}),'explicit_consent_missing','sem opt in');
ck(test('order.cancelled','order.updated',{...env,DFL_MESSAGING_R11_KILL_SWITCH:'true'}),'r11_kill_switch','kill switch');
ck(test('order.cancelled','order.updated',{...env,DFL_MESSAGING_R11_SITE_ENABLED:'false'}),'r11_site_gate_off','site gate');
ck(test('order.cancelled','order.updated',env,order,'5534999988888'),'not_in_approved_pilot','numero nao autorizado');
ck(test('delivery.failed','delivery.failed'),'template_event_not_enabled','eventos extras nao liberados');
ck(test('order.created','order.created',env,{...order,status:'Pendente'}),null,'order.created preservado');
ck(test('order.cancelled','order.updated',{...env,DFL_MESSAGING_R11_APPROVED_EVENTS:''}),null,'override somente cancelamento');
ck(test('order.cancelled','order.updated',{...env,DFL_MESSAGING_R11_SCOPE:'consented_customers',DFL_MESSAGING_R11_ROLLOUT_APPROVED:'false'}),'rollout_not_approved','rollout OFF');
ck(test('order.cancelled','order.updated',{...env,DFL_MESSAGING_R11_SCOPE:'consented_customers',DFL_MESSAGING_R11_ROLLOUT_APPROVED:'true'}),null,'rollout ON autorizado');
ck(test('order.cancelled','order.updated',{...env,DFL_MESSAGING_R11_CANCEL_ENABLED:undefined}),'template_event_not_enabled','flag ausente');
ck(test('order.ready','order.updated',env),'obsolete_commercial_stage','estado cancelado invalida pronto');
console.log(`R40_CANCEL_GATE=PASS ${count}/15 testes`);
