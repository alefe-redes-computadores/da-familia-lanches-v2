'use strict';
const cp=require('node:child_process'),fs=require('node:fs');
const tests=[
'scripts/test-site-v88-r2-draft.cjs',
'scripts/test-site-v89-r2-agenda.cjs',
'scripts/test-site-v90-r2-commerce.cjs',
'scripts/test-site-v88-v90-release-gate.cjs',
];
let done=0;for(const file of tests){if(!fs.existsSync(file))throw Error('Gate ausente: '+file);console.log('▶ GATE R2:',file);const result=cp.spawnSync(process.execPath,[file],{stdio:'inherit'});if(result.status!==0)throw Error(`Gate R2 falhou: ${file}`);done++;}
console.log(`V88–V90 R2: ${done} contratos e gate completo aprovados; sem build local`);
