'use strict';
const fs=require('node:fs'), assert=require('node:assert/strict'), ts=require('typescript');
const rd=p=>fs.readFileSync(p,'utf8');
const cart=rd('src/components/ui/CartModal.tsx');
const cartCss=rd('src/components/ui/CartModal.module.css');
const page=rd('src/app/page.tsx');
const pageCss=rd('src/app/page.module.css');
const base=rd('src/components/ui/ModalBase.tsx');
const baseCss=rd('src/components/ui/ModalBase.module.css');
for(const x of [
 'DFL-R29-CART-PREMIUM','catalogIndex = useMemo','catalogIndex.get(item.id)',
 'className={styles.itemMedia}','src={item.image}',
 'aria-label={`Remover ${item.name} do carrinho`}',
 'reconciliation.originalSignature','applyCatalogReview','orderStats',
 'handleIncreaseItem','handleDecreaseItem','getCartTotal',
])assert(cart.includes(x),'Carrinho sem contrato: '+x);
assert(!cart.includes('products.find(p=>p.id===item.id)'));
assert(!cart.includes('products.find((product) => product.id === item.id)'));
for(const x of ['DFL-R29-CATALOG-INDEX','productById = useMemo','productById.get(id)','rankCatalogProducts','catalogLoading','openProduct(product)'])assert(page.includes(x),'Home sem contrato: '+x);
assert.equal((page.match(/productById\.get\(id\)/g)||[]).length,2);
for(const x of ['DFL-R29-MODAL-A11Y','useId()','aria-labelledby={titleId}','id={titleId}','aria-label="Fechar janela"'])assert(base.includes(x),'Modal sem contrato: '+x);
for(const [s,x] of [[cartCss,'DFL R29 CART PREMIUM'],[pageCss,'DFL R29 CATALOG MOBILE QUALITY'],[baseCss,'DFL R29 MODAL MOBILE A11Y']])assert(s.includes(x)&&s.includes('prefers-reduced-motion'),'CSS sem contrato: '+x);
for(const f of ['src/components/ui/CartModal.tsx','src/app/page.tsx','src/components/ui/ModalBase.tsx']){
 const ast=ts.createSourceFile(f,rd(f),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,f+': JSX invalido');
}
console.log('R29: contratos premium, acessibilidade e integridade de carrinho OK');
