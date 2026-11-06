'use strict';
/** R292: regressao isolada da hierarquia do Admin. Nao grava dados nem faz rede. */
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
let passed=0;
const read=p=>fs.readFileSync(p,'utf8');
const check=(label,fn)=>{fn();passed++;console.log('R292 OK:',label)};
check('gate nao confunde comparacao TSX com select nativo',()=>{
  assert(!/<select\b/i.test('selected.endsOn<selected.startsOn'));
  assert(/<select\b/i.test('<select value={v}>'));
});
const files=['CatalogAdmin','CouponsAdmin','RewardsAdmin','MessagingCenterAdmin','StoreOperationAdmin','VisualCampaignsAdmin'];
for(const name of files){
 const p=`src/components/admin/${name}.tsx`,code=read(p);
 check(`${name}: sem <select> nativo`,()=>assert(!/<select\b/i.test(code),p));
 check(`${name}: seletor compartilhado`,()=>assert(code.includes('AdminChoiceSelect'),p));
 check(`${name}: TSX parsavel`,()=>assert.equal(ts.createSourceFile(p,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0,p));
}
const p='src/components/admin/ui/AdminChoiceSelect.tsx',component=read(p),css=read('src/components/admin/ui/AdminChoiceSelect.module.css');
check('seletor compartilhado parsavel',()=>assert.equal(ts.createSourceFile(p,component,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0));
check('dialog acessivel e controles de teclado',()=>['role="dialog"','aria-modal="true"','aria-selected','aria-haspopup','ArrowDown','ArrowUp','Escape','Tab','focus'].forEach(x=>assert(component.includes(x),x)));
check('sheet fora do overflow do editor',()=>assert(component.includes('createPortal')&&component.includes('document.body')));
check('fechamento por toque e lista rolavel',()=>assert(component.includes('onMouseDown')&&css.includes('overflow-y:auto')));
check('safe area e motion reduzido',()=>assert(css.includes('safe-area-inset-bottom')&&css.includes('prefers-reduced-motion')));
const catalog=read('src/components/admin/CatalogAdmin.tsx'),styles=read('src/components/admin/CatalogAdmin.module.css');
check('ordenacao customizada preserva quatro modos',()=>['"manual"','"name"','"priceAsc"','"priceDesc"'].forEach(x=>assert(catalog.includes(x))));
check('categoria e filtro continuam ativos',()=>assert(catalog.includes('label="Categoria"')&&catalog.includes('label="Estado"')));
check('combos preservam vinculacao por produto/quantidade',()=>assert(catalog.includes('label="Produto incluído no combo"')&&catalog.includes('next[index]={...next[index],productId}')&&catalog.includes('quantity:Math.max(1')));
check('upsell nao perde condicao nem preco especial',()=>assert(catalog.includes('label="Produto adicional"')&&catalog.includes('upsellUnitPrice')&&catalog.includes('productDraft.upsellProductId')));
check('preco comercial intacto',()=>assert(catalog.includes('promoMetrics(productDraft.price, productDraft.oldPrice)')&&catalog.includes('price: moneyTyping(e.target.value)')));
check('editar e botao pleno na segunda linha',()=>assert(styles.includes('.root .product .actions .primary{grid-column:1/-1')));
check('formulario tem uma unica acao principal por etapa',()=>{
  const footer=catalog.match(/<div className=\{styles\.editorActionsV86\} data-step=\{productStep\}>([\s\S]*?)<\/div>/)?.[1] || '';
  assert(footer, 'Rodape do editor nao encontrado');
  assert(/\{productStep\s*!==\s*"opcoes"\s*\?\s*<button[^>]*className=\{styles\.nextAction\}/.test(footer),'Continuar somente antes da etapa final');
  assert(/:\s*<button[^>]*className=\{styles\.publishAction\}/.test(footer),'Salvar/Criar apenas na etapa final');
  assert(/\.editor\s+\.editorActionsV86\s+(?::is\(\.nextAction,\.publishAction\)|\.nextAction\{)/.test(styles),'Layout do botao principal presente');
});
check('ajuda do editor e progressiva',()=>assert(catalog.includes('<details className={styles.r292Guide}>')));
check('salvamento continua protegido por busy/prepare',()=>assert(catalog.includes('saveProductBusy.current')&&catalog.includes('saveProduct()')&&catalog.includes('mutateCatalog')));
const receipts=read('src/lib/printOrder.ts'),orders=read('src/app/api/orders/route.ts');
check('impressao nao foi modificada pela nova UI',()=>assert(receipts.includes('buildThermalReceiptHtml')&&orders.includes('tx.create(orderRef, canonicalOrder)')));
check('mensageria preserva filtros e fontes',()=>{const s=read('src/components/admin/MessagingCenterAdmin.tsx');assert(s.includes("label=\"Origem\"")&&s.includes("label=\"Status\"")&&s.includes("'site'")&&s.includes("'entregas'"));});
console.log(`DFL SITE R292: ${passed} contratos aprovados. Zero rede/Firestore/print.`);
