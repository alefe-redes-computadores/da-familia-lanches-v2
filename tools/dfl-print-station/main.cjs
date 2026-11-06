'use strict';
/** R291 Windows local print station: source only; OFF by default, no auto-retry of uncertain spooling. */
const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const {canArm,serverUrl,validJob}=require('./station-policy.cjs');
const env=process.env;
const PRINT_URL=serverUrl(env.DFL_PRINT_STATION_URL);
const doctor=process.argv.includes('--doctor');
const armed=canArm(env);
const single=app.requestSingleInstanceLock();
if(!single)app.quit();
let rootWindow;
let inFlight=false;
const MAX_LEDGER=5000;
let ledgerFile='';
let ledger={};

function persist(){
  // Local ledger saves job keys only: never addresses, messages or phone numbers.
  const entries=Object.entries(ledger).slice(-MAX_LEDGER);
  ledger=Object.fromEntries(entries);
  const tmp=`${ledgerFile}.tmp`;
  fs.writeFileSync(tmp,JSON.stringify(ledger),{encoding:'utf8',mode:0o600});
  fs.renameSync(tmp,ledgerFile);
}
function seen(id){return Object.prototype.hasOwnProperty.call(ledger,id);}
function record(id,state){ledger[id]={state,at:new Date().toISOString()};persist();}
function createHiddenWindow(){
  const win=new BrowserWindow({show:false,width:480,height:700,webPreferences:{
    nodeIntegration:false,contextIsolation:true,sandbox:true,javascript:false,webSecurity:true,
  }});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  win.webContents.on('will-navigate',event=>event.preventDefault());
  return win;
}
async function printers(){
  return rootWindow.webContents.getPrintersAsync();
}
async function serverAction(body){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),9000);
  try {
    const response=await fetch(PRINT_URL,{
      method:'POST',headers:{'Content-Type':'application/json','x-dfl-print-agent-token':env.DFL_PRINT_STATION_TOKEN},
      body:JSON.stringify(body),cache:'no-store',redirect:'error',signal:controller.signal,
    });
    const result=await response.json();
    if(!response.ok||!result?.ok)throw Error(`SERVER_${response.status}_${String(result?.error||'ERROR').slice(0,48)}`);
    return result;
  }finally{clearTimeout(timeout);}
}
function spool(win,printer){
  return new Promise((resolve,reject)=>{
    win.webContents.print({silent:true,deviceName:printer,printBackground:false,
      usePrinterDefaultPageSize:true,margins:{marginType:'none'}},
      (success,reason)=>success?resolve(true):reject(Error('PRINT_FAILED_'+String(reason||'unknown').slice(0,55))));
  });
}
async function processOne(){
  if(inFlight||!armed)return;
  inFlight=true;
  let job=null;
  try{
    const available=await printers();
    if(!available.some(p=>p.name===env.DFL_PRINT_STATION_PRINTER)){
      console.warn('[DFL print] Impressora selecionada indisponivel; nada sera retirado da fila.');return;
    }
    const claimed=await serverAction({action:'claim'});
    job=claimed.job;
    if(!job)return;
    if(!validJob(job)){
      console.error('[DFL print] Payload nao atende ao contrato; trabalho fica em revisao.');return;
    }
    if(seen(job.id)){
      console.error('[DFL print] Trabalho ja processado nesta maquina. Nao imprimir novamente:',job.id);return;
    }
    // Crucial: persist BEFORE calling Windows spooler. After a crash, never print twice automatically.
    record(job.id,'printing_uncertain');
    const win=createHiddenWindow();
    try {
      await win.loadURL('data:text/html;charset=UTF-8,'+encodeURIComponent(job.html));
      await spool(win,env.DFL_PRINT_STATION_PRINTER);
      record(job.id,'accepted_by_windows_spooler');
    }finally{if(!win.isDestroyed())win.destroy();}
    // An acknowledgement failure must NOT cause a second print. The server retains the claim.
    await serverAction({action:'ack',jobId:job.id,claimToken:job.claimToken});
    console.info('[DFL print] Enviado a fila do Windows:',job.id,'(NAO comprova papel impresso)');
  }catch(e){
    console.error('[DFL print] Falha/estado incerto, SEM repeticao automatica:',e?.message||'unknown');
    if(job && validJob(job)){
      try{await serverAction({action:'problem',jobId:job.id,claimToken:job.claimToken});}
      catch{console.warn('[DFL print] Nao foi possivel atualizar estado remoto; requer revisao manual.');}
    }
  }finally{inFlight=false;}
}

app.whenReady().then(async()=>{
  // All sessions deny arbitrary permissions, including printing-related devices.
  session.defaultSession.setPermissionRequestHandler((_web, _permission,callback)=>callback(false));
  rootWindow=createHiddenWindow();
  ledgerFile=path.join(app.getPath('userData'),'print-jobs-ledger.json');
  try{ledger=JSON.parse(fs.readFileSync(ledgerFile,'utf8'));if(!ledger||typeof ledger!=='object'||Array.isArray(ledger))ledger={};}
  catch(error){if(error?.code==='ENOENT')ledger={};else{console.error('[DFL print] Ledger ilegivel. Impressao bloqueada.');app.quit();return;}}
  if(doctor){
    const list=await printers();
    console.info('DFL PRINT - Impressoras Windows:',list.map(p=>({name:p.name,isDefault:p.isDefault})));
    console.info('Estado: SOMENTE DIAGNOSTICO. Nenhum pedido consultado ou impresso.');
    app.quit();return;
  }
  if(!armed){
    console.info('DFL Print Station OFF. Requer modo print, confirmacao YES, impressora exata, URL e token.');
    app.quit();return;
  }
  console.info('DFL Print Station ARMADA: impressao silenciosa de tickets autorizados. Ctrl+C para parar.');
  await processOne();
  setInterval(()=>void processOne(),Math.max(4000,Math.min(Number(env.DFL_PRINT_STATION_INTERVAL_MS)||6000,30000)));
}).catch(error=>console.error('[DFL print] Nao iniciou:',error?.message||'unknown'));
