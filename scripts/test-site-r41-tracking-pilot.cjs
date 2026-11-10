#!/usr/bin/env node
'use strict';
/** R41: homologacao hermetica de escopo; sem rede e sem token real. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const src=fs.readFileSync('src/lib/tracking/r41PilotRecipient.ts','utf8');
const compiled=ts.transpileModule(src,{fileName:'src/lib/tracking/r41PilotRecipient.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
const m={exports:{}};
new Function('module','exports',compiled.outputText)(m,m.exports);
const allow=m.exports.r41TrackingPilotRecipient;
let count=0;
const ok=(condition,label)=>{assert.ok(condition,'R41 '+label);count++;};
const good={DFL_SITE_TRACKING_AUTO_PILOT_PHONE_E164:'+5534999999999'};
ok(typeof allow==='function','funcao carregada');
ok(allow(good,'+5534999999999'),'numero unico liberado');
for(const bad of ['+5534988888888','5534999999999','+55349999999990','+553499999999','',undefined,null,{},7])ok(!allow(good,bad),'destinatario estranho bloqueado');
for(const bad of ['',undefined,'+5534999999998,+5534999999999','*','+0000000000000','5534999999999'])ok(!allow({DFL_SITE_TRACKING_AUTO_PILOT_PHONE_E164:bad},'+5534999999999'),'config insegura rejeitada');
const accept=fs.readFileSync('src/lib/tracking/automaticAcceptance.ts','utf8');
const delivery=fs.readFileSync('src/lib/tracking/r27AutomaticDelivery.ts','utf8');
ok(accept.includes('!r41TrackingPilotRecipient(process.env, (order.customerSnapshot as Raw | undefined)?.phoneE164)'), 'aceite bloqueia outros telefones antes S2S');
ok(delivery.includes('if(!orderSnap.exists || !r41TrackingPilotRecipient(process.env,customer.phoneE164))'),'envio verifica telefone imediatamente antes da emissao');
ok(delivery.indexOf("if(!orderSnap.exists || !r41TrackingPilotRecipient") < delivery.indexOf('const state=await r25SendInitialOnce'), 'guarda precede emissao');
ok(accept.includes('acceptedOrderCanNotify(order,claim.acceptedAt)'),'consentimento existente preservado');
ok(delivery.includes("reason='R41_PILOT_ONLY'"),'auditoria sem telefone');
ok(!delivery.includes('opaque_token') && !src.includes('localStorage'),'nao grava token no piloto');
console.log(`R41_PILOTO_TRACKING_OK | ${count} verificacoes hermeticas; ZERO rede.`);
