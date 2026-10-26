'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const component=fs.readFileSync('src/components/ui/StreetSuggestions.tsx','utf8');
const checkout=fs.readFileSync('src/components/ui/CheckoutModal.tsx','utf8');
const route=fs.readFileSync('src/app/api/address/street-suggest/route.ts','utf8');
for(const token of ['NEXT_PUBLIC_DFL_STREET_SUGGEST_ENABLED','/api/address/street-suggest','AbortController','window.setTimeout','380','Patos de Minas','item.state === "MG"','onSelect(item.name)','digitar manualmente'])assert(component.includes(token),'R9 ausente '+token);
assert(component.includes('if (!enabled) return null'),'R9 desativado por padrao');
assert(checkout.includes('manualMode && districtInspection.valid && <StreetSuggestions'),'R9 so usa no editor');
assert(checkout.includes('setRua(name)'),'R9 so altera rua confirmada');
assert(!component.includes('setBairro')&&!component.includes('deliveryFee')&&!component.includes('createCustomerOrder'),'R9 nao altera frete/pedidos');
assert(route.includes('GEOAPIFY_STREET_ENABLED'),'R8 permanece protegida');
for(const f of ['src/components/ui/StreetSuggestions.tsx','src/components/ui/CheckoutModal.tsx']){
 const s=fs.readFileSync(f,'utf8'); const ast=ts.createSourceFile(f,s,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(ast.parseDiagnostics.length,0,`Sintaxe JSX invalida ${f}`);
}
console.log('R9: contratos de rua opcional, UX e seguranca aprovados');
