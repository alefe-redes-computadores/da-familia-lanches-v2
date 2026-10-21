import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=(p)=>fs.readFileSync(p,'utf8');
const checks=[
 ['R1 página individual', 'scripts/test-site-v85-r1-mobile-product.mjs'],
 ['R2 Admin premium', 'scripts/test-site-v85-r2-admin-premium.mjs'],
 ['R3 checkout e performance', 'scripts/test-site-v85-r3-conversion-resilience.mjs'],
 ['R4 revisão de carrinho', 'scripts/test-site-v85-r4-cart-review.mjs'],
];
for(const [label,file] of checks){assert.ok(fs.existsSync(file),`Pendência: ${label}`);console.log('✓',label)}
const hook=read('src/hooks/useAdminOrders.ts');
const checkout=read('src/components/ui/CheckoutModal.tsx');
const catalog=read('src/lib/publicCatalogClient.ts');
const upload=read('src/lib/catalogImageClient.ts');
const imageApi=read('src/app/api/admin/catalog-image/route.ts');
const cart=read('src/components/ui/CartModal.tsx');
assert.equal((hook.match(/onSnapshot\s*\(/g)||[]).length,1,'Admin: apenas listener unico');
assert.ok(hook.includes('limit(100)'),'Admin: limite da consulta preservado');
assert.ok(checkout.includes('const clearConfirmedCart = () =>') && checkout.includes('clientRequestId'),'Pedido: confirma antes de limpar e usa idempotencia');
assert.ok(catalog.includes('RECOVERY_COOLDOWN_MS') && !catalog.includes('setInterval('),'Catálogo: recuperação sem polling');
assert.ok(upload.includes('IMAGE_TOO_LARGE_AFTER_COMPRESSION') && imageApi.includes('const MAX_BYTES = 640 * 1024'),'Imagens: falha clara e teto servidor');
assert.ok(cart.includes('catalogError || catalogSource !== "hybrid"'),'Carrinho: só reprecifica com fonte confiável');
console.log('\nR4 — GATES ESTATICOS DE LANCAMENTO OK; FALTA VALIDACAO VISUAL PWA/PRODUCAO APOS AUTORIZACAO');
