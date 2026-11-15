'use strict';
/** Same-browser proof without replaying one-time token or exposing secrets. */
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),crypto=require('node:crypto'),vm=require('node:vm');
let tests=0;const ok=(v,m)=>{assert.ok(v,m);tests++};
const read=p=>fs.readFileSync(p,'utf8');
const source='src/lib/tracking/server.ts';
for(const p of [source,'src/app/acompanhar/api/session/route.ts','src/app/acompanhar/api/session/revoke/route.ts','src/components/tracking/TrackingExperience.tsx']){
 const tree=ts.createSourceFile(p,read(p),ts.ScriptTarget.Latest,true,p.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(tree.parseDiagnostics.length===0,'syntax '+p);
}
const env={DFL_SITE_TRACKING_ENABLED:'1',DFL_ENTREGAS_TRACKING_ORIGIN:'https://dfl-entregas.vercel.app',DFL_TRACKING_TENANT_ID:'tenant71',DFL_TRACKING_S2S_KID:'kid71',DFL_TRACKING_S2S_SECRET:'S'.repeat(64),DFL_SITE_TRACKING_COOKIE_KEY:Buffer.alloc(32,7).toString('base64url')};
const c={exports:{}};
vm.runInNewContext(ts.transpileModule(read(source),{fileName:source,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,
 {exports:c.exports,module:c,require:n=>n==='server-only'?{}:n==='node:crypto'?crypto:(()=>{throw Error('unexpected import '+n)})(),Buffer,process:{env},URL,Date,AbortSignal,fetch:async()=>{throw Error('network forbidden')},JSON,RegExp,Math},{timeout:2500});
const api=c.exports,token='T'.repeat(43),handle='H'.repeat(43),expiry=new Date(Date.now()+20*60000).toISOString();
const cookie=api.sealScope(handle,expiry),bind=api.sealTrackingBinding(token,handle,expiry);
ok(typeof cookie==='string'&&typeof bind==='string','encrypted cookies');
ok(api.matchingTrackingScope(token,cookie,bind)===handle,'same token and session authorizes reuse');
ok(api.matchingTrackingScope('U'.repeat(43),cookie,bind)===null,'different order token not authorized');
ok(api.matchingTrackingScope(token,api.sealScope('A'.repeat(43),expiry),bind)===null,'different session not authorized');
ok(api.matchingTrackingScope(token,cookie,bind+'a')===null,'tampered binding denied');
ok(api.matchingTrackingScope('not-a-token',cookie,bind)===null,'malformed token denied');
ok(api.sealTrackingBinding(token,handle,new Date(Date.now()-1000).toISOString())===null,'expired grant not renewed');
const session=read('src/app/acompanhar/api/session/route.ts'),revoke=read('src/app/acompanhar/api/session/revoke/route.ts'),ui=read('src/components/tracking/TrackingExperience.tsx');
ok(session.includes('matchingTrackingScope(')&&session.includes('validPublicProjection(confirmed.data)'),'reuse requires remote status proof');
ok(session.includes('sealTrackingBinding(')&&session.includes('trackingBindingCookieName, bound'),'fresh session bound');
ok(session.includes('denyAndClear()')&&revoke.includes('trackingBindingCookieName'),'invalid links and logout clear binding');
ok(!ui.slice(ui.indexOf('const launch=async()=>{'),ui.indexOf('void launch();')).includes("fetch('/acompanhar/api/session/revoke'"),'no preemptive revoke');
ok(!/localStorage|sessionStorage/.test(session+read(source)),'no browser token storage');
console.log(`R71 SITE: ${tests} verificações de vínculo criptográfico + sintaxe + fronteira pública; ZERO rede.`);
