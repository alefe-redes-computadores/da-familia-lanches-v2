'use strict';
const assert = require('node:assert/strict');
const fs=require('node:fs');
const src=fs.readFileSync('src/components/tracking/TrackingExperience.tsx','utf8');
const start=src.indexOf('    const launch=async()=>{');
const end=src.indexOf('    void launch();',start);
assert.ok(start>=0&&end>start,'launch anchor');
const launchCode=src.slice(start,end);
assert.ok(launchCode.includes('if(!revoked.ok)'), 'HTTP result verified');
assert.ok(launchCode.includes('if(cancelled)return'), 'superseded effect blocked');
assert.ok(!launchCode.includes('catch {}'),'failed revocation never ignored');
const makeLaunch=new Function('window','fetch','setState','setPhase','initializing','check','cancelled',`${launchCode}\nreturn launch;`);
const token='A'.repeat(43);
async function scenario(name, revoke, expectedExchanges, expectedPhase, cancelled=false){
  const calls=[]; const phases=[];const states=[];
  const window={location:{hash:'#t='+token,pathname:'/acompanhar',search:''},history:{replaceState(...args){calls.push('url-clean');window.location.hash='';}}};
  const fetch=async(url)=>{calls.push(url);if(url.includes('/revoke')){if(revoke==='offline')throw new Error('network');return {ok:revoke==='success'}}return {ok:true};};
  let checks=0;const initializing={current:true};
  await makeLaunch(window,fetch,v=>states.push(v),v=>phases.push(v),initializing,async()=>{checks++},cancelled)();
  assert.equal(calls.filter(x=>x==='/acompanhar/api/session').length,expectedExchanges,name+' token exchanges');
  assert.equal(phases[phases.length-1],expectedPhase,name+' phase');
  if(expectedExchanges===0){assert.equal(checks,0,name+' status checks');assert.equal(initializing.current,true,name+' initialization blocked')}
  else {assert.equal(checks,1,name+' status check');assert.equal(initializing.current,false,name+' initialized')}
  assert.ok(calls.includes('url-clean'),name+' fragment removed');
  console.log('PASS:',name);
}
(async()=>{
  await scenario('HTTP 500 cannot exchange token','http500',0,'denied');
  await scenario('network failure cannot exchange token','offline',0,'offline');
  await scenario('successful revoke permits new token exchange','success',1,undefined);
  await scenario('cancelled effect cannot exchange token','success',0,undefined,true);
  assert.ok(src.includes("const currentEpoch = ++epoch.current;"),'R258 response epoch retained');
  assert.ok(src.includes("if(!response.ok)throw new Error('TRACKING_REVOKE_UNCONFIRMED')"),'R259 logout http guard retained');
  assert.ok(src.includes("Seu pedido, passo a passo"),'R260 polish retained');
  assert.ok(src.includes("eventIcons[item.kind]"),'R260 icons retained');
  console.log('R263_SESSION_TEST_PASS: 4 async scenarios + 4 retained protections');
})().catch(e=>{console.error(e);process.exitCode=1});
