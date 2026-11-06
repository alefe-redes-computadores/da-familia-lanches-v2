'use strict';
const {URL}=require('node:url');
function serverUrl(value){
  try{
    const u=new URL(value||'https://www.dafamilialanches.com.br/api/integration/printing');
    if(u.protocol!=='https:'||!['www.dafamilialanches.com.br','dafamilialanches.com.br'].includes(u.hostname)||
       u.pathname!=='/api/integration/printing'||u.search||u.hash||u.username||u.password||u.port)return null;
    return u.href;
  }catch{return null;}
}
function canArm(env){
  return env.DFL_PRINT_STATION_MODE==='print' && env.DFL_PRINT_STATION_ARMED==='YES' &&
    typeof env.DFL_PRINT_STATION_PRINTER==='string' && env.DFL_PRINT_STATION_PRINTER.trim().length>0 &&
    /^[A-Za-z0-9_-]{32,160}$/.test(env.DFL_PRINT_STATION_TOKEN||'') &&
    Boolean(serverUrl(env.DFL_PRINT_STATION_URL));
}
function validJob(job){
  return job && typeof job==='object' &&
    /^print-v1__site_[a-f0-9]{40}__(kitchen|full)$/.test(job.id||'') &&
    /^[a-f0-9]{64}$/.test(job.claimToken||'') &&
    ['kitchen','full'].includes(job.kind) && ['58','80'].includes(job.paperMm) &&
    job.id.endsWith(`__${job.kind}`) &&
    typeof job.html==='string' && job.html.length>100 && job.html.length<100000 &&
    job.html.includes('<!doctype html>') && job.html.includes('DA FAMÍLIA LANCHES');
}
module.exports={canArm,serverUrl,validJob};
