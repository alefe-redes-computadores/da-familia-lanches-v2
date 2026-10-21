import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

// V85 R5: contrato de publicacao sem tocar no indice real e sem rede.
const BASE = '98a2d7f9343080a5aebead2c3f5ded8b9265e390';
const codeFiles = [
  'scripts/test-images-commerce-v52.mjs',
  'src/app/admin/page.tsx',
  'src/app/page.module.css',
  'src/app/page.tsx',
  'src/components/admin/CatalogAdmin.module.css',
  'src/components/admin/CatalogAdmin.tsx',
  'src/components/admin/StoreOperationAdmin.module.css',
  'src/components/admin/StoreOperationAdmin.tsx',
  'src/components/admin/ui/AdminExperienceProvider.tsx',
  'src/components/product/ProductPublicPage.module.css',
  'src/components/product/ProductPublicPage.tsx',
  'src/components/ui/CartModal.module.css',
  'src/components/ui/CartModal.tsx',
  'src/components/ui/CheckoutModal.tsx',
  'src/components/ui/ProductDetailsModal.module.css',
  'src/lib/catalogImageClient.ts',
  'src/lib/publicCatalogClient.ts',
];
const tests = [
  'scripts/test-site-v85-r1-mobile-product.mjs',
  'scripts/test-site-v85-r2-admin-premium.mjs',
  'scripts/test-site-v85-r3-conversion-resilience.mjs',
  'scripts/test-site-v85-r4-cart-review.mjs',
  'scripts/test-site-v85-release-inventory.mjs',
  'scripts/test-site-v85-r5-release-safe.mjs',
];
const excluded = [
  'src/lib/integration/contracts.ts',
  'src/lib/integration/server/reversePersistence.ts',
  'scripts/test-site-v82-order-push.mjs',
  'scripts/test-admin-v81.cjs',
  '.dfl-v40-20261005-124739.cjs',
  'dfl-v63-1-fix.cjs',
];
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const read=(file)=>fs.readFileSync(file,'utf8');
const ok=(yes, description)=>{
  assert.ok(yes,`V85 R5: ${description}`);
  console.log('✓',description);
};
ok(git('rev-parse','HEAD')===BASE,'release parte da V84 publicada, sem drift no HEAD');
ok(git('branch','--show-current')==='main','branch main confirmada');
for(const p of [...codeFiles,...tests]) ok(fs.existsSync(p),`arquivo presente: ${p}`);
const changed = new Set(git('diff','--name-only','HEAD','--',...codeFiles).split('\n').filter(Boolean));
ok(codeFiles.every(p=>changed.has(p)),'todos os 17 arquivos de codigo da V85 permanecem modificados');
const checkout=read('src/components/ui/CheckoutModal.tsx');
const cart=read('src/components/ui/CartModal.tsx');
const admin=read('src/hooks/useAdminOrders.ts');
const image=read('src/lib/catalogImageClient.ts');
const imageApi=read('src/app/api/admin/catalog-image/route.ts');
const catalog=read('src/lib/publicCatalogClient.ts');
const modal=read('src/components/ui/ProductDetailsModal.tsx');
const product=read('src/components/product/ProductPublicPage.tsx');
const organizer=read('src/components/admin/CatalogAdmin.tsx');
const source=read('src/lib/catalogComposition.ts');
ok(checkout.includes('clientRequestId')&&checkout.includes('clearConfirmedCart')&&checkout.includes('createCustomerOrder'),'checkout mantém idempotencia e limpeza somente apos pedido');
ok(checkout.includes('clearCheckoutDraft(null)'),'fluxo convidado ainda limpa rascunho apos sucesso');
ok(cart.includes('const reconciliation = useMemo(() => {')&&cart.includes('applyCatalogReview')&&cart.includes('disabled={Boolean(reconciliation)}'),'carrinho revisa mudancas antes de confirmar');
ok(cart.includes('catalogError || catalogSource !== "hybrid"'),'falha remota nao altera carrinho');
ok((admin.match(/onSnapshot\s*\(/g)||[]).length===1,'listener de pedidos continua unico');
ok(admin.includes('limit(100)'),'limite da consulta da fila preservado');
ok(image.includes('IMAGE_TOO_LARGE_AFTER_COMPRESSION')&&imageApi.includes('const MAX_BYTES = 640 * 1024'),'upload WebP respeita teto de servidor');
ok(catalog.includes('RECOVERY_COOLDOWN_MS')&&!catalog.includes('setInterval('),'recuperacao do catalogo sem polling');
ok(modal.includes('priority quality={72}'),'detalhe de produto mantém custo de imagem');
ok(product.includes('Compartilhar')||product.includes('share'),'pagina individual preserva compartilhamento');
ok(organizer.includes('validateBundleItems'),'editor valida composicao');
ok(source.includes('if (!product.bundleItems?.length) return []'),'texto legado nao vira ingredientes ou produtos inventados');
const release=new Set([...codeFiles,...tests]);
ok(excluded.every(p=>!release.has(p)),'integracao antiga, scripts soltos e V82 nao entrarao na V85');
console.log('\nDFL SITE V85 R5 — CONTRATOS DE RELEASE APROVADOS');
