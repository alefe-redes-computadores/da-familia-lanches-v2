'use strict';
const fs=require('node:fs');const assert=require('node:assert/strict');const vm=require('node:vm');const ts=require('typescript');
const read=p=>fs.readFileSync(p,'utf8');
const route=read('src/app/api/integration/printing/route.ts');
const policy=read('src/lib/printing/printStationPolicy.ts');
const orders=read('src/app/api/orders/route.ts');
const agent=read('tools/dfl-print-station/main.cjs');
let n=0;const ok=(name,result)=>{assert.ok(result,'R291: '+name);n++;console.log('R291 OK:',name)};
for(const path of ['src/app/api/integration/printing/route.ts','src/lib/printing/printStationPolicy.ts','src/app/api/orders/route.ts']){
 const src=ts.createSourceFile(path,read(path),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 ok('TS AST '+path,src.parseDiagnostics.length===0);
}
const transpiled=ts.transpileModule(policy,{fileName:'policy.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const m={exports:{}};vm.runInNewContext(transpiled,{module:m,exports:m.exports,process:{env:{}},String,Date,Number,RegExp},{timeout:1500});
const id='site_'+('a'.repeat(40));
const env={DFL_PRINT_AUTO_ENABLED:'true',DFL_PRINT_AGENT_ENABLED:'true',DFL_PRINT_AGENT_TOKEN:'x'.repeat(48),DFL_PRINT_AUTO_TICKET_MODE:'kitchen',DFL_PRINT_PAPER_MM:'58'};
ok('OFF por padrao',m.exports.planSitePrintJobs(id,false,{}).length===0);
for(const [key,v] of [['DFL_PRINT_AUTO_ENABLED','false'],['DFL_PRINT_AGENT_ENABLED','false'],['DFL_PRINT_AGENT_TOKEN','short'],['DFL_PRINT_PAPER_MM','57'],['DFL_PRINT_AUTO_TICKET_MODE','all']])
 ok('gate '+key,m.exports.planSitePrintJobs(id,false,{...env,[key]:v}).length===0);
ok('somente pedido novo do Site',m.exports.planSitePrintJobs('ifood-123',false,env).length===0);
ok('agendado fica fora da automacao',m.exports.planSitePrintJobs(id,true,env).length===0);
ok('modo cozinha: 1 job',m.exports.planSitePrintJobs(id,false,env).length===1);
const both=m.exports.planSitePrintJobs(id,false,{...env,DFL_PRINT_AUTO_TICKET_MODE:'both'});
ok('duas vias independentes deterministicas',both.length===2&&both[0].id!==both[1].id&&both.every(x=>x.paper_mm==='58'&&x.order_id===id));
ok('cancelado nunca chega na impressora',m.exports.printOrderBlocked('Cancelado'));
ok('agendado nao imprime',m.exports.printOrderBlocked('Agendado'));
ok('atual nao bloqueado',!m.exports.printOrderBlocked('Em Produção'));
ok('TTL reduz risco de impressao tardia',m.exports.PRINT_JOB_MAX_AGE_MS<=30*60*1000);
ok('nascimento na transacao original',orders.includes('tx.create(orderRef, canonicalOrder);')&&orders.includes('planSitePrintJobs(orderRef.id, isScheduled, process.env)')&&orders.includes('tx.create(adminDb.collection("integration_print_jobs").doc(job.id)'));
ok('nao altera idempotencia do checkout',orders.includes('requestFingerprint')&&orders.includes('tx.create(orderRef, canonicalOrder)'));
ok('agente exige token e OFF',route.includes("process.env.DFL_PRINT_AGENT_ENABLED === 'true'")&&route.includes("process.env.DFL_PRINT_AUTO_ENABLED === 'true'"));
ok('token comparado em tempo constante',route.includes('timingSafeEqual')&&!route.includes('console.log(provided)'));
ok('so POST, sem CORS publico',route.includes('export async function POST')&&!route.includes('export async function GET')&&!route.includes('Access-Control-Allow-Origin'));
ok('reivindicacao transacional',route.includes('adminDb.runTransaction')&&route.includes("where('status','==','pending')"));
ok('nao reprocessa pedido antigo',route.includes('PRINT_JOB_MAX_AGE_MS')&&route.includes("status:'needs_review'"));
ok('cancelamento confirmado no banco',route.includes('printOrderBlocked(orderSnap.data()?.status)'));
ok('comprovante vem do gerador existente',route.includes('buildThermalReceiptHtml'));
ok('aceite spooler != impresso fisicamente',route.includes('spool_submitted')&&route.includes('windows_spooler_accepted'));
ok('sem retorno PII em erros',!route.includes('console.error(order')&&!route.includes('last_error'));
ok('sem chaves Firebase no cliente',!agent.includes('FIREBASE_PRIVATE_KEY')&&!agent.includes('serviceAccount'));
ok('impressora pelo nome exato',agent.includes('p.name===env.DFL_PRINT_STATION_PRINTER'));
ok('grava ledger antes da impressao',agent.indexOf("record(job.id,'printing_uncertain')")<agent.indexOf('await spool(win,'));
ok('nunca retry apos crash ou timeout',agent.includes('if(seen(job.id))')&&!agent.includes("action:'retry'"));
ok('Renderer isolado e sem JS',agent.includes('nodeIntegration:false,contextIsolation:true,sandbox:true,javascript:false'));
ok('impressao silenciosa so em modo armado',agent.includes('if(inFlight||!armed)return;')&&agent.includes('silent:true'));
const classic=read('src/lib/printOrder.ts');
ok('manual continua com clique',classic.includes('buildThermalReceiptHtml(pedido, "58")')&&classic.includes('window.open'));
console.log(`R291: ${n} contratos hermeticos aprovados. ZERO rede/Firebase/papel.`);

// Contract execution with an in-memory Firestore transaction: no real calls.
(async()=>{
 const crypto=require('node:crypto');
 const id='site_'+('b'.repeat(40));
 const key='print-v1__'+id+'__kitchen';
 const now=new Date().toISOString();
 const jobs=new Map([[key,{status:'pending',order_id:id,kind:'kitchen',paper_mm:'58',protocol:'dfl.print.job.v1',source:'site',created_at:now}]]);
 const orders=new Map([[id,{status:'Pendente',itens:[],userName:'Ficticio'}]]);
 let reads=0;
 const doc=(collection,docId)=>({collection,id:docId});
 const snap=(ref)=>({exists:(ref.collection==='integration_print_jobs'?jobs:orders).has(ref.id),id:ref.id,data:()=>({...((ref.collection==='integration_print_jobs'?jobs:orders).get(ref.id)||{})})});
 const db={collection(name){return {doc(id){return doc(name,id)},where(field,op,value){assert.equal(name,'integration_print_jobs');assert.equal(field,'status');assert.equal(op,'==');assert.equal(value,'pending');return {limit(n){assert.equal(n,8);return {async get(){reads++;const docs=[...jobs].filter(([,v])=>v.status==='pending').map(([i,v])=>({id:i,get:k=>v[k]}));return {empty:!docs.length,docs};}}}}}}},async runTransaction(fn){const staged=[];const tx={get:async ref=>{reads++;return snap(ref);},update:(ref,v)=>staged.push([ref,v])};const out=await fn(tx);for(const [ref,values] of staged){const map=ref.collection==='integration_print_jobs'?jobs:orders;map.set(ref.id,{...map.get(ref.id),...values});}return out;}};
 const modules={
  'next/server':{NextResponse:{json:(body,opts)=>({body,status:opts.status||200})}},
  'node:crypto':crypto,
  '@/lib/integration/server/admin':{adminDb:db},
  '@/lib/thermalReceipt':{buildThermalReceiptHtml:()=>'<html><body data-profile="58" data-ticket="full"><main>Ficticio</main></body></html>'},
  '@/lib/printing/printStationPolicy':m.exports,
 };
 const compiled=ts.transpileModule(route,{fileName:'route.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const instance={exports:{}};
 const serverEnv={DFL_PRINT_AGENT_ENABLED:'false',DFL_PRINT_AUTO_ENABLED:'false',DFL_PRINT_AGENT_TOKEN:'t'.repeat(64)};
 vm.runInNewContext(compiled,{module:instance,exports:instance.exports,require:name=>{assert(modules[name],name);return modules[name]},process:{env:serverEnv},Date,Number,String,console},{timeout:1500});
 const req=(body,token='t'.repeat(64))=>({headers:{get:x=>x==='x-dfl-print-agent-token'?token:x==='content-length'?null:null},text:async()=>JSON.stringify(body)});
 let result=await instance.exports.POST(req({action:'claim'}));ok('servidor OFF bloqueia',result.status===503&&reads===0);
 serverEnv.DFL_PRINT_AGENT_ENABLED='true';serverEnv.DFL_PRINT_AUTO_ENABLED='true';
 result=await instance.exports.POST(req({action:'claim'},'bad'));ok('token incorreto bloqueia antes do banco',result.status===401&&reads===0);
 result=await instance.exports.POST(req({action:'claim'}));
 ok('claim autorizado entrega exatamente um ticket',result.status===200&&result.body.job?.id===key&&result.body.job.html.includes('data-ticket="kitchen"'));
 ok('job atomico nao volta a pending',jobs.get(key).status==='claimed');
 result=await instance.exports.POST(req({action:'claim'}));ok('nao reclama trabalho ja retirado',result.status===200&&result.body.job===null);
 result=await instance.exports.POST(req({action:'ack',jobId:key,claimToken:'e'.repeat(64)}));ok('claim token invalido nao confirma',result.status===409&&jobs.get(key).status==='claimed');
 const token=jobs.get(key).claim_hash;
 // ClaimToken is only exposed to the direct in-memory authorized caller: repeat claim in a new job to test successful ack.
 const secondKey='print-v1__'+id+'__full';
 jobs.set(secondKey,{status:'pending',order_id:id,kind:'full',paper_mm:'58',protocol:'dfl.print.job.v1',source:'site',created_at:now});
 result=await instance.exports.POST(req({action:'claim'}));const second=result.body.job;
 ok('segunda via independente',second?.id===secondKey&&second.html.includes('data-ticket="full"'));
 result=await instance.exports.POST(req({action:'ack',jobId:secondKey,claimToken:second.claimToken}));ok('ACK so aceita claim correto',result.status===200&&jobs.get(secondKey).status==='spool_submitted');
 result=await instance.exports.POST(req({action:'ack',jobId:secondKey,claimToken:second.claimToken}));ok('ACK duplicado e idempotente',result.body.duplicate===true);
 const thirdKey='print-v1__'+('c'.repeat(40)).padStart(45,'_')+'__kitchen';
 const staleId='site_'+('c'.repeat(40));const staleKey='print-v1__'+staleId+'__kitchen';
 jobs.set(staleKey,{status:'pending',order_id:staleId,kind:'kitchen',paper_mm:'58',protocol:'dfl.print.job.v1',source:'site',created_at:'2020-01-01T00:00:00Z'});
 result=await instance.exports.POST(req({action:'claim'}));ok('job vencido para revisao sem impressao',result.body.job===null&&jobs.get(staleKey).status==='needs_review');
 const canceledId='site_'+('d'.repeat(40));const canceledKey='print-v1__'+canceledId+'__kitchen';
 orders.set(canceledId,{status:'Cancelado'});
 jobs.set(canceledKey,{status:'pending',order_id:canceledId,kind:'kitchen',paper_mm:'58',protocol:'dfl.print.job.v1',source:'site',created_at:now});
 result=await instance.exports.POST(req({action:'claim'}));ok('pedido cancelado bloqueado',result.body.job===null&&jobs.get(canceledKey).status==='needs_review');
 console.log('R291: testes transacionais in-memory aprovados, nenhuma impressora tocada.');
})().catch(error=>{console.error(error);process.exitCode=1;});
