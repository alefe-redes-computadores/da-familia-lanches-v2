'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const menu=read('src/components/layout/MobileDrawerMenu.tsx');
const cart=read('src/components/ui/CartModal.tsx');
const toast=read('src/components/ui/CartToast.tsx');
const home=read('src/app/page.tsx');
const safety=read('src/lib/cartRestoreSafety.ts');
const menuCss=read('src/components/layout/MobileDrawerMenu.module.css');
const cartCss=read('src/components/ui/CartModal.module.css');
const toastCss=read('src/components/ui/CartToast.module.css');
const homeCss=read('src/app/page.module.css');
for (const [name,yes] of [
 ['convidado abre Meus Pedidos sem login',menu.includes('destination === "orders" || currentUser ? destination : "login"')],
 ['contagem de pedidos do convidado local',menu.includes('readGuestOrders().length')],
 ['historico de convidado sem novo fetch',!menu.includes('fetch(')],
 ['status manutencao distinto de fechado',menu.includes('shopStatus.mode === "test_open"')],
 ['compartilhamento nativo nao diz link copiado',menu.includes('setShared("shared")') && menu.includes('setShared("copied")')],
 ['compartilhamento nao reporta sucesso na falha',menu.includes('setShared("failed")')],
 ['carrinho preserva a confirmacao de 8 segundos',cart.includes('setClearArmed(false), 8000')],
 ['limpar carrinho oferece desfazer',cart.includes('actionLabel: "Desfazer"')],
 ['restauracao bloqueada quando o carrinho mudou',cart.includes('!canRestoreClearedCart(state.items, snapshot)')],
 ['restauracao nao altera API do pedido',!safety.includes('fetch(') && !safety.includes('firebase')],
 ['vinculo upsell preservado',cart.includes('remainingUpsellUnits(')],
 ['limite 30 preservado',cart.includes('disabled={item.quantity >= 30}')],
 ['entrega gratis depende de bairro',cart.includes('sujeita à confirmação do bairro')],
 ['toast com duracao maior para acao',toast.includes('toast.onAction ? 9000 : 3000')],
 ['toast pausa em foco',toast.includes('onFocusCapture') && toast.includes('onBlurCapture')],
 ['toast pausa ao tocar/hover',toast.includes('onMouseEnter') && toast.includes('onMouseLeave')],
 ['busca sem resultado mostra alternativas',home.includes('styles.emptyRecovery') && home.includes('Buscar combos')],
 ['DFL Assist recupera busca sem resultado',home.includes('new Event("dfl:assist-open")')],
 ['estilo guest responsivo',menuCss.includes('DFL-R32-GUEST-DRAWER')],
 ['estilo cart responsivo',cartCss.includes('DFL-R32-CART-RECOVERY')],
 ['estilo toast responsivo',toastCss.includes('DFL-R32-TOAST-ACCESSIBLE')],
 ['estilo busca responsivo',homeCss.includes('DFL-R32-CATALOG-RECOVERY')],
]){assert(yes,'R32: '+name);console.log('✓',name)}
for(const p of [
 'src/components/layout/MobileDrawerMenu.tsx',
 'src/components/ui/CartModal.tsx',
 'src/components/ui/CartToast.tsx',
 'src/app/page.tsx',
 'src/lib/cartRestoreSafety.ts',
]){
 const tree=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 assert.equal(tree.parseDiagnostics.length,0,p+': JSX/TS invalido');
}
const transpiled=ts.transpileModule(safety,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const impl={exports:{}};
new Function('module','exports',transpiled)(impl,impl.exports);
const can=impl.exports.canRestoreClearedCart;
const original=[{cartId:'x',quantity:2,selectedAddons:[]}];
assert.equal(can([],original),true);
assert.equal(can([{cartId:'novo',quantity:1}],original),false);
assert.equal(can([],[]),false);
assert.equal(can([],[{cartId:'x',quantity:31}]),false);
assert.equal(can([],[{cartId:'',quantity:1}]),false);
assert.equal(can([],[{cartId:'x',quantity:1.5}]),false);
console.log('R32: 22 contratos e 6 cenarios reais de desfazer aprovados');
