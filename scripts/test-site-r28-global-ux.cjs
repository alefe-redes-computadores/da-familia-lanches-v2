'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const h=read('src/components/layout/Header.tsx');
const hc=read('src/components/layout/header.module.css');
const a=read('src/components/layout/DFLAssist.tsx');
const ac=read('src/components/layout/DFLAssist.module.css');
const d=read('src/components/layout/MobileDrawerMenu.tsx');
const dc=read('src/components/layout/MobileDrawerMenu.module.css');
const st=read('src/components/ui/StreetSuggestions.tsx');
const sc=read('src/components/ui/StreetSuggestions.module.css');
const c=read('src/components/ui/CheckoutModal.tsx');
const t=read('src/components/ui/CartToast.module.css');
const checks=[
 ['scroll por frame',h.includes('window.requestAnimationFrame(update)')],
 ['scroll listener passivo',h.includes('"scroll", onScroll, { passive: true }')],
 ['scroll cleanup',h.includes('window.cancelAnimationFrame(frame)')],
 ['header 320px',hc.includes('@media(max-width:335px)')],
 ['header foco mobile',hc.includes('MOBILE HEADER FIT')],
 ['assist foco panel',a.includes('ref={panelRef} tabIndex={-1}')],
 ['assist teclado Tab',a.includes('event.key !== "Tab"')],
 ['assist Esc',a.includes('event.key === "Escape"')],
 ['assist desbloqueia scroll',a.includes('document.body.style.overflow = overflow')],
 ['assist segura rolagem',ac.includes('overscroll-behavior:contain')],
 ['drawer foco',d.includes('ref={drawerRef} tabIndex={-1}')],
 ['drawer acessivel',d.includes('document.body.style.overflow = overflow')],
 ['drawer dimensoes tela',dc.includes('height:100dvh')],
 ['drawer safe area',dc.includes('safe-area-inset-bottom')],
 ['rua feature flag',st.includes('NEXT_PUBLIC_DFL_STREET_SUGGEST_ENABLED')],
 ['rua timeout e abort',st.includes('AbortController') && st.includes('window.clearTimeout(timer)')],
 ['rua cache em memoria',st.includes('STREET_CACHE_TTL = 120_000')],
 ['rua cache limitado',st.includes('streetMemory.size > 32')],
 ['rua selecionada sem requery',st.includes('lastPickedRef.current === cacheKey')],
 ['rua filtro cidade',st.includes('item.city === "Patos de Minas" && item.state === "MG"')],
 ['rua manual preservada',st.includes('onSelect(item.name)')],
 ['rua acessibilidade visual',sc.includes('focus-visible')],
 ['frete stale guard',c.includes('deliveryFeeRequestRef.current') && c.includes('if (requestId !== deliveryFeeRequestRef.current) return;')],
 ['frete invalida digitacao',c.includes('deliveryFeeRequestRef.current += 1')],
 ['frete server mantido',c.includes('getDeliveryTableCached') && c.includes('matchDeliveryRate')],
 ['pedido idempotente preservado',c.includes('orderAttemptRef') && c.includes('createCustomerOrder')],
 ['toast responsivo',t.includes('DFL R28 TOAST MOBILE POLISH')],
 ['sem escrita de pedido na autocomplete',!/createCustomerOrder|addDoc\(|setDoc\(/.test(st)],
];
let fails=0;
for(const [label,ok] of checks){console.log(`${ok?'OK':'FALHOU'}: ${label}`);if(!ok) fails++}
assert.equal(fails,0,`${fails} contratos falharam`);
for(const p of ['src/components/layout/Header.tsx','src/components/layout/DFLAssist.tsx','src/components/layout/MobileDrawerMenu.tsx','src/components/ui/StreetSuggestions.tsx','src/components/ui/CheckoutModal.tsx']){
 const ast=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,`${p}: JSX invalido`);
}
console.log(`R28: ${checks.length} contratos + JSX OK`);
