"use strict";
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/lib/tracking/bridge.ts', 'utf8');
const script = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const out = {exports:{}};
new Function('require','module','exports',script)((id)=>id==='server-only'?{}:require(id),out,out.exports);
const m = out.exports;
const BASE = {
 origin:'https://dfl-entregas-tracking-hml.vercel.app',
 tenant:'DFL_HML_A',kid:'hmlkey1',secret:'S'.repeat(64),
 host:'dfl-site-tracking-hml.vercel.app',ownerUid:'hml-owner',
};
const ENV='NEXT_PUBLIC_DFL_TRACKING_HOMOLOGATION',KEY='DFL_SITE_TRACKING_UPSTREAM_BYPASS';
const oldEnv=process.env[ENV],oldKey=process.env[KEY];
let checks=0;const verify=(cond,reason)=>{assert.ok(cond,reason);checks++};
const reply={status:503,headers:{get:()=>null},text:async()=>''};
(async()=>{
 try {
  const bypass='A'.repeat(32);
  process.env[ENV]='0';process.env[KEY]=bypass;
  let called=0,seen=null;
  let r=await m.probeEntregasBridge(BASE,async(u,o)=>{called++;seen={u,o};return reply});
  verify(called===1,'normal mode reaches trusted upstream');
  verify(seen.o.headers['x-vercel-protection-bypass']===undefined,'normal mode never sends bypass');
  verify(r.connected===false && r.messages_sent===false,'no customer access from mock');

  process.env[ENV]='1';process.env[KEY]=bypass;seen=null;called=0;
  r=await m.probeEntregasBridge(BASE,async(u,o)=>{called++;seen={u,o};return reply});
  verify(called===1,'homologation request was attempted');
  verify(seen.o.headers['x-vercel-protection-bypass']===bypass,'bypass only to exact expected origin');
  verify(seen.u==='https://dfl-entregas-tracking-hml.vercel.app/api/integration/tracking/v1/bridge','fixed endpoint');
  verify(seen.o.redirect==='error'&&seen.o.credentials==='omit'&&seen.o.cache==='no-store','no redirect, no cookies, no cache');

  for(const config of [{...BASE,origin:'https://evil.example.com'},{...BASE,host:'evil.example.com'},
   {...BASE,origin:'http://dfl-entregas-tracking-hml.vercel.app'},
   {...BASE,origin:'https://dfl-entregas-tracking-hml.vercel.app.evil.com'}]) {
   called=0;const p=await m.probeEntregasBridge(config,async()=>{called++;return reply});
   verify(called===0&&!p.connected,'reject host/origin mismatch before transport');
  }
  for(const missing of ['', 'bad', 'a'.repeat(31),'!'.repeat(32)]) {
   process.env[KEY]=missing;called=0;
   await m.probeEntregasBridge(BASE,async()=>{called++;return reply});
   verify(called===0,'reject missing or malformed bypass');
  }
  process.env[KEY]=bypass;process.env[ENV]='0';called=0;
  await m.probeEntregasBridge(BASE,async(u,o)=>{called++;verify(!Object.hasOwn(o.headers,'x-vercel-protection-bypass'),'no bypass on feature OFF');return reply});
  verify(called===1,'normal operation unaffected');
  console.log('HML S2S protected bridge: '+checks+' assertions PASS');
 }finally {
  if(oldEnv===undefined)delete process.env[ENV];else process.env[ENV]=oldEnv;
  if(oldKey===undefined)delete process.env[KEY];else process.env[KEY]=oldKey;
 }
})().catch(e=>{console.error('HML PROTECTED BRIDGE BLOCKED:',e.message);process.exitCode=1});
