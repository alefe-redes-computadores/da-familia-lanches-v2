'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const read = p => fs.readFileSync(p, 'utf8');
const file = {
  assist: 'src/components/layout/DFLAssistOffers.tsx',
  engine: 'src/lib/dflAssistRecommendations.ts',
  checkout: 'src/components/ui/CheckoutModal.tsx',
  streets: 'src/components/ui/StreetSuggestions.tsx',
  cart: 'src/components/ui/CartModal.tsx',
  detail: 'src/components/ui/ProductDetailsModal.tsx',
  home: 'src/app/page.tsx',
  base: 'src/components/ui/ModalBase.tsx',
  upsell: 'src/lib/upsellEntitlement.ts',
  image: 'src/components/ui/CatalogImage.tsx',
  api: 'src/app/api/orders/route.ts',
  v90: 'scripts/test-site-v90-experiencia.cjs',
};
let count = 0;
function contract(ok, label) {
  assert.ok(ok, label);
  console.log('✓', label);
  count++;
}
for (const p of Object.values(file)) contract(fs.existsSync(p), `arquivo ${p}`);
const a = read(file.assist);
const e = read(file.engine);
const c = read(file.checkout);
const st = read(file.streets);
const cart = read(file.cart);
const detail = read(file.detail);
const home = read(file.home);
const modal = read(file.base);
const upsell = read(file.upsell);
const image = read(file.image);
const api = read(file.api);
const v90 = read(file.v90);
contract(a.includes('source === "hybrid"') && a.includes('recommendDFLProducts('), 'assistente so recomenda catalogo confirmado');
contract(!/\b(?:fetch|addDoc|setDoc|createCustomerOrder)\s*\(/.test(e), 'motor de recomendacoes sem acesso a rede/escrita');
contract(c.includes('orderAttemptRef') && c.includes('resolveCheckoutAttempt'), 'checkout preserva recuperacao de tentativa');
contract(c.includes('!orderOutcomeUncertain && fallbackWhatsAppUrl'), 'WhatsApp nao substitui pedido de resultado incerto');
contract(c.includes('getDeliveryTableCached') && c.includes('matchDeliveryRate'), 'tabela de entrega permanece configuravel');
contract(st.includes('AbortController') && st.includes('NEXT_PUBLIC_DFL_STREET_SUGGEST_ENABLED'), 'autocomplete opcional e cancelavel');
contract(cart.includes('reconciliation.originalSignature') && cart.includes('openModal("checkout")'), 'reconciliacao explicita antes de finalizar');
contract(cart.includes('remainingUpsellUnits(') && detail.includes('upsellRemaining <= 0'), 'oferta vinculada protegida em duas interfaces');
contract(upsell.includes('Math.max(0, main - used)') && !/\b(?:fetch|getDoc|addDoc|setDoc)\s*\(/.test(upsell), 'elegibilidade promocional local e sem chamadas externas');
contract(modal.includes('aria-labelledby={titleId}') && modal.includes('event.key === "Tab"'), 'dialogo rotulado e teclado protegido');
contract(home.includes('rankCatalogProducts(') && home.includes('productById.get(id)'), 'busca e favoritos usam indexacao');
contract(image.includes('next/image') && image.includes('loading={priority ? "eager" : "lazy"}'), 'imagens com estrategia de prioridade');
contract(api.includes('IDEMPOTENCY_CONFLICT') && api.includes('tx.create(orderRef, canonicalOrder)'), 'API conserva idempotencia autoritativa');
contract(v90.includes('optimizedCategoryFilter'), 'V90 testa indice memoizado e nao sintaxe historica');
for (const p of [file.assist,file.checkout,file.streets,file.cart,file.detail,file.home,file.base]) {
  const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  contract(ast.parseDiagnostics.length===0,`TSX parse ${p}`);
}
for (const t of ['r27-premium','r28-global-ux','r29-premium','r30-premium']) {
  contract(fs.existsSync(`scripts/test-site-${t}.cjs`), `suíte R27-R30: ${t}`);
}
console.log(`R31: ${count} contratos de fechamento aprovados. SEM BUILD.`);
