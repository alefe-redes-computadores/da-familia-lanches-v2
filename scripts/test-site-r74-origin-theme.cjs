/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS contract test uses require(). */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
const file='src/components/tracking/TrackingExperience.tsx';
const source=fs.readFileSync(file,'utf8'), css=fs.readFileSync('src/components/tracking/TrackingExperience.module.css','utf8');
const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.equal(ast.parseDiagnostics.length,0,'React TSX sem erro de sintaxe');
for(const key of ['site','loja','ifood','food99','keeta','unknown']){
  assert.ok(source.includes(`key:'${key}'`),`origem ${key} mapeada`);
  if(key!=='unknown')assert.ok(css.includes(`data-r74-origin="${key}"`),`origem ${key} com cor própria`);
}
for(const token of ['r74Origin(state.order.origin_label)','data-r74-origin={origin?.key}','OriginIcon&&<OriginIcon','friendlyOrderLabel(state.order.label)','<CheckCircle2','const R48_STEPS','const eventIcons','/acompanhar/api/session','/acompanhar/api/status'])assert.ok(source.includes(token),'contrato: '+token);
assert.ok(!/localStorage|sessionStorage|Math.random/.test(source),'não persiste token ou inventa número');
assert.ok(!source.includes('origin.toLowerCase()'),'sem exceção por origem indefinida');
console.log('R74 SITE P1: identidade por 5 origens + fallback; TSX e privacidade OK');
