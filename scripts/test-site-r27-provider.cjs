#!/usr/bin/env node
'use strict';
/** R27 hermetic tests. No network, real Firestore, provider or WhatsApp. */
const fs=require('node:fs'), assert=require('node:assert/strict'),vm=require('node:vm');
const ts=require('typescript');let passed=0;
const ok=(x,label)=>{assert.ok(x,label);passed++;};
const read=p=>fs.readFileSync(p,'utf8');
const paths=[
 'src/lib/tracking/r27ProviderPolicy.ts',
 'src/lib/tracking/r27ProviderTransport.ts',
 'src/lib/tracking/r27AutomaticDelivery.ts',
 'src/lib/tracking/automaticAcceptance.ts',
 'src/app/api/integration/worker/route.ts',
 'src/lib/tracking/r26OperationalPolicy.ts',
 'src/lib/tracking/r26OperationsServer.ts',
 'src/components/admin/Dfl360OperationsCard.tsx',
];
for(const path of paths){
 const parsed=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,path.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 ok(parsed.parseDiagnostics.length===0,`parse ${path}`);
}
function transpile(path){return ts.transpileModule(read(path),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;}
function load(path,dependencies={},context={}){
 const m={exports:{}};
 vm.runInNewContext(transpile(path),{module:m,exports:m.exports,require:(name)=>{
  if(name in dependencies)return dependencies[name];throw Error('unexpected module '+name);
 },URL,AbortSignal,Buffer,Date,Math,Number,String,Object,JSON,...context},{timeout:1200,filename:path});
 return m.exports;
}
const pure=load('src/lib/tracking/r27ProviderPolicy.ts');
const ref='abcdefghijklmnopqrst';
const conf={DFL_SITE_TRACKING_PROVIDER_PROJECT_REF:ref,
 DFL_SITE_TRACKING_PROVIDER_HANDOFF_URL:`https://${ref}.supabase.co/functions/v1/dfl-tracking-provider-handoff`,
 DFL_SITE_TRACKING_PROVIDER_APIKEY:'sb_secret_'+'x'.repeat(45),
 DFL_SITE_TRACKING_PROVIDER_HANDOFF_SECRET:'s'.repeat(55),
 DFL_SITE_TRACKING_ENABLED:'1',DFL_SITE_TRACKING_AUTO_ACCEPT_ENABLED:'1',DFL_SITE_TRACKING_AUTO_ISSUE_ENABLED:'1',
 DFL_SITE_TRACKING_AUTO_PROVIDER_CERTIFIED:'1',DFL_SITE_TRACKING_PROVIDER_TRANSPORT_CERTIFIED:'1',
 DFL_SITE_TRACKING_AUTO_WORKER_ENABLED:'1',DFL_SITE_TRACKING_AUTO_KILL_SWITCH:'false',
 DFL_SITE_TRACKING_AUTO_ACTIVATED_AT:new Date(Date.now()-60_000).toISOString()};
ok(pure.r27ProviderConfig({})===null,'sem env bloqueia');
ok(pure.r27DispatchConfigured({})===false,'OFF por padrao');
ok(Boolean(pure.r27ProviderConfig(conf)),'endpoint Supabase exato permitido');
ok(pure.r27DispatchConfigured(conf),'precondicoes independentes');
ok(!pure.r27DispatchConfigured({...conf,DFL_SITE_TRACKING_AUTO_ACTIVATED_AT:''}),'sem inicio de rollout nao cria jobs');
ok(!pure.r27ShouldEnqueue(conf,new Date(Date.now()-3600_000).toISOString()),'nenhum backlog de antes da ativacao');
ok(pure.r27ShouldEnqueue(conf,new Date().toISOString()),'somente aceites novos depois da ativacao');
for(const key of ['DFL_SITE_TRACKING_ENABLED','DFL_SITE_TRACKING_AUTO_ACCEPT_ENABLED','DFL_SITE_TRACKING_AUTO_ISSUE_ENABLED','DFL_SITE_TRACKING_AUTO_PROVIDER_CERTIFIED','DFL_SITE_TRACKING_PROVIDER_TRANSPORT_CERTIFIED','DFL_SITE_TRACKING_AUTO_WORKER_ENABLED'])
 ok(!pure.r27DispatchConfigured({...conf,[key]:'0'}),`OFF individual ${key}`);
ok(!pure.r27DispatchConfigured({...conf,DFL_SITE_TRACKING_AUTO_KILL_SWITCH:'true'}),'kill switch');
for(const url of ['http://'+ref+'.supabase.co/functions/v1/dfl-tracking-provider-handoff',
 'https://evil.supabase.co/functions/v1/dfl-tracking-provider-handoff',
 'https://'+ref+'.supabase.co/functions/v1/dfl-tracking-provider-handoff?token=xyz',
 'https://'+ref+'.supabase.co/functions/v1/dfl-messaging-ingest',
 'https://'+ref+'.supabase.co/functions/v1/dfl-tracking-provider-handoff#leak'])
 ok(pure.r27ProviderConfig({...conf,DFL_SITE_TRACKING_PROVIDER_HANDOFF_URL:url})===null,'bloqueia host, protocolo, path, query ou fragment');
ok(!pure.r27ProviderConfig({...conf,DFL_SITE_TRACKING_PROVIDER_APIKEY:'public'}),'key secreta obrigatoria');
ok(!pure.r27ProviderConfig({...conf,DFL_SITE_TRACKING_PROVIDER_HANDOFF_SECRET:'weak'}),'segredo dedicado obrigatorio');
const now=Date.now();
const initial={order_id:'ABCDEFGHIJ123',recipient_e164:'+5534999999999',expires_at:new Date(now+45*60_000).toISOString(),url:'https://dafamilialanches.com.br/acompanhar#t='+('X'.repeat(43))};
ok(pure.r27ValidHandoffInput(initial,now),'token canonico e TTL');
ok(!pure.r27ValidHandoffInput({...initial,url:'https://evil.test/acompanhar#t='+('X'.repeat(43))},now),'sem URL externa');
ok(!pure.r27ValidHandoffInput({...initial,expires_at:new Date(now+48*60_000).toISOString()},now),'sem TTL ampliado');
ok(!pure.r27ValidHandoffInput({...initial,recipient_e164:'551199'},now),'sem telefone ruim');
const ack={contract:'dfl.tracking.provider.v1',version:1,action:'send_tracking_initial',result:'accepted_by_provider',provider_event_id:'msg-provider-123',customer_delivery_confirmed:false};
ok(pure.r27ValidProviderReply(ack),'recibo separado de entrega');
ok(!pure.r27ValidProviderReply({...ack,customer_delivery_confirmed:true}),'nao provar entrega');
ok(!pure.r27ValidProviderReply({...ack,tracking_link:initial.url}),'rejeitar token ecoado');
ok(!pure.r27ValidProviderReply({...ack,result:'delivered'}),'sem status fabricado');
const r26=read('src/lib/tracking/r26OperationalPolicy.ts');
const r26exp=load('src/lib/tracking/r26OperationalPolicy.ts');
ok(r26exp.r26StatusBucket('automatic_delivery','pending')==='pending','fila aguardando');
ok(r26exp.r26StatusBucket('automatic_delivery','provider_accepted')==='acknowledged','aceite API nao entregue');
ok(r26exp.r26StatusBucket('automatic_delivery','review_required')==='review','fila em revisao');
ok(r26exp.r26StatusBucket('automatic_delivery','processing')==='processing','fila em processamento');
ok(r26exp.r26StatusBucket('tracking_links','reserved')==='processing','P9 anterior preservado');
const persisted=r26exp.r26Summarize('acceptances',[{state:'acknowledged'},{state:'blocked'}],2);
ok(persisted.counts.acknowledged===1&&persisted.counts.review===1,'central R26 le state real e nao somente status');
const grants=r26exp.r26Summarize('tracking_links',[{state:'reserved'},{state:'review_required'}],2);
ok(grants.counts.processing===1&&grants.counts.review===1,'P9 contabiliza documentos reais com state');
const aged=r26exp.r26Summarize('automatic_delivery',[{state:'processing',locked_at:new Date(Date.now()-7*60_000).toISOString()},{state:'processing',locked_at:new Date().toISOString()}],2);
ok(aged.staleProcessing===1,'admin sinaliza job preso sem reenvio');
const acceptance=read('src/lib/tracking/automaticAcceptance.ts');
ok(acceptance.includes('state===\'acknowledged\'&&r27ShouldEnqueue(process.env,claim.acceptedAt)'),'enfileirar somente novo ACK com gates completos');
ok(acceptance.includes('const jobSnap=jobRef?await tx.get(jobRef):null;')&&acceptance.includes('tx.create(jobRef,'),'job atomico apos todas as leituras');
ok(acceptance.includes("text(live.locked_by)!==lock")&&acceptance.includes('if(!settled){result.deferred++;continue;}'),'fence do R26 preservado');
const server=read('src/lib/tracking/r26OperationsServer.ts');
ok(server.includes('R27_COLLECTION')&&server.includes("'automatic_delivery'")&&server.includes('transportReady:r27DispatchConfigured(process.env)'),'central operativa inclui quarta fila');
const card=read('src/components/admin/Dfl360OperationsCard.tsx');
ok(card.includes("key:'automatic_delivery'")&&card.includes('snapshot.transportReady'),'UI diagnosica mas sem env secretos');
ok(!/useEffect\s*\(|onSnapshot\s*\(|setInterval\s*\(/.test(card),'sem polling no Admin');
const worker=read('src/app/api/integration/worker/route.ts');
ok(worker.includes('drainR27AutomaticDelivery(1)')&&worker.includes('const autoAccept=await drainAutoAcceptances(5)'),'worker aceites antes de notificacoes');
const flow=read('src/lib/tracking/r27AutomaticDelivery.ts');
ok(flow.includes("where('state','==','pending')")&&!flow.includes("'processing'])."),'worker NAO recupera estado incerto');
ok(flow.includes('value(d.locked_by)!==lease')&&flow.includes("state:'processing'")&&flow.includes('attempts:1'),'claim e settle protegidos');
ok(!flow.includes('setTimeout(')&&!flow.includes('retry_at')&&!flow.includes('opaque_token'),'sem retry do token');
const transport=read('src/lib/tracking/r27ProviderTransport.ts');
ok(transport.includes("import 'server-only'")&&transport.includes("redirect:'error'")&&transport.includes("cache:'no-store'")&&transport.includes('AbortSignal.timeout'),'transporte server-only no-redirect');
ok(!transport.includes('console.log')&&!transport.includes('console.error')&&!transport.includes('integration_notification_intents'),'sem logs nem outbox persistente');
const providerDependencies={'server-only':{},'./r27ProviderPolicy':pure,
 './r31MessagingAuthentication':{r31SignedHeaders:()=>({})}};
const good=load('src/lib/tracking/r27ProviderTransport.ts',providerDependencies,{process:{env:conf},fetch:async(url,params)=>{
 ok(url===conf.DFL_SITE_TRACKING_PROVIDER_HANDOFF_URL,'chama somente origem fixada');
 ok(params.redirect==='error'&&params.cache==='no-store'&&params.method==='POST','POST seguro');
 ok(params.headers.apikey===conf.DFL_SITE_TRACKING_PROVIDER_APIKEY,'apikey no header correto');
 ok(!params.body.includes(conf.DFL_SITE_TRACKING_PROVIDER_HANDOFF_SECRET),'segredo nunca no payload');
 ok(params.body.includes(initial.url),'token somente no body efemero do transporte');
 return {ok:true,headers:{get:()=> 'application/json'},text:async()=>JSON.stringify(ack)};
}});
const disabled=load('src/lib/tracking/r27ProviderTransport.ts',providerDependencies,{process:{env:{}},fetch:async()=>{throw Error('OFF jamais conecta');}});
(async()=>{
 const sent=await good.r27SendToProvider(initial);
 ok(sent.result==='accepted_by_provider'&&sent.provider_event_id==='msg-provider-123','provedor responde contrato apenas');
 await assert.rejects(disabled.r27SendToProvider(initial),/R27_HANDOFF_NOT_READY/);
 ok(true,'OFF sem qualquer fetch');
 let attempts=0;
 const flaky=load('src/lib/tracking/r27ProviderTransport.ts',providerDependencies,{process:{env:conf},fetch:async()=>{attempts++;throw Error('timed out');}});
 await assert.rejects(flaky.r27SendToProvider(initial),/R27_PROVIDER_TRANSPORT_UNCERTAIN/);
 ok(attempts===1,'erro incerto sem retransmitir');
 let dbReads=0;
 const inactiveFlow=load('src/lib/tracking/r27AutomaticDelivery.ts',{
  'server-only':{},'node:crypto':{randomUUID:()=> 'lease_1'},'@/lib/integration/server/admin':{adminDb:{collection:()=>{dbReads++;throw Error('should not read')}}},
  './automaticInitialHandoff':{r25SendInitialOnce:()=>{throw Error('off')}},'./r27ProviderTransport':{r27SendToProvider:()=>{throw Error('off')}},
  './r27ProviderPolicy':pure,
  './r41PilotRecipient':{r41TrackingPilotRecipient:()=>false},
 },{process:{env:{}}});
 const none=await inactiveFlow.drainR27AutomaticDelivery();
 ok(none.enabled===false&&dbReads===0,'worker OFF sem Firestore');
 const state={state:'pending',order_id:'ABCDEFGHIJ123'};
 let sends=0;
 const refDoc={id:'ABCDEFGHIJ123'},item={id:refDoc.id,ref:refDoc};
 const fakeDb={collection:(name)=>name==='Pedidos'
    ? {doc:()=>({get:async()=>({exists:true,data:()=>({customerSnapshot:{phoneE164:'+5534999999999'}})})})}
    : {where:()=>({limit:()=>({get:async()=>({docs:state.state==='pending'?[item]:[]})})})},
  runTransaction:async cb=>cb({get:async()=>({exists:true,data:()=>({...state})}),update:(_ref,patch)=>Object.assign(state,patch)})};
 const activeFlow=load('src/lib/tracking/r27AutomaticDelivery.ts',{
  'server-only':{},'node:crypto':{randomUUID:()=> 'lease_1'},'@/lib/integration/server/admin':{adminDb:fakeDb},
  './automaticInitialHandoff':{r25SendInitialOnce:async()=>{sends++;return 'provider_accepted';}},
  './r27ProviderTransport':{r27SendToProvider:async()=>({result:'accepted_by_provider',provider_event_id:'fixture1234'})},
  './r27ProviderPolicy':pure,
  './r41PilotRecipient':{r41TrackingPilotRecipient:()=>true},
 },{process:{env:conf}});
 const once=await activeFlow.drainR27AutomaticDelivery(1);
 ok(once.claimed===1&&once.accepted===1&&state.state==='provider_accepted','job aplicado uma vez');
 const again=await activeFlow.drainR27AutomaticDelivery(1);
 ok(again.claimed===0&&sends===1,'nao reenviar job encerrado');
 console.log(`R27 PROVEDOR/P9: ${passed} contratos hermeticos OK; zero rede e dados reais.`);
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
