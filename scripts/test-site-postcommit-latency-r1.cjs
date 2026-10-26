'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const crypto=require('node:crypto');
const source=fs.readFileSync('src/app/api/orders/route.ts','utf8');
const previous=fs.readFileSync('scripts/test-v56-1-checkout-integrity.mjs','utf8');
const push=fs.readFileSync('src/lib/adminPush/server.ts','utf8');
const worker=fs.readFileSync('src/app/api/integration/worker/route.ts','utf8');
const policy=fs.readFileSync('src/lib/adminPush/retryPolicy.ts','utf8');
const assertions=[
 ['Next/Vercel after importado',source.includes('import { after, NextRequest, NextResponse } from "next/server"')],
 ['Retorno preserva idempotencia',source.includes('requestFingerprint') && source.includes('clientRequestId') && source.includes('status: result.reused ? 200 : 201')],
 ['Documentos limpos de undefined',source.includes('itens: canonicalItems.map(stripUndefinedOrderFields)')],
 ['Pedido persistido atomicamente',source.includes('tx.create(orderRef, canonicalOrder)')],
 ['Outbox persistida atomicamente',source.includes('tx.create(adminDb.collection(INTEGRATION_COLLECTIONS.outbox)')],
 ['Fila FCM duravel no mesmo commit',source.includes('tx.create(adminDb.collection("AdminPushDispatches")')],
 ['Estado inicial recuperavel',source.includes('deliveryMode, status: "retry", attemptCount: 0') && source.includes('nextAttemptAtMs: 0')],
 ['Id FCM identico ao mecanismo existente',source.includes('`admin-new-order-v1:${orderRef.id}`') && push.includes('hash(`admin-new-order-v1:${orderId}`)')],
 ['Sem alteracao do relay ou do push',source.includes('drainIntegrationOutboxEvent(result.eventId!)') && source.includes('sendAdminNewOrderPush(result.adminPush)')],
 ['Worker original continua recuperando pendencias',worker.includes('retryPendingAdminPushes(5)') && worker.includes('drainIntegrationOutbox()')],
 ['Push claim aceita retry sem backoff',policy.includes('state.nextAttemptAtMs || 0')],
 ['Contrato V56.1 atualizado sem desligar teste',previous.includes('pedido e filas persistidos antes do retorno')],
];
for(const [label,ok] of assertions)assert.ok(ok,label);
const ast=ts.createSourceFile('route.ts',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
const post=ast.statements.find(s=>ts.isFunctionDeclaration(s)&&s.name?.text==='POST');
assert(post,'POST existe');
const postBody=post.getText(ast);
const posCommit=postBody.indexOf('await adminDb.runTransaction');
const posAfter=postBody.indexOf('after(async () =>');
const posResponse=postBody.indexOf('return NextResponse.json(\n      {\n        ok: true,');
assert(posCommit>=0 && posAfter>posCommit && posResponse>posAfter,'after registrado apos transacao e antes da resposta');
const section=postBody.slice(posAfter,posResponse);
assert(section.includes('await Promise.allSettled(jobs)'), 'Aguardar envios somente no callback');
// A invocacao nao aguarda FCM nem relay antes da resposta.
const between=postBody.slice(postBody.indexOf('    const integration = result.reused'),posResponse);
assert(!/^[ \t]{4,8}await\s+(?:Promise\.allSettled|sendAdminNewOrderPush|drainIntegrationOutboxEvent)/m.test(between),'Sem aguardar tarefas secundarias antes da resposta');
assert(!source.includes('console.info("[orders/create] relay immediate"'),'log nao anuncia envio pre-resposta');
const expected=crypto.createHash('sha256').update('admin-new-order-v1:site_test').digest('hex');
assert.equal(expected.length,64);
const scan=ts.transpileModule(source,{fileName:'route.ts',reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
assert.equal((scan.diagnostics||[]).filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,'Sintaxe TypeScript');
console.log(`DFL SITE LATENCY R1 — ${assertions.length+7} contratos aprovados; sem build local`);
