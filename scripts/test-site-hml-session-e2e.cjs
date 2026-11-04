'use strict';
/** Hermetic R256: only signed server-side Site transport can carry protected HML bypass. */
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),crypto=require('node:crypto');
const source=fs.readFileSync('src/lib/tracking/server.ts','utf8');
const compiled=ts.transpileModule(source,{fileName:'server.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const mod={exports:{}};new Function('require','module','exports',compiled)((id)=>id==='server-only'?{}:require(id),mod,mod.exports);
const s=mod.exports, url='https://dfl-entregas-tracking-hml.vercel.app',path='/api/integration/tracking/v1/status';
let checks=0;const eq=(a,b,msg)=>{assert.deepEqual(a,b,msg);checks++};const ok=(x,msg)=>{assert.ok(x,msg);checks++};
const origEnv={...process.env},origFetch=global.fetch;let fetches=[];
const HML={DFL_SITE_TRACKING_ENABLED:'1',DFL_ENTREGAS_TRACKING_ORIGIN:url,
 DFL_TRACKING_TENANT_ID:'DFL_HML_A',DFL_TRACKING_S2S_KID:'hmlkey1',DFL_TRACKING_S2S_SECRET:crypto.randomBytes(48).toString('base64url'),
 DFL_SITE_TRACKING_COOKIE_KEY:crypto.randomBytes(32).toString('base64url'),
 NEXT_PUBLIC_DFL_TRACKING_HOMOLOGATION:'1',NEXT_PUBLIC_FIREBASE_PROJECT_ID:'dfl-finance',
 DFL_SITE_TRACKING_PUBLIC_HOST:'dfl-site-tracking-hml.vercel.app',
 DFL_SITE_TRACKING_UPSTREAM_BYPASS:'A'.repeat(32)};
const reset=(add={})=>{for(const k of Object.keys(HML))delete process.env[k];Object.assign(process.env,HML,add);fetches=[]};
global.fetch=async (dest,request)=>{fetches.push({dest,request});return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({contract:'test'})}};
(async()=>{
 reset();let r=await s.callEntregas(path,{action:'status'});
 eq(r.ok,true,'valid HML fetch accepted');eq(fetches.length,1,'one real transport call');
 eq(fetches[0].dest,url+path,'fixed HML upstream');
 eq(fetches[0].request.headers['x-vercel-protection-bypass'],'A'.repeat(32),'outbound bypass only');
 ok(/^[a-f0-9]{64}$/.test(fetches[0].request.headers['x-dfl-tracking-signature']),'still signed HMAC');
 eq(fetches[0].request.credentials,'omit','never sends browser cookies');
 eq(fetches[0].request.cache,'no-store','no cache');
 eq(fetches[0].request.redirect,'error','reject upstream redirect');
 for(const bad of [
  {DFL_SITE_TRACKING_UPSTREAM_BYPASS:''},{DFL_SITE_TRACKING_UPSTREAM_BYPASS:'short'},
  {DFL_ENTREGAS_TRACKING_ORIGIN:'https://another-server.vercel.app'},
  {NEXT_PUBLIC_FIREBASE_PROJECT_ID:'da-familia-lanches'},
  {DFL_SITE_TRACKING_PUBLIC_HOST:'dafamilialanches.com.br'},
 ]){reset(bad);r=await s.callEntregas(path,{action:'status'});eq(r.ok,false,'invalid HML config blocked');eq(fetches.length,0,'no outbound call on bad config');}
 reset({DFL_SITE_TRACKING_ENABLED:'0'});r=await s.callEntregas(path,{});eq(r.ok,false,'customer access OFF always closed');eq(fetches.length,0,'no outbound request when OFF');
 reset({NEXT_PUBLIC_DFL_TRACKING_HOMOLOGATION:'0'});r=await s.callEntregas(path,{action:'status'});
 eq(r.ok,true,'non-HML unchanged');ok(!('x-vercel-protection-bypass' in fetches[0].request.headers),'never sends bypass outside HML');
 ok(!source.includes('DFL_SITE_TRACKING_UPSTREAM_BYPASS ='), 'no hardcoded bypass secret');
 console.log(`R256 Site HML session bypass: ${checks} checks PASS; no network/Firestore/WhatsApp`);
})().catch(e=>{console.error('R256 SITE BLOQUEADO:',e);process.exitCode=1}).finally(()=>{global.fetch=origFetch;process.env=origEnv});
