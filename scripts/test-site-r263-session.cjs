'use strict';
/** R71 updates R263's obsolete revoke-before-exchange regression contract. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const src=fs.readFileSync('src/components/tracking/TrackingExperience.tsx','utf8');
const start=src.indexOf('    const launch=async()=>{'),end=src.indexOf('    void launch();',start);
assert.ok(start>=0&&end>start,'launch anchor');
const code=src.slice(start,end);
assert.ok(!code.includes('/session/revoke'),'opening a link never destroys an active session');
assert.ok(code.includes('if(cancelled)return'),'superseded effect cannot exchange');
assert.ok(code.includes("window.history.replaceState"),'opaque URL fragment stripped');
assert.ok(!/localStorage|sessionStorage|console\./.test(code),'no raw token persistence or logging');
const create=new Function('window','fetch','setState','setPhase','initializing','check','cancelled',`${code}\nreturn launch;`);
const token='A'.repeat(43);
async function scenario(name,variant,expectedCalls,expectedPhase,cancelled=false){
 const calls=[],phases=[];
 const win={location:{hash:'#t='+token,pathname:'/acompanhar',search:''},history:{replaceState(){calls.push('clean');win.location.hash='';}}};
 const fetch=async(url)=>{calls.push(url);if(variant==='offline')throw Error('offline');return {ok:variant==='success'};};
 const initializing={current:true};let checked=0;
 await create(win,fetch,()=>{},v=>phases.push(v),initializing,async()=>{checked++},cancelled)();
 assert.equal(calls.filter(x=>x==='/acompanhar/api/session').length,expectedCalls,`${name} exchange`);
 assert.equal(phases[phases.length-1],expectedPhase,`${name} phase`);
 const good=variant==='success'&&!cancelled;
 assert.equal(checked,good?1:0,`${name} status check`);
 assert.equal(initializing.current,!good,`${name} init`);
 assert.ok(calls.includes('clean'),`${name} fragment scrubbed`);
 assert.ok(!calls.some(v=>typeof v==='string'&&v.includes('revoke')),`${name} no revoke`);
}
(async()=>{
 await scenario('success','success',1,undefined);
 await scenario('denied','rejected',1,'denied');
 await scenario('network','offline',1,'offline');
 await scenario('cancelled','success',0,undefined,true);
 assert.ok(src.includes("if(!response.ok)throw new Error('TRACKING_REVOKE_UNCONFIRMED')"),'explicit logout guard intact');
 assert.ok(src.includes('eventIcons[item.kind]'),'icons intact');
 console.log('R263/R71: quatro cenários de lançamento e proteção de logout OK; sem rede real.');
})().catch(e=>{console.error(e);process.exitCode=1});
