'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const a=read('src/components/layout/DFLAssist.tsx'),o=read('src/components/layout/DFLAssistOffers.tsx'),css=read('src/components/layout/DFLAssist.module.css');
assert(a.includes('import { DFLAssistOffers }')&&a.includes('<DFLAssistOffers onFindProduct={search} />'));
assert(a.includes('if (!visible) return null;'),'Painel oculto nao monta as ofertas');
assert(o.includes('useCatalog()')&&o.includes('source === "hybrid"'),'Nao prometer preco pelo fallback');
assert(o.includes('recommendDFLProducts(products,')&&o.includes('onFindProduct(product.name)'));
assert(o.includes('!loading && !error')&&o.includes('product.price'));
assert(!/createCustomerOrder|\/api\/orders|addToCart|clearCart|fetch\(/.test(o),'Nenhuma gravacao ou pedido');
assert(o.includes('type="checkbox"')&&o.includes('Quantas pessoas?')&&o.includes('Orçamento (R$)'));
assert(css.includes('.offerFilters')&&css.includes('.offerList'));
for(const p of ['src/components/layout/DFLAssist.tsx','src/components/layout/DFLAssistOffers.tsx']){
 const src=read(p),out=ts.transpileModule(src,{fileName:p,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}});
 assert.equal((out.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,p);
}
console.log('DFL R12 — 9 contratos do assistente comercial aprovados');
