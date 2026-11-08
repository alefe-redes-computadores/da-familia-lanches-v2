#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const root='docs/integration/r28-provider/';
const policy=fs.readFileSync(root+'policy.ts.txt','utf8'),edge=fs.readFileSync(root+'index.ts.txt','utf8'),sql=fs.readFileSync(root+'migration.sql','utf8');
let count=0;function ok(value,title){assert.ok(value,title);count++;}
for(const [name,text] of [['policy',policy],['index',edge]]) ok(!ts.createSourceFile(name+'.ts',text,ts.ScriptTarget.Latest,true).parseDiagnostics.length,'parse '+name);
const exp={};vm.runInNewContext(ts.transpileModule(policy,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exp,Date,URL});
const now=Date.now();
const input={contract:'dfl.tracking.provider.v1',version:1,action:'send_tracking_initial',canonical_order_key:'site:order_12345',recipient_e164:'+5534999999999',tracking_link:'https://dafamilialanches.com.br/acompanhar#t='+('A'.repeat(43)),expires_at:new Date(now+40*60_000).toISOString()};
ok(Boolean(exp.parseP9Request(input,now)),'requisição P9 válida');
ok(!exp.parseP9Request({...input,extra:'x'},now),'sem campos extras');
ok(!exp.parseP9Request({...input,canonical_order_key:'site:../wrong'},now),'identidade segura');
ok(!exp.parseP9Request({...input,recipient_e164:'5534999999999'},now),'telefone E164');
ok(!exp.parseP9Request({...input,tracking_link:'https://evil.example#t='+('A'.repeat(43))},now),'host fixo');
ok(!exp.parseP9Request({...input,expires_at:new Date(now-9000).toISOString()},now),'token expirado');
ok(!exp.parseP9Request({...input,expires_at:new Date(now+50*60_000).toISOString()},now),'TTL máximo');
ok(!exp.parseP9Request({...input,action:'other'},now),'ação restrita');
ok(!exp.parseP9Request({...input,version:2},now),'versão restrita');
ok(exp.evolutionEndpoint('https://provider.example','DFL')==='https://provider.example/message/sendText/DFL','URL Evolution aprovada');
ok(exp.evolutionEndpoint('http://provider.example','DFL')===null,'exige HTTPS');
ok(exp.evolutionEndpoint('https://user:pass@provider.example','DFL')===null,'nega credenciais no host');
ok(exp.evolutionEndpoint('https://provider.example','../a')===null,'nega path malicioso');
ok(exp.trustedEvolutionMessageId({key:{id:'A123456789'}})==='A123456789','ID provedor válido');
ok(exp.trustedEvolutionMessageId({key:{id:'abc\nbad1234'}})===null,'ID provedor inválido');
ok(exp.p9Receipt('accepted_by_provider','A123456789').customer_delivery_confirmed===false,'ACK não é entrega');
ok(Object.keys(exp.p9Receipt('delivery_uncertain','r28-123456789')).length===6,'resposta estrita');
for(const txt of ['DFL_TRACKING_HANDOFF_ENABLED','DFL_TRACKING_HANDOFF_KILL_SWITCH','DFL_TRACKING_HANDOFF_SHARED_SECRET','DFL_TRACKING_HANDOFF_SITE_APIKEY','sameSecret(incomingSecret,shared)','sameSecret(incomingApiKey,allowedKey)',"db.from('dfl_tracking_provider_attempts_v1').insert",'await fetch(target',"result='accepted_by_provider'","result='rejected_by_provider'"]){ok(edge.includes(txt),'gate '+txt);}
ok(edge.indexOf('.insert({')<edge.indexOf('await fetch(target'),'reserva antes de enviar');
ok(!edge.includes('dfl_messaging_outbox')&&!edge.includes('dfl-messaging-ingest'),'sem outbox normal');
ok(!/console\.(?:log|error|warn|info)/.test(edge),'sem logs sensíveis');
ok(!/retry\s*\(|setInterval|while\s*\(/.test(edge),'nunca reenviar automaticamente');
ok(/ENABLE ROW LEVEL SECURITY/.test(sql)&&/REVOKE ALL ON TABLE/.test(sql),'RLS restritivo');
ok(/PRIMARY KEY/.test(sql),'dedupe único');
console.log('DFL R28 EDGE P9: '+count+' contratos herméticos aprovados, sem rede/WhatsApp.');
