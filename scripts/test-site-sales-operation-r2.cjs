'use strict';
// Sales Gate R2: exercises REAL store-mode policy without network or production writes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const read=(p)=>fs.readFileSync(p,'utf8');
const policy=read('src/lib/storeSchedule.ts');
const code=ts.transpileModule(policy,{fileName:'storeSchedule.ts',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
assert.equal((code.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const sandboxModule={exports:{}};new Function('require','module','exports',code.outputText)(require,sandboxModule,sandboxModule.exports);
const {normalizeStoreSettings:normalize,evaluateStoreStatus:status,canPlaceImmediateTestOrder:access}=sandboxModule.exports;
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('✓',name)};
check('Fechamento manual SEMPRE fecha pedidos imediatos',()=>{
 assert.equal(status(normalize({mode:'force_closed'}),new Date('2026-10-25T22:00:00.000Z')).isOpen,false);
});
check('Abertura manual tem precedencia sobre agenda semanal',()=>{
 assert.equal(status(normalize({mode:'force_open'}),new Date('2026-10-26T22:00:00.000Z')).isOpen,true);
});
check('Agenda real: domingo 19h abre, segunda 19h fecha',()=>{
 assert.equal(status(normalize({mode:'auto'}),new Date('2026-10-25T22:00:00.000Z')).isOpen,true);
 assert.equal(status(normalize({mode:'auto'}),new Date('2026-10-26T22:00:00.000Z')).isOpen,false);
});
check('Modo manutencao/teste nao abre a loja publicamente',()=>{
 assert.equal(status(normalize({mode:'test_open'}),new Date('2026-10-25T22:00:00.000Z')).isOpen,false);
});
check('Email permitido SOMENTE em modo teste e com correspondencia exata',()=>{
 const cfg=normalize({mode:'test_open',testAllowedEmails:['BUYER@EXAMPLE.INVALID']});
 assert.equal(access(cfg,'buyer@example.invalid'),true);
 assert.equal(access(cfg,'buyer2@example.invalid'),false);
 assert.equal(access(cfg,undefined),false);
 assert.equal(access(normalize({mode:'force_closed',testAllowedEmails:['buyer@example.invalid']}),'buyer@example.invalid'),false);
});
check('Excecao de feriado ou manutencao fecha mesmo no horario comercial',()=>{
 const cfg=normalize({mode:'auto',exceptions:[{date:'2026-10-25',closed:true,label:'Fechado'}]});
 assert.equal(status(cfg,new Date('2026-10-25T22:00:00.000Z')).isOpen,false);
});
const route=read('src/app/api/orders/route.ts');
const checkout=read('src/components/ui/CheckoutModal.tsx');
const critical=read('scripts/test-site-sales-critical-r1.cjs');
const release=read('scripts/test-site-v88-v90-release-gate.cjs');
const android=read('.github/workflows/build-admin-android.yml');
const workflow=read('.github/workflows/site-sales-protection.yml');
const body=route.slice(route.indexOf('export async function POST'));
check('API confirma status do backend dentro da transaction ANTES de gravar',()=>{
 const begin=body.indexOf('await adminDb.runTransaction');
 const replay=body.indexOf('if (existingOrder.exists)',begin);
 const storeRead=body.indexOf('tx.get(adminDb.doc("settings/loja"))',replay);
 const gate=body.indexOf('throw new Error("SCHEDULE_REQUIRED")',storeRead);
 const write=body.indexOf('tx.create(orderRef, canonicalOrder)',gate);
 assert(begin>=0&&replay>begin&&storeRead>replay&&gate>storeRead&&write>gate);
});
check('Somente identidade Google VALIDADA recebe autorizacao teste',()=>{
 assert(body.includes('canPlaceImmediateTestOrder(authoritativeStore, decoded?.email)'));
 assert(!body.includes('canPlaceImmediateTestOrder(authoritativeStore, incoming.userEmail)'));
});
check('Agendamento reutiliza snapshot da loja, sem leitura redundante',()=>{
 const hits=(body.match(/tx\.get\(adminDb\.doc\("settings\/loja"\)\)/g)||[]).length;
 assert.equal(hits,1);
 assert(body.includes('const store = authoritativeStore;'));
});
check('Cliente recebe feedback de fechamento e caminho de agendamento',()=>{
 assert(checkout.includes('if (code === "SCHEDULE_REQUIRED") {'));
 assert(checkout.includes('setShopClosed(true);'));
 assert(checkout.includes('setStep(1);'));
 assert(checkout.includes('getOrderScheduleSlots()'));
 assert(checkout.includes('clearConfirmedCart()'));
 assert(checkout.includes('orderAttemptRef.current'));
});
check('Teste transacional P0 inclui corrida de fechamento e idempotencia',()=>{
 for(const phrase of ['R2: loja fechada rejeita pedido imediato','R2: whitelist nao autoriza convidados',
  'R2: login Google autorizado','R2: modo teste com email diferente',
  'R2: idempotencia recupera pedido mesmo apos fechar','R2: agendamento continua'])
  assert(critical.includes(phrase),phrase);
});
check('R2 integrada na CI, Android e gate de release',()=>{
 for(const v of [release,android,workflow])assert(v.includes('scripts/test-site-sales-operation-r2.cjs'));
});
console.log(`\nDFL SITE SALES GATE R2 — ${passed} validacoes complementares aprovadas. ZERO writes reais.`);
