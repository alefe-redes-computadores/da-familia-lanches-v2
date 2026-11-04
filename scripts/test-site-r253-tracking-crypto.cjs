const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),ts=require('typescript');
const source=fs.readFileSync('src/lib/tracking/server.ts','utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const moduleExports={};
const context={exports:moduleExports,require:(id)=>id==='server-only'?{}:require(id),process,Buffer,URL,Date,console,fetch:()=>{throw Error('unexpected fetch')},AbortSignal};
vm.runInNewContext(code,context);
const m=moduleExports;
const key=crypto.randomBytes(32).toString('base64url');
Object.assign(process.env,{DFL_SITE_TRACKING_ENABLED:'1',DFL_ENTREGAS_TRACKING_ORIGIN:'https://entregas.example.com',DFL_TRACKING_TENANT_ID:'DFL_1234',DFL_TRACKING_S2S_KID:'key001',DFL_TRACKING_S2S_SECRET:crypto.randomBytes(32).toString('base64url'),DFL_SITE_TRACKING_COOKIE_KEY:key});
const handle=crypto.randomBytes(32).toString('base64url');
const cookie=m.sealScope(handle,new Date(Date.now()+15*60000).toISOString());
if(!cookie||m.unsealScope(cookie)!==handle)throw Error('seal/unseal failed');
const tampered=cookie.slice(0,-3)+'AAA';
if(m.unsealScope(tampered))throw Error('cookie tampering accepted');
if(m.sealScope('invalid','2030-01-01T00:00:00Z'))throw Error('invalid handle accepted');
const valid={contract:'dfl.tracking.public',version:1,order:{label:'#1048',origin_label:'Loja',fulfillment:'delivery'},status:'out_for_delivery',as_of:new Date().toISOString(),freshness:'fresh',timeline:[{id:'evt-1',kind:'confirmed',title:'Pedido confirmado',at:new Date().toISOString()}],progress:{status:'verified',current_stop_number:null,planned_customer_stop_number:3,total_physical_stops:6,stops_ahead:1,is_next_stop:false},courier:{first_name:'Bruno'},terminal:false};
if(!m.validPublicProjection(valid))throw Error('valid projection rejected');
for(const test of [ {...valid,secret:'private'}, {...valid,progress:{...valid.progress,stops_ahead:-1}}, {...valid,status:'delivered',terminal:false}, {...valid,timeline:[{...valid.timeline[0],title:'Private data'}]}, {...valid,freshness:'stale'}]){
 if(m.validPublicProjection(test))throw Error('insecure projection accepted');
}
process.env.DFL_SITE_TRACKING_ENABLED='0';
if(m.sealScope(handle,new Date(Date.now()+15*60000).toISOString())!==null)throw Error('OFF feature permitted seal');
console.log('R253 CRYPTO SMOKE PASS: AES-GCM, tamper rejection, restricted scope, 5 projection negatives and fail closed');
