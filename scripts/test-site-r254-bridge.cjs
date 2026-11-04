'use strict';
/** R254 hermetic bridge integration gate. No network, no Firestore, no real customer access. */
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto'),ts=require('typescript');
function load(path,deps={}) {
 const compiled=ts.transpileModule(fs.readFileSync(path,'utf8'),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const module={exports:{}};
 const resolve=k=>k==='server-only'?{}:Object.hasOwn(deps,k)?deps[k]:require(k);
 new Function('require','module','exports',compiled)(resolve,module,module.exports);
 return module.exports;
}
let checks=0;
function equal(a,b,title){assert.deepEqual(a,b,title);checks++;}
function ok(a,title){assert.ok(a,title);checks++;}
const lib=load('src/lib/tracking/bridge.ts');
const tenant='EmpresaDFL',kid='siteKey1',secret='S'.repeat(64),ownerUid='owner-account-abc';
const env={
 DFL_SITE_TRACKING_BRIDGE_PROBE_ENABLED:'1',
 DFL_ENTREGAS_TRACKING_ORIGIN:'https://entregas-staging.example.com',
 DFL_TRACKING_TENANT_ID:tenant,
 DFL_TRACKING_S2S_KID:kid,
 DFL_TRACKING_S2S_SECRET:secret,
 DFL_SITE_TRACKING_PUBLIC_HOST:'site-staging.example.com',
 DFL_SITE_TRACKING_BRIDGE_OWNER_UID:ownerUid,
};
for(const [k,v] of Object.entries(env))process.env[k]=v;
const config=lib.bridgeConfiguration();ok(config,'valid staging config');
const challenge='C'.repeat(43),nonce='N'.repeat(32),time=new Date().toISOString();
const input=lib.bridgeRequest(config,{challenge,nonce,timestamp:time});
equal(JSON.parse(input.body),{contract:'dfl.tracking.bridge',version:1,action:'probe',challenge},'closed wire contract');
equal(input.headers['x-dfl-tracking-signature'],crypto.createHmac('sha256',secret).update([
 'POST',lib.BRIDGE_PATH,crypto.createHash('sha256').update(input.body).digest('hex'),time,nonce,kid,tenant
].join('\n')).digest('hex'),'canonical HMAC exact');
const hash=crypto.createHash('sha256').update(challenge).digest('hex');
function proof(c=config,w=input,serverTime=time){return crypto.createHmac('sha256',c.secret).update([
 'DFL_TRACKING_BRIDGE_PROOF_V1',lib.BRIDGE_PATH,hash,w.nonce,serverTime,c.tenant,c.kid
].join('\n')).digest('hex');}
const response={contract:'dfl.tracking.bridge',version:1,status:'reachable',challenge_hash:hash,server_time:time,proof:proof()};
ok(lib.verifyBridgeProof(config,input,response),'genuine proof accepted');
for(const altered of [
 {...response,contract:'wrong'}, {...response,version:2}, {...response,status:'enabled'},
 {...response,challenge_hash:'f'.repeat(64)}, {...response,proof:'f'.repeat(64)},
 {...response,secret:'leak'}, {...response,scope_handle:'H'.repeat(43)},
 {...response,server_time:'1999-01-01T00:00:00Z'},null,[],{},'<html>error</html>'
])ok(!lib.verifyBridgeProof(config,input,altered),'reject response alteration');
ok(!lib.verifyBridgeProof({...config,tenant:'otherTenant'},input,response),'tenant isolation');
ok(!lib.verifyBridgeProof({...config,secret:'Z'.repeat(64)},input,response),'secret isolation');
ok(!lib.verifyBridgeProof(config,{...input,nonce:'X'.repeat(32)},response),'nonce binding');
ok(!lib.verifyBridgeProof(config,input,response,Date.now()+300000),'expired proof');
for(const [k,v] of Object.entries(env)) {
  const prior=process.env[k];delete process.env[k];
  ok(lib.bridgeConfiguration()===null,'fail closed env '+k);
  process.env[k]=prior;
}
process.env.DFL_SITE_TRACKING_BRIDGE_PROBE_ENABLED='0';
ok(lib.bridgeConfiguration()===null,'bridge disabled by default');
process.env.DFL_SITE_TRACKING_BRIDGE_PROBE_ENABLED='1';
process.env.DFL_SITE_TRACKING_ENABLED='0';
ok(lib.bridgeConfiguration()!=null,'bridge independent of customer tracking');
const makeResponse=(status,body,content='application/json')=>({
 status,headers:{get:k=>k==='content-type'?content:null},text:async()=>JSON.stringify(body),
});
const transport=async(url,options)=>{
 equal(url,config.origin+lib.BRIDGE_PATH,'upstream fixed URL');
 equal(options.method,'POST','POST only');
 equal(options.redirect,'error','no redirect');
 equal(options.credentials,'omit','no cookies');
 equal(options.cache,'no-store','no cache');
 const wire={challenge:JSON.parse(options.body).challenge,nonce:options.headers['x-dfl-tracking-nonce']};
 const actualHash=crypto.createHash('sha256').update(wire.challenge).digest('hex');
 const t=new Date().toISOString();
 const p=crypto.createHmac('sha256',secret).update(['DFL_TRACKING_BRIDGE_PROOF_V1',lib.BRIDGE_PATH,actualHash,wire.nonce,t,tenant,kid].join('\n')).digest('hex');
 return makeResponse(200,{contract:'dfl.tracking.bridge',version:1,status:'reachable',challenge_hash:actualHash,server_time:t,proof:p});
};
(async()=>{
 const connected=await lib.probeEntregasBridge(config,transport);
 equal(connected,{connected:true,public_access_granted:false,messages_sent:false},'signed mock S2S proof');
 for(const fn of [async()=>makeResponse(401,response),async()=>makeResponse(302,response),
  async()=>makeResponse(200,response,'text/html'),async()=>makeResponse(200,{...response,private:'bad'}),
  async()=>{throw Error('network offline');}]){
   equal((await lib.probeEntregasBridge(config,fn)).connected,false,'failure stays disconnected');
 }
 // Owner-only diagnostic is isolated from client cookies and never echoes tokens or keys.
 let verifyCount=0;
 const route=load('src/app/api/internal/tracking/bridge/route.ts',{
 'next/server':{NextRequest:class{},NextResponse:{json:(body,init)=>({body,status:init.status,headers:init.headers})}},
 '@/lib/integration/server/adminAuth':{adminAuth:{verifyIdToken:async(token,check)=>{verifyCount++;equal(check,true,'revocation checked');if(token==='invalid')throw Error('invalid');return{uid:token.startsWith('customer')?'other-customer':ownerUid};}}},
 '@/lib/tracking/bridge':{bridgeConfiguration:lib.bridgeConfiguration,probeEntregasBridge:async()=>({connected:true,public_access_granted:false,messages_sent:false})},
 });
 const req=(auth='owner',h='site-staging.example.com')=>({
 nextUrl:{protocol:'https:'},headers:new Map([['host',h],['authorization','Bearer '+auth.padEnd(32,'x')]]),
 });
 // Fake verifier identifies the mocked owner token by prefix.
 const allowed={nextUrl:{protocol:'https:'},headers:new Map([['host','site-staging.example.com'],['authorization','Bearer '+'owner'.padEnd(32,'x')]])};
 // Missing auth and wrong hostname must be rejected before token verification.
 equal((await route.POST({nextUrl:{protocol:'https:'},headers:new Map([['host','site-staging.example.com']])})).status,403,'missing owner auth');
 equal((await route.POST({nextUrl:{protocol:'https:'},headers:new Map([['host','evil.example.com']])})).status,404,'wrong host');
 // Our fake verifier returns owner for arbitrary well-formed token; production verifyIdToken checks issuer, signature and revocation.
 const result=await route.POST(allowed);
 equal(result.status,200,'authenticated staging owner');
 equal((await route.POST({...allowed,headers:new Map([['host','site-staging.example.com'],['authorization','Bearer '+'customer'.padEnd(32,'x')]])})).status,403,'other authenticated customer rejected');
 equal(result.body,{ok:true,connected:true,public_access_granted:false,messages_sent:false},'no customer activation');
 equal(result.headers['Cache-Control'],'private, no-store, max-age=0','protected response no-store');
 equal((await route.POST({...allowed,nextUrl:{protocol:'http:'}})).status,404,'HTTP denied');
 equal((await route.POST({...allowed,headers:new Map([...allowed.headers,['x-forwarded-host','evil.example.com']])})).status,404,'forwarded host spoof denied');
 equal((await route.POST({...allowed,headers:new Map([...allowed.headers,['content-length','7']])})).status,422,'diagnostic arbitrary body denied');
 process.env.DFL_SITE_TRACKING_BRIDGE_PROBE_ENABLED='0';
 equal((await route.POST(allowed)).status,404,'kill switch immediately works');
 const source=fs.readFileSync('src/app/api/internal/tracking/bridge/route.ts','utf8');
 for(const word of ['issueGrant(','exchangeToken(','querySession(','sendWhatsApp(','newLink(','localStorage','sessionStorage'])ok(!source.includes(word),'diagnostic has no '+word);
 const server=fs.readFileSync('src/lib/tracking/server.ts','utf8');
 ok(server.includes("DFL_SITE_TRACKING_ENABLED === '1'"),'customer remains separate OFF flag');
 const shell=fs.readFileSync('src/components/layout/AppShell.tsx','utf8');
 ok(shell.includes('acompanhar'),'R253 tracking isolation preserved');
 console.log(`R254_SITE_GATE5_APROVADO: ${checks} hermetic transport, cryptographic, owner-only, host, OFF and regression checks; no real server calls`);
})().catch(error=>{console.error('R254_SITE_GATE5_BLOQUEADO',error);process.exitCode=1});
