'use strict';
const cp=require('node:child_process');
const files=['scripts/test-site-v88-r4-status.cjs','scripts/test-site-v89-r4-priority.cjs','scripts/test-site-v90-r4-favorites.cjs','scripts/test-site-v88-v90-r3-gate.cjs'];
for(const f of files){console.log('▶',f);let r=cp.spawnSync(process.execPath,[f],{stdio:'inherit'});if(r.status!==0)throw Error('Gate bloqueado: '+f)}
console.log('V88–V90 R4: testes de comportamento, Action Android completa, V87–V90 R1/R2/R3 e TypeScript aprovados');
