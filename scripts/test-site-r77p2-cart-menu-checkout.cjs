'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const cases=[];const check=(label,ok)=>{assert.ok(ok,'R77 P2 '+label);cases.push(label)};
const cart=read('src/components/ui/CartModal.tsx');
const cartCss=read('src/components/ui/CartModal.module.css');
const checkout=read('src/components/ui/CheckoutModal.tsx');
const checkoutCss=read('src/components/ui/CheckoutModal.module.css');
const drawer=read('src/components/layout/MobileDrawerMenu.tsx');
const drawerCss=read('src/components/layout/MobileDrawerMenu.module.css');
for(const [path,content] of [
 ['src/components/ui/CartModal.tsx',cart],
 ['src/components/ui/CheckoutModal.tsx',checkout],
 ['src/components/layout/MobileDrawerMenu.tsx',drawer],
]){
 const a=ts.createSourceFile(path,content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 check(path+' sintaxe',a.parseDiagnostics.length===0);
}
check('revisao de itens na etapa 2',checkout.includes('aria-labelledby="r77-checkout-items-title"')&&checkout.indexOf('r77ItemsReview')>checkout.indexOf('step === 1 ? ('));
check('nome, quantidade, preco e adicionais sem inferencia',checkout.includes('item.quantity}× {item.name}')&&checkout.includes('item.price * item.quantity')&&checkout.includes('(item.selectedAddons ?? []).map((addon) => addon.name)'));
check('edicao retorna ao carrinho',checkout.includes('onClick={() => openModal("cart")} disabled={loading}>Editar itens'));
check('resumo com CSS responsivo',checkoutCss.includes('.r77ItemsReview')&&checkoutCss.includes('@media(max-width:420px)'));
check('checkout idempotente e consentimiento preservados',checkout.includes('submittingRef.current')&&checkout.includes('receiveWhatsappUpdates')&&checkout.includes('finishOrder(true)')&&checkout.includes('finishOrder(false)'));
check('carrinho mantem reconciliacao',cart.includes('applyCatalogReview')&&cart.includes('inspectLegacyCartForUnitDraft'));
check('carrinho mantem exclusao reversivel e CTA',cart.includes('canRestoreClearedCart')&&cart.includes('Continuar para finalizar'));
check('carrinho vazio icon Lucide',cart.includes('<ShoppingCart size={40}')&&cartCss.includes('.empty>svg'));
check('menu vinculado ao expediente oficial',drawer.includes('shopStatus.nextOpenLabel')&&drawer.includes('shopStatus.nextCloseLabel')&&drawerCss.includes('.r77OperationInfo'));
check('ajuda fecha menu na nova aba',drawer.includes('onClick={closeModal} target="_blank" rel="noopener noreferrer"'));
check('menu preserva foco e Escape',drawer.includes('event.key === "Escape"')&&drawer.includes('drawerRef.current?.focus'));
console.log('R77 P2 TESTES OK: '+cases.length+' contratos.');
