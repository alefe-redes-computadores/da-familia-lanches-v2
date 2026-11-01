'use strict';
/** R233-R3 consistency gate for Sales R1 test and new street validator.
 * No Firestore, network, production order, or external dependencies besides local TypeScript.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const gate=read('scripts/test-site-sales-critical-r1.cjs');
const realSource=read('src/lib/streetNameSafety.ts');
const api=read('src/app/api/orders/route.ts');
const workflow=read('.github/workflows/site-sales-protection.yml');
const transpiled=ts.transpileModule(realSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const mod={exports:{}};
new Function('module','exports',transpiled)(mod,mod.exports);
const guard=mod.exports.streetNeedsClarification;
assert.equal(typeof guard,'function','real validator exported');
assert.equal(guard('Rua Deze'),true,'partial address rejected');
assert.equal(guard('Rua Dezesseis'),false,'complete address preserved');
assert.equal(guard('Rua Dez'),false,'real short streets preserved');
const checks=[
 ['imports actual source',gate.includes("fs.readFileSync('src/lib/streetNameSafety.ts','utf8')")],
 ['compiles real TypeScript to CommonJS',gate.includes('ts.transpileModule(')&&gate.includes('streetGuardCode)(streetGuardModule,streetGuardModule.exports)')],
 ['strict module injection',gate.includes("'@/lib/streetNameSafety':streetGuardModule.exports")],
 ['street test input configurable',gate.includes("street:override.street??'Rua de Teste'")],
 ['reject incomplete via real POST',gate.includes("R233-R3: Rua Deze incompleta nao grava pedido ou outbox")],
 ['check no write on rejection',gate.includes('assert.equal(docs.size,before)')],
 ['accept and preserve full via real POST',gate.includes("R233-R3: Rua Dezesseis preservada integralmente no pedido")],
 ['API production guard present',api.includes('streetNeedsClarification(delivery.street)')],
 ['sales CI runs gate',workflow.includes('node scripts/test-site-r233-sales-mock.cjs')],
 ['legacy sales gate still runs',workflow.includes('node scripts/test-site-sales-critical-r1.cjs')],
];
for(const [label,okay] of checks)assert.ok(okay,label);
const parsed=ts.createSourceFile('orders.ts',api,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
assert.equal(parsed.parseDiagnostics.length,0,'API TypeScript syntax');
console.log(`R233-R3 SALES: ${checks.length+4} contract checks OK, real pure guard, no commercial orders.`);
