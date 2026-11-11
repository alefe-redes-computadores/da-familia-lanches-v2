'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require('typescript');
const path='src/lib/messaging/r32ManualNextStopPolicy.ts';
const src=fs.readFileSync(path,'utf8');
const ast=ts.createSourceFile(path,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
assert.equal(ast.parseDiagnostics.length,0,'R53 Site AST válido');
const m={};vm.runInNewContext(ts.transpileModule(src,{fileName:path,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:m,Date});
const phone='5534999999999',other='5534988888888';
const c={DFL_MANUAL_NEXT_STOP_ENABLED:'true',DFL_MANUAL_NEXT_STOP_KILL_SWITCH:'false',DFL_MANUAL_NEXT_STOP_SCOPE:'canary',DFL_MANUAL_MESSAGING_ENABLED:'true',DFL_MANUAL_MESSAGING_KILL_SWITCH:'false',DFL_MESSAGING_PILOT_PHONE_E164:phone};
assert.equal(m.r32ManualNextStopCanary(c,phone),true,'canary preexistente');
assert.equal(m.r32ManualNextStopCanary(c,other),false,'canary bloqueia outro numero');
const g={...c,DFL_MANUAL_NEXT_STOP_SCOPE:'consented_customers',DFL_MANUAL_MESSAGING_SCOPE:'consented_customers',DFL_MANUAL_MESSAGING_ROLLOUT_APPROVED:'true'};
assert.equal(m.r32ManualNextStopCanary(g,other),true,'geral libera destinatario consentido');
for(const [key,value] of [['DFL_MANUAL_NEXT_STOP_ENABLED','false'],['DFL_MANUAL_NEXT_STOP_KILL_SWITCH','true'],['DFL_MANUAL_NEXT_STOP_KILL_SWITCH',undefined],['DFL_MANUAL_MESSAGING_ENABLED','false'],['DFL_MANUAL_MESSAGING_KILL_SWITCH','true'],['DFL_MANUAL_NEXT_STOP_SCOPE','authorized_clients'],['DFL_MANUAL_MESSAGING_SCOPE','canary'],['DFL_MANUAL_MESSAGING_ROLLOUT_APPROVED','false'],['DFL_MANUAL_MESSAGING_ROLLOUT_APPROVED',undefined]]){
 assert.equal(m.r32ManualNextStopCanary({...g,[key]:value},other),false,`gate fechado ${key}`);
}
assert.equal(m.r32ManualNextStopCanary(g,'999'),false,'telefone invalido');
assert.equal(m.r32ManualNextStopCanary({},phone),false,'OFF sem env');
const route=fs.readFileSync('src/app/api/integration/manual-messaging/route.ts','utf8');
assert.ok(route.includes('r32ValidManualNextStop(data)'), 'contrato físico preservado');
assert.ok(route.includes('r8Authorized(phone,obj)'), 'autoridade de destinatarios/consentimento preservada');
assert.ok(route.indexOf('assertSignedIntegrationRequest(')<route.indexOf('r32ValidManualNextStop(data)'), 'HMAC antes do evento');
assert.ok(src.includes('p.manual_messaging_opt_in_v1!==true||p.notify_whatsapp!==true'),'duplo consentimento mantido');
console.log('R53 SITE: 17 contratos, legacy canary e geral consentido OK. Sem rede.');
