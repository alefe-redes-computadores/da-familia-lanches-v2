'use strict';
// R233-R2: synthetic street preservation, no commercial orders or database calls.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const ts=require('typescript');
let passed=0;
const ok=(value,label)=>{assert.ok(value,label);passed++};
const rd=p=>fs.readFileSync(p,'utf8');
const pure='src/lib/streetNameSafety.ts';
const source=rd(pure);
const ast=ts.createSourceFile(pure,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
ok(!ast.parseDiagnostics.length,'pure street guard parses');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mod={exports:{}};
new Function('module','exports',code)(mod,mod.exports);
const guard=mod.exports.streetNeedsClarification;
ok(typeof guard==='function','pure guard exported');
for(const street of ['Deze','deze','DEZE','Rua Deze','Av. Deze','Dezes','Dezess','Dezesse','Dezessei',' Rua  Deze  '])
  ok(guard(street),`obvious partial street requires review: ${street}`);
for(const street of ['Dezesseis','Rua Dezesseis','Rua 16','Rua Dez','Rua Dezembro','Dezenove','Rua Sete','Rua 7','Avenida Brasil','Rua Prefeito Exemplo','Rua Quebec',''])
  ok(!guard(street),`valid or unrelated text is not autocorrected: ${street}`);
const checkout=rd('src/components/ui/CheckoutModal.tsx');
const api=rd('src/app/api/orders/route.ts');
const suggestions=rd('src/components/ui/StreetSuggestions.tsx');
const wapp=rd('src/lib/orderWhatsApp.ts');
const event=rd('src/lib/integration/orderEvents.ts');
const workflow=rd('.github/workflows/site-sales-protection.yml');
const css=rd('src/components/ui/CheckoutModal.module.css');
for(const [name,data,kind] of [
 ['checkout',checkout,ts.ScriptKind.TSX],['api',api,ts.ScriptKind.TS],['StreetSuggestions',suggestions,ts.ScriptKind.TSX],
]){const p=ts.createSourceFile(name,data,ts.ScriptTarget.Latest,true,kind);ok(!p.parseDiagnostics.length,`TS syntax ${name}`)}
ok(checkout.includes('import { streetNeedsClarification } from "@/lib/streetNameSafety";'),'checkout imports guard');
ok(checkout.includes('rua.trim().length >= 4 && !streetNeedsClarification(rua) && numero.trim()'),'checkout blocks proceeding with partial street');
ok(checkout.includes('aria-invalid={streetNeedsClarification(rua)}'),'street input exposes invalid state');
ok(checkout.includes('role="alert">O nome da rua parece incompleto'),'customer sees friendly notice');
ok(checkout.includes('!streetNeedsClarification(rua) && Boolean(numero.trim())'),'address preview does not falsely mark ready');
ok(checkout.includes('data-done={rua.trim().length >= 4 && !streetNeedsClarification(rua)}'),'address step is not completed prematurely');
ok(api.includes('text(delivery.street).length < 4 || streetNeedsClarification(delivery.street)'),'API rejects suspicious street as well');
ok(api.includes('street: text(delivery.street, 180)'),'full street preserved with 180-char field limit');
ok(suggestions.includes('!streetNeedsClarification(item.name)'),'optional Geoapify street suggestion cannot insert obvious partial text');
ok(wapp.includes('input.deliveryMode === "pickup" ? "Retirada no balcão" : input.address'),'WhatsApp passes supplied address without partial truncation');
ok(event.includes('street: text(delivery.street)'),'integration preserves street from stored order');
ok(css.includes('.addressForm .streetCompletionHint'),'mobile alert style present');
ok(checkout.includes('>Usar Rua Dezesseis</button>'),'customer can explicitly confirm full street without automatic rewriting');
ok(css.includes('.streetCompletionPanel button'),'44px mobile confirmation control present');
ok(workflow.includes('node scripts/test-site-r233-quebec.cjs')&&workflow.includes('node scripts/test-site-r233-street-guard.cjs'),'sales protection includes both regressions');
ok(!/\b(?:fetch|setDoc|addDoc|onSnapshot)\s*\(/.test(source),'guard is pure: no network or writes');
console.log(`R233-R2 STREET: ${passed} checks passed (no actual orders; no silent correction).`);
