'use strict';
/** DFL SITE R102: deterministic, read-only preopening release gate.
 * Never reaches Firebase or sends real orders.
 */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const read = p => fs.readFileSync(p,'utf8');
const check = (ok,msg)=>{assert(ok,msg);console.log('OK R102:',msg)};
const home = read('src/app/page.tsx');
const homeCss = read('src/app/page.module.css');
const assist = read('src/components/layout/DFLAssist.tsx');
const shell = read('src/components/layout/AppShell.tsx');
const nudge = read('src/components/layout/DFLAssistFloatingNudge.tsx');
const nudgeCss = read('src/components/layout/DFLAssistFloatingNudge.module.css');
const invitation = read('src/components/layout/DFLAssistInvitation.tsx');
const drawer = read('src/components/layout/MobileDrawerMenu.tsx');
const offers = read('src/components/layout/DFLAssistOffers.tsx');
const assistCss = read('src/components/layout/DFLAssist.module.css');
const checkout = read('src/components/ui/CheckoutModal.tsx');
const orderRoute = read('src/app/api/orders/route.ts');
const repo = read('src/lib/orderRepository.ts');
const admin = read('src/app/admin/page.tsx');
const card = read('src/components/layout/OrderCard.tsx');
const rewards = read('src/lib/rewards.ts');
const android = read('.github/workflows/build-admin-android.yml');
const sales = read('.github/workflows/site-sales-protection.yml');
// R39: R250/R251 moveram o CTA da Home para AppShell + FloatingNudge.
// Verificar o comportamento ATUAL sem ressuscitar codigo antigo na Home.
check(home.includes('catalogSearchFocused') &&
  home.includes('onFocus={() => setCatalogSearchFocused(true)}') &&
  home.includes('onBlur={() => setCatalogSearchFocused(false)}'),
  'campo de busca declara foco e desfoco corretamente');
check(nudge.includes('document.addEventListener("focusin", focusedInput)') &&
  nudge.includes('document.addEventListener("focusout", onBlur)') &&
  nudge.includes('node.closest("input,textarea,select,[contenteditable=true]")') &&
  nudge.includes('dismissed || inputActive || footerNear'),
  'atalho flutuante nao cobre campo de busca nem outros campos ativos');
check(nudge.includes('Boolean(activeModal)') &&
  nudge.includes('pathname !== "/"') &&
  invitation.includes('pathname !== "/" || activeModal') &&
  drawer.includes('activeModal === "menu"'),
  'CTA e convite nao cobrem modal, menu ou rotas secundarias');
check(!home.includes('className={styles.r102AssistEntry}') &&
  shell.includes('<DFLAssistFloatingNudge />') &&
  shell.includes('<DFLAssistInvitation />') &&
  home.includes('VisualCampaignBanner show={bannerEligible}') &&
  homeCss.includes('DFL-R102-FECHAMENTO-TOTAL'),
  'banner e Assist preservados em camadas distintas, sem entrada editorial duplicada');
check(nudge.includes('window.scrollY >= 240') &&
  nudge.includes('requestAnimationFrame(measure)') &&
  nudge.includes('sessionStorage.getItem(sessionKey)') &&
  nudge.includes('prefers-reduced-motion') &&
  nudgeCss.includes('env(safe-area-inset-bottom'),
  'atalho apos rolagem, com throttle, sessao, movimento reduzido e safe-area');
check(assist.includes('pathname === "/"') && assist.includes('sessionStorage.removeItem("dfl:pending-catalog-search")') && assist.includes('sessionStorage.setItem("dfl:pending-catalog-search", term)'), 'buscas na Home nao ressurgem na proxima visita');
check(assist.includes('CATALOG_SEARCH_EVENT') && assist.includes('router.push("/")'), 'busca entre paginas preservada');
check(offers.includes('r98BudgetPresets') && offers.includes('([3000, 4000, 5000, 6000, 8000, 10000] as const)') && !offers.includes('Até R$ 40</button>') && !offers.includes('Até R$ 60</button>'), 'orcamentos preservados em uma unica faixa de presets, sem duplicidade');
check(offers.includes('productLookup') && offers.includes('recommendDFLProducts') && offers.includes('catalogReady'), 'recomendacao somente catalogo confirmado, com indice local');
check(offers.includes('onOpenProduct(orderedOffers[0].product)') && !offers.includes('createCustomerOrder'), 'Assist abre produto, nunca cria pedido');
check(assistCss.includes('DFL-R102-FECHAMENTO-TOTAL') && assistCss.includes('safe-area-inset-top') && assistCss.includes('overflow-y:auto'), 'modal Assist tem altura e rolagem seguras');
check(admin.includes('actionLocksRef') && admin.includes('setOptimisticStatuses') && admin.includes('return false;') && admin.includes('return true;'), 'status Admin: lock, otimista e confirmacao real');
check(card.includes('if (confirmed !== true) return;'), 'cancelamento nao fecha por falso sucesso');
check(rewards.includes('const [summarySnapshot, configSnapshot] = await Promise.all(['), 'recompensas consultadas em paralelo');
check(checkout.includes('confirmedOrderId = created.id;') && checkout.includes('orderAttemptRef.current'), 'checkout so confirma apos ID persistido');
check(checkout.includes('orderOutcomeNeedsReview') && checkout.includes('orderAttemptRef.current'), 'recuperacao de resultados incertos preservada');
check(orderRoute.includes('tx.create(orderRef, canonicalOrder)') && orderRoute.includes('requestFingerprint') && orderRoute.includes('clientRequestId'), 'servidor guarda idempotencia e criacao atomica');
check(repo.includes('await runTransaction(db, async (transaction) =>') && repo.includes('ensureIntegrationEventInTransaction('), 'status e fila de integracao transacionais');
for(const f of ['test-site-sales-critical-r1.cjs','test-site-sales-operation-r2.cjs','test-site-sales-recovery-r3.cjs','test-site-r102-preopening.cjs']){
 check(android.includes('node scripts/'+f), 'Android protege '+f);
}
check(sales.includes('node scripts/test-site-r102-preopening.cjs'), 'CI de vendas valida preabertura R102');
check(!/onSnapshot\s*\(|getDocs\s*\(|getDoc\s*\(/.test(assist), 'painel visual Assist nao adiciona leitura Firebase');
console.log('R102 PREABERTURA — CONTRATOS OK; nenhuma chamada de rede ou pedido real.');
