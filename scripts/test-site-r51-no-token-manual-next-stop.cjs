"use strict";
const assert=require('node:assert/strict'),fs=require('node:fs');
const ts=require('typescript');
const src=fs.readFileSync('src/components/tracking/TrackingExperience.tsx','utf8');
const transpiled=ts.transpileModule(src,{fileName:'TrackingExperience.tsx',reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
assert.equal(transpiled.diagnostics.length,0,'JSX TypeScript parsable');
for(const anchor of ["'no-link'","noTokenAtEntry.current = window.location.hash === ''",'hasOpenedSession.current=true',
 'noTokenAtEntry.current&&!hasOpenedSession.current',"phase==='no-link'?'Como acompanhar seu pedido'",
 'abra o link completo recebido pelo WhatsApp',"phase!=='loading'&&phase!=='no-link'",
 'window.history.replaceState(null',"credentials:'same-origin'",'window.location.assign(\'/\')'])
 assert.ok(src.includes(anchor),'R51 preserva: '+anchor);
assert.equal((src.match(/const token=window.location.hash.startsWith/g)||[]).length,1,'uma unica leitura de token');
const launchStart=src.indexOf('    const launch=async()=>{'),launchEnd=src.indexOf('    void launch();',launchStart);
assert.ok(launchStart>0&&launchEnd>launchStart,'launch legacy anchor unchanged');
assert.ok(src.indexOf("noTokenAtEntry.current = window.location.hash === ''")<launchStart,'no-token init outside launch');
assert.ok(!src.slice(launchStart,launchEnd).includes('noTokenAtEntry'),'legacy R263 isolated launch may not access hooks');
assert.ok(src.includes("setPhase('denied')"),'token expirado/revogado segue separado');
assert.ok(!src.includes('localStorage')&&!src.includes('sessionStorage'),'token nao persistido');
const next=fs.readFileSync('src/lib/messaging/r32ManualNextStopPolicy.ts','utf8');
assert.ok(next.includes("DFL_MANUAL_NEXT_STOP_ENABLED === 'true'")&&next.includes("DFL_MANUAL_NEXT_STOP_KILL_SWITCH === 'false'"),'Site canario fail closed');
assert.ok(next.includes("DFL_MANUAL_MESSAGING_ENABLED === 'true'"),'manual canario independent');
console.log('R51V2_SITE_OK | sem token separado de acesso revogado | segurança de sessão preservada | proxima parada OFF');
