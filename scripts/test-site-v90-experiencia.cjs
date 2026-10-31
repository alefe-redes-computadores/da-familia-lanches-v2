"use strict";
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('src/lib/recentProductViews.ts','utf8');
const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020},reportDiagnostics:true});
assert.equal(result.diagnostics?.filter(x=>x.category===1).length,0);
const values=new Map(),store={getItem(k){return values.has(k)?values.get(k):null},setItem(k,v){values.set(k,v)}};
const context={exports:{},window:{sessionStorage:store}};vm.runInNewContext(result.outputText,context);
const {readRecentProductIds:read,rememberRecentProductId:add}=context.exports;
assert.equal(read().length,0);for(let i=0;i<9;i++)add('product-'+i);
assert.equal(read().length,5,'Max cinco ids');assert.equal(read()[0],'product-8');
add('product-6');assert.equal(read()[0],'product-6');assert.equal(new Set(read()).size,read().length);
add('   ');assert.equal(read().length,5);add('A'.repeat(121));assert.equal(read().length,5);
values.set('dfl:recent-products:v1','{broken');assert.equal(read().length,0,'Storage corrompido tolerado');
context.window.sessionStorage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
assert.equal(read().length,0,'Storage inacessivel tolerado');assert.doesNotThrow(()=>add('safe'));
const home=fs.readFileSync('src/app/page.tsx','utf8'),product=fs.readFileSync('src/components/product/ProductPublicPage.tsx','utf8'),css=fs.readFileSync('src/app/page.module.css','utf8');
assert.ok(home.includes('recentlyViewed.map((product)'));assert.ok(home.includes('!search.trim() && recentlyViewed.length > 0'));
// R30 R3: pertencimento da categoria continua obrigatorio, inclusive usando Set memoizado.
const legacyCategoryFilter = home.includes('category.id === product.category');
// V90 R104: proteger CADA origem da vitrine; não usar contagem exata de filtros.
// A quarta checagem é necessária para IDs escolhidos na Central de Campanhas.
const categoryCheckIn = (begin, end) => {
  const start = home.indexOf(begin);
  if (start < 0) return false;
  const finish = home.indexOf(end, start + begin.length);
  return finish > start && home.slice(start, finish).includes('visibleCategoryIds.has(product.category)');
};
const optimizedCategoryFilter =
  home.includes('const visibleCategoryIds = useMemo(() => new Set(categories.map((category) => category.id)), [categories]);') &&
  home.includes('const visibleCategories = visibleCategoryIds;') &&
  categoryCheckIn('const promoProducts = useMemo(', '// R104: IDs reais') &&
  categoryCheckIn('const showcaseProducts=useMemo(', 'const renderShowcaseOffer=') &&
  categoryCheckIn('const savedProducts = useMemo(', 'const recentlyViewed = useMemo(') &&
  categoryCheckIn('const recentlyViewed = useMemo(', 'const openProduct =');
assert.ok(optimizedCategoryFilter,
  'V90 R104: filtro de categoria em ofertas, vitrine, favoritos e vistos');
assert.ok(home.includes('product.disponivel !== false'));

assert.ok(product.includes('rememberRecentProductId(product.id)'));
assert.ok(css.includes('.recentRail'));assert.ok(!source.includes('localStorage')&&!source.includes('firebase'));
console.log('V90 EXPERIENCIA — 18 contratos OK');
