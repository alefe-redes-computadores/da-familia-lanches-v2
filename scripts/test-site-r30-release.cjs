#!/usr/bin/env node
'use strict';
/** R30 hermetic release-gate audits. No live Firestore, Supabase, WhatsApp, provider, network or database. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
let passed=0;
const ok=(x,n)=>{assert.ok(x,n);passed++;};
const read=p=>fs.readFileSync(p,'utf8');
const files=[
 'src/lib/tracking/r27ProviderPolicy.ts',
 'src/lib/tracking/r29CertificationPolicy.ts',
 'src/lib/tracking/r29CertificationServer.ts',
 'src/lib/tracking/r30ReleasePolicy.ts',
 'src/components/admin/R29CertificationCard.tsx',
 'scripts/test-site-r29-certification.cjs',
];
for(const f of files){
 const ast=ts.createSourceFile(f,read(f),ts.ScriptTarget.Latest,true,f.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(ast.parseDiagnostics.length===0,`TypeScript parse ${f}`);
}
const load=(p)=>{
 const out={};vm.runInNewContext(ts.transpileModule(read(p),{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:out,Date,URL,Map});return out;
};
const r27=load('src/lib/tracking/r27ProviderPolicy.ts');
const r29=load('src/lib/tracking/r29CertificationPolicy.ts');
const r30=load('src/lib/tracking/r30ReleasePolicy.ts');
const now=Date.now();
const stamp=new Date(now-30_000).toISOString();
const ref='bwggczkzsqcdeayyysmx';
const conf={
 DFL_SITE_TRACKING_PROVIDER_PROJECT_REF:ref,
 DFL_SITE_TRACKING_PROVIDER_HANDOFF_URL:`https://${ref}.supabase.co/functions/v1/dfl-tracking-provider-handoff`,
 DFL_SITE_TRACKING_PROVIDER_APIKEY:'sb_secret_'+'a'.repeat(50),
 DFL_SITE_TRACKING_PROVIDER_HANDOFF_SECRET:'P'.repeat(64),
 DFL_SITE_TRACKING_ENABLED:'1',
 DFL_SITE_TRACKING_AUTO_ACCEPT_ENABLED:'1',
 DFL_SITE_TRACKING_AUTO_ISSUE_ENABLED:'1',
 DFL_SITE_TRACKING_AUTO_PROVIDER_CERTIFIED:'1',
 DFL_SITE_TRACKING_PROVIDER_TRANSPORT_CERTIFIED:'1',
 DFL_SITE_TRACKING_AUTO_WORKER_ENABLED:'1',
 DFL_SITE_TRACKING_AUTO_KILL_SWITCH:'false',
 DFL_SITE_TRACKING_AUTO_ACTIVATED_AT:stamp,
};
ok(r27.r27DispatchConfigured(conf),'fully explicit config used in old canary tests');
ok(!r27.r27DispatchConfigured({...conf,DFL_SITE_TRACKING_AUTO_KILL_SWITCH:undefined}),'absent kill flag MUST block');
ok(!r27.r27DispatchConfigured({...conf,DFL_SITE_TRACKING_AUTO_KILL_SWITCH:'true'}),'emergency kill flag blocks');
ok(!r27.r27DispatchConfigured({...conf,DFL_SITE_TRACKING_AUTO_KILL_SWITCH:'False'}),'kill flag case-sensitive');
ok(!r27.r27DispatchConfigured({...conf,DFL_SITE_TRACKING_AUTO_KILL_SWITCH:''}),'empty kill flag blocks');
ok(!r27.r27DispatchConfigured({...conf,DFL_SITE_TRACKING_AUTO_KILL_SWITCH:'0'}),'kill flag zero blocks');
for(const k of ['DFL_SITE_TRACKING_ENABLED','DFL_SITE_TRACKING_AUTO_ACCEPT_ENABLED','DFL_SITE_TRACKING_AUTO_ISSUE_ENABLED',
 'DFL_SITE_TRACKING_AUTO_PROVIDER_CERTIFIED','DFL_SITE_TRACKING_PROVIDER_TRANSPORT_CERTIFIED','DFL_SITE_TRACKING_AUTO_WORKER_ENABLED'])
 ok(!r27.r27DispatchConfigured({...conf,[k]:undefined}),`missing independent guard ${k}`);
ok(!r27.r27DispatchConfigured({...conf,DFL_SITE_TRACKING_PROVIDER_PROJECT_REF:'evil'}),'reject unknown target');
ok(!r27.r27DispatchConfigured({...conf,DFL_SITE_TRACKING_PROVIDER_APIKEY:''}),'reject missing key');
ok(r27.r27ValidActivation(stamp),'rollout instant recognized');
ok(!r29.r29ValidActivation(undefined),'undefined activation is OFF');
ok(!r29.r29ValidActivation('yes'),'malformed activation is OFF');
ok(!r29.r29ValidActivation('2026-11-08T20:00:00+03:00'),'offset activation is OFF');
ok(!r29.r29ValidActivation('2000-01-01T00:00:00Z'),'old historical date is OFF');
ok(!r29.r29ValidActivation(new Date(now+3*60_000).toISOString(),now),'future launch is OFF');
ok(r29.r29ValidActivation(stamp,now),'current explicit UTC activation accepted');
ok(r29.r29ValidActivation(new Date(now+59_000).toISOString(),now),'small clock skew permitted');
const base=r29.r29Checks({},false);
ok(base.length===12,'stable checklist shape');
ok(base.find(c=>c.id==='kill').state==='off','missing kill is OFF');
ok(base.find(c=>c.id==='activation').state==='off','missing activation is OFF');
ok(base.find(c=>c.id==='endpoint').state==='off','missing Site credentials are OFF');
ok(r29.r29Checks({...conf,DFL_SITE_TRACKING_AUTO_KILL_SWITCH:'true'},true).find(c=>c.id==='kill').state==='off','emergency ON is not eligible');
ok(r29.r29Checks({...conf,DFL_SITE_TRACKING_AUTO_ACTIVATED_AT:'tomorrow'},true).find(c=>c.id==='activation').state==='off','invalid activation not displayed ready');
const enabled=r29.r29Checks(conf,true);
ok(enabled.find(c=>c.id==='kill').state==='configured','explicit release flag recognized');
ok(enabled.find(c=>c.id==='activation').state==='configured','valid activation recognized');
ok(enabled.find(c=>c.id==='endpoint').state==='configured','fixed provider configuration recognized');
const receiver=(state='authenticated',configured=true,enabled=false)=>({state,providerConfigured:configured,deliveryEnabled:enabled});
const check=(c,r)=>r30.r30AssessRelease(c,r);
const completelyOff=check(base,receiver('not_checked',null,null));
ok(completelyOff.status==='blocked','cold start blocked');
ok(completelyOff.siteDispatchAuthorized===false,'no public dispatch permission');
ok(completelyOff.customerDeliveryVerified===false,'no fictitious customer receipt');
ok(completelyOff.blockers.some(b=>b.code==='s2s_auth'),'requires S2S proof');
ok(completelyOff.blockers.some(b=>b.code==='site_endpoint'),'requires Site secrets');
const safeChecks=r29.r29Checks({...conf,DFL_SITE_TRACKING_AUTO_WORKER_ENABLED:undefined,DFL_SITE_TRACKING_AUTO_KILL_SWITCH:'true'},true);
const safe=check(safeChecks,receiver());
ok(safe.status==='ready_for_isolated_canary','safe no-send state allows only isolated canary planning');
ok(safe.siteWorkerDisabled&&safe.remoteSendDisabled,'two independent OFF controls');
ok(!safe.siteDispatchAuthorized&&!safe.customerDeliveryVerified,'readiness does not certify production');
ok(safe.blockers.some(b=>b.code==='entregas_p9')&&safe.blockers.some(b=>b.code==='canary'),'real Entregas and canary remain mandatory');
ok(!check(safeChecks,receiver('unauthorized',null,null)).transportAuthenticated,'bad auth never counted');
ok(check(safeChecks,receiver('unauthorized',null,null)).status==='blocked','bad auth blocks');
ok(check(safeChecks,receiver('authenticated',false,false)).status==='blocked','unconfigured provider blocks');
ok(check(safeChecks,receiver('authenticated',true,true)).status==='unsafe_remote_enabled','unexpected remote enabled escalates');
ok(check(safeChecks,receiver('authenticated',true,true)).blockers.some(b=>b.code==='receiver_active'),'unsafe reason surfaced');
ok(check(enabled,receiver('authenticated',true,false)).status==='blocked','site worker ON blocks isolated certification');
ok(check(enabled,receiver('authenticated',true,false)).blockers.some(b=>b.code==='site_worker'),'worker ON surfaced');
ok(check(r29.r29Checks({...conf,DFL_SITE_TRACKING_AUTO_WORKER_ENABLED:undefined},true),receiver()).status==='blocked','site kill OFF (released) blocks isolated canary');
const expectedCodes=['site_endpoint','s2s_auth','entregas_p9','canary'];
for(const code of expectedCodes)ok(completelyOff.blockers.some(b=>b.code===code),`reason ${code}`);
ok(!JSON.stringify(safe).includes(conf.DFL_SITE_TRACKING_PROVIDER_HANDOFF_SECRET),'no private key in audit');
ok(!JSON.stringify(safe).includes(conf.DFL_SITE_TRACKING_PROVIDER_APIKEY),'no API key in audit');
const server=read('src/lib/tracking/r29CertificationServer.ts');
ok(server.includes('r30AssessRelease(checks,receiver)'),'server derives safe release status');
ok(server.includes("import 'server-only'")&&server.includes('r27ProviderConfig(process.env)'),'server-side secret validation only');
ok(!server.includes('drainR27AutomaticDelivery')&&!server.includes('r25SendInitialOnce'),'read-only probe cannot dispatch');
const ui=read('src/components/admin/R29CertificationCard.tsx');
ok(ui.includes('data.releaseGate.status')&&ui.includes('data.releaseGate.blockers'),'UI highlights real gate');
ok(ui.includes('siteWorkerDisabled')&&ui.includes('remoteSendDisabled'),'UI shows separate OFF controls');
ok(!/\buseEffect\s*\(|\bonSnapshot\s*\(|setInterval\s*\(/.test(ui),'no automatic polling');
ok(ui.includes("fetch('/api/admin/dfl360-certification?probe=1'"),'explicit admin initiated probe');
const css=read('src/components/admin/R29CertificationCard.module.css');
ok(css.includes("data-gate='unsafe_remote_enabled'")&&css.includes('@media(max-width:720px)'),'visual safety + mobile');
const legacy=read('scripts/test-site-r29-certification.cjs');
ok(legacy.includes("kill switch missing is OFF"),'historical contradiction removed');
ok(read('src/lib/tracking/r27ProviderPolicy.ts').includes("env.DFL_SITE_TRACKING_AUTO_KILL_SWITCH==='false'"),'prod kill requires exact false');
console.log(`R30 RELEASE SAFETY: ${passed} hermetic assertions OK; zero network, WhatsApp, Firestore or Supabase calls.`);
