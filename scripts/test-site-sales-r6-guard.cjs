'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const read = (p) => fs.readFileSync(p,'utf8');
const route = read('src/app/api/orders/resolve/route.ts');
const orders = read('src/app/api/orders/route.ts');
const checkout = read('src/components/ui/CheckoutModal.tsx');
const workflow = read('.github/workflows/site-sales-protection.yml');
const release = read('scripts/test-site-v88-v90-release-gate.cjs');
const repository = read('src/lib/orderRepository.ts');
// Token SHA-256 usa .update(); nao confundir com persistencia.
assert.match(route,/export async function POST\(/,'Resolver POST obrigatorio');
assert.match(route,/adminAuth\.verifyIdToken/,'Conta Google autenticada');
assert.match(route,/timingSafeEqual/,'Comparacao segura do segredo');
assert.match(route,/clientRequestId/,'Tentativa original exigida');
assert.match(route,/guest_/,'Convidado vinculado à tentativa');
assert.match(route,/outcome: ['"]found['"]/,'Resultado encontrado');
assert.match(route,/outcome: ['"]not_found['"]/,'Resultado ausente');
assert.match(route,/outcome: ['"]unknown['"]/,'Resultado incerto');
assert.match(route,/\.doc\(orderId\)\.get\(\)/,'Consulta read-only ao pedido');
assert.doesNotMatch(route,/\b(?:tx|transaction|adminDb)\.(?:set|create|update|delete|runTransaction|batch)\s*\(/,'Sem escrita Firestore');
assert.doesNotMatch(route,/\b(?:sendAdminNewOrderPush|drainIntegrationOutboxEvent|createCustomerOrder)\s*\(/,'Sem notificacao ou pedido');
assert.match(repository,/ORDER_TIMEOUT/,'Timeout da chamada é incerto');
assert.match(repository,/ORDER_NETWORK/,'Falha de rede é incerta');
assert.match(checkout,/orderOutcomeNeedsReview/,'UI separa rejeicao de incerteza');
assert.match(checkout,/clearConfirmedCart/,'Carrinho preservado antes de confirmar');
assert.match(orders,/requestFingerprint/,'Backend bloqueia reuso divergente');
assert.match(orders,/tx\.create\(orderRef, canonicalOrder\)/,'Criação transacional');
for(const path of ['scripts/test-site-sales-critical-r1.cjs','scripts/test-site-sales-operation-r2.cjs','scripts/test-site-sales-recovery-r3.cjs','scripts/test-site-sales-r4-resolver.cjs','scripts/test-site-sales-r5-ui-recovery.cjs','scripts/test-site-sales-r6-guard.cjs']){
  assert(fs.existsSync(path),`Suíte ausente: ${path}`);
  assert(workflow.includes(path),`CI não chama ${path}`);
  assert(release.includes(path),`Gate local não chama ${path}`);
}
assert(!/\b(?:next build|npm run build)\b/.test(workflow),'CI de vendas sem build');
console.log('R6: contratos de segurança e CI integral: OK');
