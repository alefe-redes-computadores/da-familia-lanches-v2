"use strict";
const fs=require('node:fs'),cp=require('node:child_process'),assert=require('node:assert/strict');
const workflow=fs.readFileSync('.github/workflows/build-admin-android.yml','utf8');
const validationBlock=workflow.split('      - name: Validar contratos Admin')[1]?.split('      - name: Gerar assets Android do Master')[0];
assert.ok(validationBlock,'Etapa real do CI Android encontrada');
const tests=[...validationBlock.matchAll(/^\s+node (scripts\/[\w.-]+\.(?:mjs|cjs))\s*$/gm)].map(x=>x[1]);
assert.ok(tests.length>=35,`Workflow inesperado: ${tests.length} testes`);
assert.ok(tests.includes('scripts/release-gate-catalog-v43.mjs'),'Gate legado do catalogo preservado');
assert.ok(tests.includes('scripts/test-android-release-gate-v50-1.mjs'),'Gate Android preservado');
const all=[...new Set([...tests,'scripts/test-site-sales-critical-r1.cjs','scripts/test-site-sales-operation-r2.cjs','scripts/test-site-sales-recovery-r3.cjs','scripts/test-site-sales-r4-resolver.cjs','scripts/test-site-sales-r5-ui-recovery.cjs','scripts/test-site-sales-r6-guard.cjs','scripts/test-site-v87-r1-premium.cjs','scripts/test-site-v87-r2-global.cjs','scripts/test-site-v87-r2-push-runtime.cjs','scripts/test-site-v87-r3-premium.cjs','scripts/test-site-v87-r4-global.cjs','scripts/test-site-v87-r5-admin.cjs','scripts/test-site-v88-safety.cjs','scripts/test-site-v89-operacao.cjs','scripts/test-site-v90-experiencia.cjs'])];
let count=0;
for(const t of all){if(!fs.existsSync(t))throw Error('Teste obrigatorio ausente: '+t);console.log(`\n▶ ${count+1}/${all.length}: ${t}`);const r=cp.spawnSync(process.execPath,[t],{stdio:'inherit'});if(r.status!==0)throw Error(`Falhou ${t} (${r.status??'signal'})`);count++;}
console.log('\n▶ TypeScript via Node (sem npx nem build)');
const tsc=cp.spawnSync(process.execPath,['node_modules/typescript/bin/tsc','--noEmit'],{stdio:'inherit'});if(tsc.status!==0)throw Error('TypeScript bloqueado');
console.log(`\nV88–V90 GATE LOCAL COMPLETO: ${count} suites, TypeScript OK. SEM BUILD.`);
