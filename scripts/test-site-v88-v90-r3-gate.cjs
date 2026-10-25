'use strict';
const cp=require('node:child_process'),fs=require('node:fs'),assert=require('node:assert/strict');
const workflow=fs.readFileSync('.github/workflows/build-admin-android.yml','utf8');
const body=workflow.split('      - name: Validar contratos Admin')[1]?.split('      - name: Gerar assets Android do Master')[0];
assert.ok(body,'Etapa real da Action não identificada');
const tests=[...body.matchAll(/^\s+node (scripts\/[\w.-]+\.(?:mjs|cjs))\s*$/gm)].map(m=>m[1]);
assert.ok(tests.length>=35,'Gate Android incompleto: '+tests.length);
const extra=[
 'scripts/test-site-v87-r1-premium.cjs','scripts/test-site-v87-r2-global.cjs','scripts/test-site-v87-r2-push-runtime.cjs','scripts/test-site-v87-r3-premium.cjs','scripts/test-site-v87-r4-global.cjs','scripts/test-site-v87-r5-admin.cjs',
 'scripts/test-site-v88-safety.cjs','scripts/test-site-v89-operacao.cjs','scripts/test-site-v90-experiencia.cjs',
 'scripts/test-site-v88-r2-draft.cjs','scripts/test-site-v89-r2-agenda.cjs','scripts/test-site-v90-r2-commerce.cjs',
 'scripts/test-site-v88-r3-order-recovery.cjs','scripts/test-site-v89-r3-overdue.cjs','scripts/test-site-v90-r3-favorites.cjs'];
const all=[...new Set([...extra,...tests])];
for(let i=0;i<all.length;i++){
 const p=all[i]; if(!fs.existsSync(p))throw Error('Suite ausente: '+p);
 console.log(`▶ ${i+1}/${all.length} ${p}`);
 const proc=cp.spawnSync(process.execPath,[p],{stdio:'inherit'});
 if(proc.status!==0)throw Error(`Gate bloqueado: ${p} = ${proc.status??'signal'}`);
}
console.log('▶ TypeScript sem build local');
const ts=cp.spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit'],{stdio:'inherit'});
if(ts.status!==0)throw Error('tsc --noEmit bloqueou release');
console.log(`V88–V90 R3: ${all.length} suites + TypeScript APROVADOS`);
