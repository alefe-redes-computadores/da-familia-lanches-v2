'use strict';
// R55 lightweight hermetic checks: no Firebase, provider, API, checkout, payment or external network.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
let checks=0;
const ok=(v,label)=>{assert.ok(v,label);checks++};
const files={
 product:'src/components/ui/ProductDetailsModal.tsx',
 checkout:'src/components/ui/CheckoutModal.tsx',
 checkoutCss:'src/components/ui/CheckoutModal.module.css',
 admin:'src/app/admin/page.tsx',
 adminCss:'src/app/admin/admin.module.css',
 toast:'src/components/ui/CartToast.module.css',
 header:'src/components/layout/Header.tsx',
 drawer:'src/components/layout/MobileDrawerMenu.tsx',
};
const x=Object.fromEntries(Object.entries(files).map(([key,p])=>[key,read(p)]));
for(const key of ['product','checkout','admin','header','drawer']){
 const f=files[key];
 const sf=ts.createSourceFile(f,x[key],ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 ok(sf.parseDiagnostics.length===0,'TSX parse '+f);
}
ok(!x.product.includes('openModal("login-prompt")'),'adicionar nao abre login');
ok(x.product.includes('addItem(product, quantity, selectedAddons, observation.trim())'),'carrinho preservado');
ok(x.product.includes('showCartToast({ title:'),'toast confirma compra sem login');
ok(x.product.includes('closeModal();'),'fecha personalizacao');
ok(!x.checkout.includes('readiness.done}/{readiness.total'),'sem placar de oito campos');
ok(!x.checkout.includes('readiness.items.map(item =>'),'sem chips repetidos');
ok(x.checkout.includes('readiness.next.hint')&&x.checkout.includes('focusNextCheckoutField'),'ajuda progressiva mantida');
ok(x.checkout.includes('!scheduleExpanded ? (')&&x.checkout.includes('Ver horários disponíveis'),'agenda recolhida ate cliente solicitar');
ok(x.checkout.includes('Boolean(bairro.trim() && rua.trim()) && <div className={styles.addressLiveSummary}'),'previa so depois de preencher');
ok(x.checkout.includes('inspectCheckoutReadiness')&&x.checkout.includes('finishOrder('),'validacao e finalizacao preservadas');
ok(x.checkout.includes('whatsappNotificationsConsent: consentChoice'),'consentimento intacto');
ok(x.checkout.includes('resolveCheckoutAttempt('),'idempotencia e recuperacao preservadas');
ok(x.checkout.includes('getOrderScheduleSlots()'),'agenda backend preservada');
ok(x.checkout.includes('role="switch"')&&x.checkout.includes('finishOrder(false)'),'opt-out segue acessivel');
ok(x.admin.includes('<details className={styles.r55StatsDisclosure}>')&&x.admin.includes('styles.overviewGrid'),'indicadores disponiveis sob demanda');
ok(x.admin.includes('<OrderCard')&&x.admin.includes('AdminQuickSwitcher'),'pedidos e navegacao mantidos');
ok(x.adminCss.includes('r55StatsDisclosure')&&x.adminCss.includes('@media(min-width:821px)'),'admin condensado desktop');
ok(x.toast.includes('.host{top:calc(72px')&&x.toast.includes('bottom:auto!important'),'toast deixa CTA inferior livre');
ok(x.header.includes('Agendamento disponível')&&x.drawer.includes('AGENDAMENTO'),'mensagem amigavel loja em modo teste');
ok(x.checkoutCss.includes('.r55ScheduleReveal')&&x.checkoutCss.includes('.r55CheckoutHint'),'estilos do checkout progressivo');
console.log(`R55 SITE: ${checks} contratos locais aprovados; sem rede e sem pedidos reais.`);
