'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const source=fs.readFileSync('src/lib/savedProductIds.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const m={exports:{}};new Function('module','exports',js)(m,m.exports);
const {readSavedProductIds:read,toggleSavedProductId:toggle}=m.exports;
const old=global.window;const values=new Map();let events=0;
global.window={localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},dispatchEvent:()=>{events++}};
try{
 assert.deepEqual(read(),[]);assert.equal(toggle('bitela'),true);assert.deepEqual(read(),['bitela']);assert.equal(toggle('bitela'),false);assert.deepEqual(read(),[]);
 assert.equal(toggle('../suspicious'),false);
 for(let n=0;n<17;n++)assert.equal(toggle('item-'+n),true);
 assert.equal(read().length,12);assert.equal(read()[0],'item-16');assert.equal(read().includes('item-0'),false);
 values.set('dfl:saved-products:v1','{invalid');assert.deepEqual(read(),[]);
 values.set('dfl:saved-products:v1',JSON.stringify(['good','good','../bad','']));assert.deepEqual(read(),['good']);
 assert.equal(events,19);
 global.window.localStorage.setItem=()=>{throw Error('storage bloqueado')};assert.equal(toggle('test'),false);
}finally{global.window=old}
const page=fs.readFileSync('src/app/page.tsx','utf8');const product=fs.readFileSync('src/components/product/ProductPublicPage.tsx','utf8');
assert.ok(page.includes('savedProducts.map')&&page.includes('Favoritos'));
assert.ok(product.includes('aria-pressed={saved}')&&product.includes('toggleSavedProductId(product.id)'));
assert.ok(!source.includes('firebase/'));
console.log('V90 R3: 12 favoritos, remoção, deduplicação, storage corrompido/bloqueado e UI OK');
