const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require(require.resolve('typescript', { paths: [process.cwd()] }));
const file = process.argv[2] || 'src/lib/addressDraftRepair.ts';
const checkoutFile = process.argv[3] || 'src/components/ui/CheckoutModal.tsx';
const transpiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  fileName: file, reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
assert.equal((transpiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
const moduleLocal = {exports:{}};
new Function('module', 'exports', transpiled.outputText)(moduleLocal, moduleLocal.exports);
const recover = moduleLocal.exports.recoverSavedDistrictForExactAddress;
const saved = {street:'Rua Prefeito Exemplo', number:'225', cep:'38700-123', district:'Jardim Quebec'};
const empty = {...saved, district:''};
assert.equal(recover(empty, saved), 'Jardim Quebec');
assert.equal(recover({...empty, street:'Rua Preféito Exemplo'}, saved), 'Jardim Quebec');
assert.equal(recover({...empty, street:'Outra Rua'}, saved), null);
assert.equal(recover({...empty, number:'226'}, saved), null);
assert.equal(recover({...empty, cep:'38700-999'}, saved), null);
assert.equal(recover({...empty, cep:''}, saved), null);
assert.equal(recover({...empty, district:'Centro'}, saved), null);
assert.equal(recover(empty, {...saved, district:''}), null);
const c = fs.readFileSync(checkoutFile, 'utf8');
for(const marker of [
  'recoverSavedDistrictForExactAddress(',
  'districtManuallyEditedRef.current',
  'ref={districtInputRef}',
  'focusCheckoutIssue("district")',
  'Falta informar o bairro da entrega.',
  'aria-invalid={!isPickup && !districtInspection.valid',
]) assert(c.includes(marker), `Falta protecao: ${marker}`);
const r=ts.transpileModule(c,{fileName:checkoutFile,reportDiagnostics:true,
  compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}});
assert.equal((r.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,
  ts.formatDiagnosticsWithColorAndContext(r.diagnostics||[],{getCanonicalFileName:x=>x,getCurrentDirectory:()=>'',getNewLine:()=> '\n'}));
console.log('DFL ENDERECO R1 — 14 verificacoes e sintaxe aprovadas');
