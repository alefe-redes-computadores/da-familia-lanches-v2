'use strict';
// R235: offline/read-only source and real store schedule tests. Zero requests, Firebase or sales writes.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const read=f=>fs.readFileSync(f,'utf8');
let count=0;
const ok=(condition,message)=>{assert.ok(condition,message);count++;console.log('R235 OK:',message);};
const modal=read('src/components/ui/ProductDetailsModal.tsx');
const style=read('src/components/ui/ProductDetailsModal.module.css');
const cart=read('src/components/ui/CartModal.tsx');
const cartStyle=read('src/components/ui/CartModal.module.css');
const shell=read('src/components/layout/AppShell.module.css');
const home=read('src/app/page.tsx');
const homeStyle=read('src/app/page.module.css');
const checkout=read('src/components/ui/CheckoutModal.tsx');
const code=read('src/lib/storeSchedule.ts');
const files=[
 ['src/components/ui/ProductDetailsModal.tsx',ts.ScriptKind.TSX],
 ['src/components/ui/CartModal.tsx',ts.ScriptKind.TSX],
 ['src/app/page.tsx',ts.ScriptKind.TSX],
 ['src/components/ui/CheckoutModal.tsx',ts.ScriptKind.TSX],
 ['src/lib/storeSchedule.ts',ts.ScriptKind.TS],
];
for(const [filename,kind] of files){
 const parsed=ts.createSourceFile(filename,read(filename),ts.ScriptTarget.Latest,true,kind);
 ok(parsed.parseDiagnostics.length===0,`TS/JSX syntax: ${filename}`);
}
ok(modal.includes('bundlePieceCount = hasBundle ? bundleItems.reduce'),'composicao do combo usa as quantidades reais do cadastro');
ok(modal.includes('O sistema ainda não separa escolhas por lanche dentro do combo.'),'nao promete personalizacao individual inexistente');
ok(modal.includes('remoções não descontam automaticamente do preço.'),'remocoes nao alteram preco comercial');
ok(modal.includes('Adicionais do combo'),'escopo comercial explicito no seletor');
ok(modal.includes('por combo" : "por unidade"'),'adicionais discriminados por combo/unidade');
ok(modal.includes('addonsTotal * quantity'),'resumo dos extras acompanha quantidade');
ok(modal.includes('const total = (product.price + addonsTotal) * quantity;'),'formula original do preco preservada');
ok(modal.includes('addItem(product, quantity, selectedAddons, observation.trim())'),'payload original do carrinho preservado');
ok(modal.includes('inspectProductSelections(product,selectedAddons.map(item=>item.id))'),'validacao de adicionais preservada');
ok(modal.includes('aria-pressed={selected}'),'selecao de extra acessivel ao leitor de tela');
ok(modal.includes('aria-live="polite"')&&modal.includes('r235PriceContext'),'total e quantidade visiveis no rodape do modal');
ok(style.includes('.r235BundleScope')&&style.includes('.r235PriceContext'),'layout compacto da explicacao + preco');
ok(style.includes('env(safe-area-inset-bottom)'),'modal preserva safe area');
ok(cart.includes('item.bundleItems?.length')&&cart.includes('extras cobrados por combo; não por lanche'),'carrinho deixa escopo dos combos claro');
ok(cart.includes('item.price * item.quantity'),'carrinho preserva preco das linhas');
ok(cartStyle.includes('.r235ComboScope'),'observacao do carrinho compacta');
ok(shell.includes('padding-bottom:calc(108px + env(safe-area-inset-bottom,0px))'),'ultimo conteudo fica acima da barra e gestos do Android');
ok(shell.includes('.adminShell{padding-bottom:0!important}'),'layout do Admin nao perde isolamento');
ok(homeStyle.includes('scroll-padding-inline:10px')&&homeStyle.includes('object-position:center center'),'carrossel rolavel e imagem centralizada sem refazer identidade');
ok(home.includes('showcaseProducts.slice(0,2)')&&home.includes('showAllOffers'),'vitrine de seis ofertas conserva comportamento');
ok(home.includes('campaign.badgeLabel')&&home.includes('"OFERTA"'),'campanha vem do estado; fallback neutro permanece');
for(const [name,source] of [['Home',home],['Checkout',checkout]]){
 ok(source.includes('const [isOnline, setIsOnline] = useState(true);'),`${name}: estado inicial compativel com SSR`);
 ok(source.includes('syncConnectivity();')&&source.includes('navigator.onLine'),`${name}: consulta conexao na montagem`);
 ok(source.includes('window.addEventListener("pageshow",syncConnectivity)')&&source.includes('window.addEventListener("focus",syncConnectivity)'),`${name}: retoma conexao apos segundo plano`);
 ok(source.includes('window.removeEventListener("pageshow",syncConnectivity)')&&source.includes('window.removeEventListener("focus",syncConnectivity)'),`${name}: remove listeners ao desmontar`);
 ok(source.includes('document.addEventListener("visibilitychange",onVisible)')&&source.includes('document.removeEventListener("visibilitychange",onVisible)'),`${name}: retoma apenas quando aba visivel`);
}
ok(home.includes('!isOnline && <div className={styles.connectionNotice}'),'offline exibido apenas se detectar desconexao');
ok(checkout.includes('disabled={loading || !isOnline}'),'checkout continua impedindo envio offline');
ok(checkout.includes('orderOutcomeUncertain'),'recuperacao de pedido incerto nao tocada');
ok(read('src/app/api/orders/route.ts').includes('tx.create(orderRef, canonicalOrder)'),'gravacao transacional da API preservada');
ok(read('src/store/cart.store.ts').includes('const finalPrice = commercialPrice + addonsTotal'),'formula original da store preservada');
// Execute the existing store-status logic offline to verify Nov 2 (Monday) behavior.
const js=ts.transpileModule(code,{fileName:'storeSchedule.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};
new Function('module','exports',js)(m,m.exports);
const {normalizeStoreSettings,evaluateStoreStatus}=m.exports;
const monday=new Date('2026-11-02T22:00:00Z'); // Mon 19:00, Sao Paulo
ok(evaluateStoreStatus(normalizeStoreSettings({mode:'auto'}),monday).isOpen===false,'segunda-feira 02/11 fechada no padrao (sem inventar feriado)');
const exception={date:'2026-11-02',closed:false,open:'18:00',close:'22:30',label:'Abertura excepcional'};
ok(evaluateStoreStatus(normalizeStoreSettings({mode:'auto',exceptions:[exception]}),monday).isOpen===true,'excecao positiva da segunda-feira abre horario publicado');
ok(evaluateStoreStatus(normalizeStoreSettings({mode:'force_closed',exceptions:[exception]}),monday).isOpen===false,'fechamento manual prevalece sobre excecao');
ok(evaluateStoreStatus(normalizeStoreSettings({mode:'force_open'}),monday).isOpen===true,'abertura manual prevalece sem alterar agenda padrao');
ok(evaluateStoreStatus(normalizeStoreSettings({mode:'auto',exceptions:[{...exception,closed:true}]}),monday).isOpen===false,'excecao de fechamento prevalece');
console.log(`R235: ${count} verificacoes offline aprovadas; zero pedidos reais / zero alteracoes de Firestore.`);
