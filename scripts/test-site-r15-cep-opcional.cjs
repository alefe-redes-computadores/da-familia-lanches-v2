'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),ts=require('typescript');
const front=fs.readFileSync('src/components/ui/CheckoutModal.tsx','utf8');
const api=fs.readFileSync('src/app/api/orders/route.ts','utf8');
assert(front.includes('(cep.replace(/\\D/g, "").length === 0 || cep.replace(/\\D/g, "").length === 8) && rua.trim().length >= 4'));
assert(api.includes('![0, 8].includes(text(delivery.cep).replace(/\\D/g, "").length)'));
assert(front.includes('numero.trim() && districtInspection.valid'));
assert(api.includes('!text(delivery.number) || !inspectDistrict(district).valid'));
assert(front.includes('createCustomerOrder')&&front.includes('orderAttemptRef'));
assert(api.includes('tx.create(orderRef, canonicalOrder)'));
assert(api.includes('deliverySnapshot: deliveryMode === "pickup" ? null'));
for(const [name,source,kind] of [['checkout',front,ts.ScriptKind.TSX],['api',api,ts.ScriptKind.TS]]){
 const ast=ts.createSourceFile(name,source,ts.ScriptTarget.Latest,true,kind);
 assert.equal(ast.parseDiagnostics.length,0,`${name}: syntax`);
}
const valid=cep=>{const n=String(cep).replace(/\D/g,'').length;return n===0||n===8};
assert(valid(''));assert(valid('38700-000'));assert(!valid('38700'));
console.log('R15: CEP opcional, parcial proibido, campos e motor de pedidos preservados');
