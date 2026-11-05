'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('src/components/tracking/TrackingExperience.tsx','utf8');
let n=0;
const ok=(x,label)=>{assert.ok(x,label);n++};
const equal=(x,y,label)=>{assert.deepEqual(x,y,label);n++};
const count=(x,expected,label)=>{equal(source.split(x).length-1,expected,label)};
count('const currentEpoch = ++epoch.current;',1,'R258 epoch protection retained');
count("if(!response.ok)throw new Error('TRACKING_REVOKE_UNCONFIRMED')",1,'R259 logout success conditional');
count('if(closingRequest.current)return;',1,'R259 double-click protection');
ok(source.includes('Seu pedido, passo a passo'),'headline');
ok(source.includes('friendlyOrderLabel(state.order.label)'),'commercial-label safe fallback');
ok(source.includes('eventIcons[item.kind]'),'per-event icons');
ok(source.includes('eventIcons[state.status]'),'per-status icon');
ok(!source.includes('Math.random'),'no invented order number');
ok(!source.includes('localStorage')&&!source.includes('sessionStorage'),'no browser token persistence');
function extraction(start,end){const a=source.indexOf(start);assert.ok(a!==-1,start);const b=source.indexOf(end,a+start.length);assert.ok(b!==-1,end);return source.slice(a+start.length,b).trim();}
const checkCode=extraction('const check=useCallback(', ',[]);').replace('const data: State =','const data =');
const closeCode=extraction('const close=', '\n  const stale=').replace(/;\s*$/, '');
const makeDeferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const baseProjection={contract:'dfl.tracking.public',version:1,status:'ready',timeline:[],order:{label:'#123',origin_label:'Loja',fulfillment:'delivery'}};
function scene(){
 const phases=[],states=[],epoch={current:0},initializing={current:false},closing={current:false},closingRequest={current:false};
 let online=true, visible=true;
 const calls=[];
 const fetch=(url,options)=>{const d=makeDeferred();calls.push({url,options,...d});return d.promise};
 const env={epoch,initializing,closing,closingRequest,fetch,setPhase:x=>phases.push(x),setState:x=>states.push(x),
   document:{get visibilityState(){return visible?'visible':'hidden'}},navigator:{get onLine(){return online}},Error};
 const check=vm.runInNewContext('('+checkCode+')',env);
 const close=vm.runInNewContext('('+closeCode+')',env);
 return {check,close,calls,phases,states,epoch,closing,closingRequest,offline:()=>online=false,online:()=>online=true,hide:()=>visible=false};
}
(async()=>{
 // HTTP responses out of order: late old success cannot restore private data.
 let s=scene();const a=s.check(),b=s.check();equal(s.calls.length,2,'parallel reads');
 s.calls[1].resolve({ok:false,status:401});await b;
 equal(s.phases.at(-1),'denied','newer unauthorized wins');
 s.calls[0].resolve({ok:true,json:async()=>baseProjection});await a;
 equal(s.states.at(-1),null,'old valid response cannot reappear');
 equal(s.phases.at(-1),'denied','old response cannot change phase');
 // A newer successful request takes precedence over a delayed older denied result.
 s=scene();const c=s.check(),d=s.check();s.calls[1].resolve({ok:true,json:async()=>baseProjection});await d;
 s.calls[0].resolve({ok:false,status:401});await c;
 equal(s.phases.at(-1),'ready','new success not overwritten by older error');
 equal(s.states.at(-1).status,'ready','new data preserved');
 // Logout while status request is pending, even with old success arriving afterwards.
 s=scene();const pending=s.check();const logout=s.close();equal(s.calls.length,2,'status + logout');
 equal(s.states.at(-1),null,'logout immediately clears private state');
 s.calls[0].resolve({ok:true,json:async()=>baseProjection});await pending;
 equal(s.states.at(-1),null,'inflight status cannot repaint on logout');
 s.calls[1].resolve({ok:true,status:200});await logout;
 equal(s.phases.at(-1),'denied','200 confirms logout');
 ok(s.closing.current,'closed state blocks all future status polls');
 const before=s.calls.length;await s.check();equal(s.calls.length,before,'no more status reads after logout');
 // HTTP 503 logout, preserve hidden data; retry can finally succeed.
 s=scene();const f=s.close();s.calls[0].resolve({ok:false,status:503});await f;
 equal(s.phases.at(-1),'logout-error','HTTP failure never claims logout success');
 equal(s.states.at(-1),null,'data hidden on failed HTTP logout');
 const again=s.close();s.calls[1].resolve({ok:true,status:200});await again;
 equal(s.phases.at(-1),'denied','retry succeeded');
 // Network failures and multiple clicks are controlled.
 s=scene();const p=s.close();const ignored=s.close();equal(s.calls.length,1,'double tap single logout');
 s.calls[0].reject(Error('network failure'));await p;await ignored;
 equal(s.phases.at(-1),'logout-error','network error never claims success');
 equal(s.states.at(-1),null,'network error keeps data hidden');
 // Status offline and recovery always fetch anew.
 s=scene();s.offline();await s.check();equal(s.phases.at(-1),'offline','offline state');
 equal(s.calls.length,0,'offline does not call server');
 s.online();const recover=s.check();s.calls[0].resolve({ok:true,json:async()=>baseProjection});await recover;
 equal(s.phases.at(-1),'ready','reconnected state');
 // Backend revocation during an open page.
 s=scene();const revoked=s.check();s.calls[0].resolve({ok:false,status:404});await revoked;
 equal(s.states.at(-1),null,'revoked session private data cleared');
 equal(s.phases.at(-1),'denied','revoked session shows unavailable');
 // No data leak by overly long technical test ID; short commercial label preserved.
 const fallback=extraction('const friendlyOrderLabel=', ';\nconst eventIcons');
 const label=vm.runInNewContext('('+fallback.replace('(label:string)','(label)')+')');
 equal(label('#1048'),'Pedido #1048','short commercial number');
 equal(label('#R257A_870266b86bcda2993c17ba43'),'Seu pedido','technical fixture redacted');
 equal(label('#site_01234567890123456789'),'Seu pedido','long site identifier redacted');
 console.log(`R260_GATE_PASS: ${n} structural/behavioral assertions (deterministic HTTP simulations, no network/Firestore)`);
})().catch(e=>{console.error('R260_GATE_FAIL',e);process.exitCode=1});
