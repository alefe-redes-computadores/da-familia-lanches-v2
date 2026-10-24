"use strict";
const fs=require('node:fs');const assert=require('node:assert/strict');const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');let checks=0;
function ok(a,b){assert.ok(a,`V87 R3: ${b}`);console.log('✓',b);checks++}
const page=read('src/app/admin/page.tsx');
const adminCss=read('src/app/admin/admin.module.css');
const quick=read('src/components/admin/AdminQuickSwitcher.tsx');
const quickCss=read('src/components/admin/AdminQuickSwitcher.module.css');
const product=read('src/components/product/ProductPublicPage.tsx');
const productCss=read('src/components/product/ProductPublicPage.module.css');
const header=read('src/components/layout/Header.tsx');
const checkoutCss=read('src/components/ui/CheckoutModal.module.css');
const detailCss=read('src/components/ui/ProductDetailsModal.module.css');
const old=read('src/lib/adminPush/server.ts');
ok(page.includes('import { AdminQuickSwitcher, type AdminQuickTarget }'),'Admin: componente integrado');
ok(page.includes('setQuickSwitcherOpen(true)')&&page.includes('Control+K Meta+K'),'Admin: teclado e triggers');
ok(page.includes('window.removeEventListener("keydown", onQuickShortcut)'),'Admin: listener limpo');
ok(page.includes('onAttention={() => { setTab("cozinha"); setAttentionOnly(true);'),'Admin: prioridade integrada');
ok(page.includes('onNotifications={() => setNotificationCenterOpen(true)}')&&page.includes('onStore={() => setStoreQuickOpen(true)}'),'Admin: reuso de paineis antigos');
ok(!quick.includes('firebase/firestore')&&!quick.includes('onSnapshot(')&&!quick.includes('fetch('),'Admin: zero requisições extras');
ok(quick.includes('role="dialog"')&&quick.includes('aria-modal="true"')&&quick.includes('role="combobox"'),'Admin: diálogo acessível');
ok(quick.includes('observer')===false,'Admin: sem observadores por item');
ok(quick.includes('simplify(')&&quick.includes('tokens.every('),'Admin: busca acento-insensível e combinada');
ok(quick.includes('event.key === "ArrowDown"')&&quick.includes('event.key === "Enter"')&&quick.includes('event.key === "Escape"'),'Admin: teclado completo');
ok(quickCss.includes('prefers-reduced-motion')&&adminCss.includes('DFL SITE V87 R3 — ADMIN QUICK ACCESS'),'Admin: responsividade e movimento');
ok(product.includes('IntersectionObserver')&&product.includes('observer.disconnect()'),'Cliente: CTA contextual sem polling');
ok(product.includes('floatingBuyVisible')&&product.includes('ref={primaryActionRef}')&&product.includes('openModal("product-details", product)'),'Cliente: CTA abre personalização original');
ok(productCss.includes('bottom:calc(88px + env(safe-area-inset-bottom')&&productCss.includes('DFL SITE V87 R2 — PRODUCT DETAIL REFINEMENT'),'Cliente: CTA acima do menu inferior e R2 preservadas');
ok(header.includes('window.removeEventListener("keydown", onEscape)')&&header.includes('setShowMenu(false); }, [pathname]'),'Header: limpeza e fechamento em navegação');
ok(checkoutCss.includes('DFL SITE V87 R3 — CHECKOUT KEYBOARD & TOUCH'),'Checkout: controles mobile');
ok(detailCss.includes('DFL SITE V87 R3 — MODIFIERS ACCESSIBILITY'),'Modal: adicionais acessíveis');
ok(old.includes('retryPendingAdminPushes'),'R2: recuperação de push preservada');
ok(read('src/store/cart.store.ts').includes('clampCartQuantity'),'R2: limite comercial do carrinho preservado');
ok(read('src/components/product/ProductPublicPage.tsx').includes('shareUrl'),'Compartilhamento V85 mantido');
for(const file of ['src/components/admin/AdminQuickSwitcher.tsx','src/app/admin/page.tsx','src/components/product/ProductPublicPage.tsx','src/components/layout/Header.tsx']){
 const transpiled=ts.transpileModule(read(file),{fileName:file,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}});
 ok(!(transpiled.diagnostics||[]).some(x=>x.category===ts.DiagnosticCategory.Error),`Sintaxe TSX: ${file}`);
}
console.log(`V87 R3 — ${checks} contratos aprovados`);
