'use strict';
// Regressao de estabilidade visual: somente leitura; nao cria pedidos e nao altera dados.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const rd = p => fs.readFileSync(p,'utf8');
let n = 0;
function ok(test,label){assert.ok(test,`R107: ${label}`);console.log('OK R107:',label);n++}
const shell=rd('src/components/layout/AppShell.tsx');
const base=rd('src/components/ui/ModalBase.tsx');
const drawer=rd('src/components/layout/MobileDrawerMenu.tsx');
const assist=rd('src/components/layout/DFLAssist.tsx');
const shop=rd('src/components/product/ProductPublicPage.tsx');
const modal=rd('src/components/ui/ProductDetailsModal.tsx');
ok(!shell.includes('const shouldLock = Boolean(!isAdmin && activeModal)'),'AppShell nao duplica scroll lock');
ok(!shell.includes('document.body.style.overflow = "hidden"'),'AppShell deixa scroll lock para a camada ativa');
for(const [name,content] of [['ModalBase',base],['Menu',drawer],['Assist',assist]]){
  ok(content.includes('document.body.style.overflow = "hidden"'),`${name}: trava rolagem enquanto aberto`);
  ok(content.includes('document.body.style.overflow = '),`${name}: possui restauracao de overflow`);
}
ok(base.includes('document.body.style.overflow = priorOverflow'),'ModalBase restaura valor original');
ok(drawer.includes('document.body.style.overflow = overflow'),'Menu restaura valor original');
ok(assist.includes('document.body.style.overflow = overflow'),'Assist restaura valor original');
ok(shop.includes('rememberRecentProductId(product.id)'),'Historico e pagina individual preservados');
ok(modal.includes('onClick={closeModal}')&&modal.includes('Página completa'),'Transicao modal para pagina individual preservada');
ok(shell.includes('case "checkout": return <CheckoutModal />')&&shell.includes('case "product-details": return <ProductDetailsModal />'),'Modais continuam montados normalmente');
for(const p of ['src/components/layout/AppShell.tsx','src/components/ui/ModalBase.tsx','src/components/product/ProductPublicPage.tsx']){
 const ast=ts.createSourceFile(p,rd(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 ok(ast.parseDiagnostics.length===0,`TSX sintaticamente valido: ${p}`);
}
ok(rd('.github/workflows/build-admin-android.yml').includes('node scripts/test-site-r107-scroll-lock.cjs'),'Gate R107 incluido no Android');
ok(rd('.github/workflows/site-sales-protection.yml').includes('node scripts/test-site-r107-scroll-lock.cjs'),'Gate R107 incluido na protecao de vendas');
ok(rd('src/app/api/orders/route.ts').includes('tx.create(orderRef, canonicalOrder)')&&rd('src/components/ui/CheckoutModal.tsx').includes('orderAttemptRef.current'),'Checkout e idempotencia preservados');
console.log(`R107 PWA SCROLL LOCK: ${n} contratos aprovados; sem chamada a Firebase ou pedido comercial.`);
