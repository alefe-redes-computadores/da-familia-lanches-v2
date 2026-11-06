const fs=require('fs'),assert=require('assert');
const path='src/app/api/integration/manual-messaging/route.ts',s=fs.readFileSync(path,'utf8');
const checks=[
['flag OFF',/DFL_MANUAL_MESSAGING_ENABLED[^\n]*'true'/],
['assinatura obrigatoria',/assertSignedIntegrationRequest\(/],
['limitacao do evento',/const EVENTS=new Set\(\['order\.created','delivery\.started','delivery\.completed'\]\)/],
['origem manual',/data\.source!=='manual'/],
['namespace do pedido',/\^entregas:dfl-/],
['token apenas no servidor',/process\.env\.DFL_MESSAGING_INGEST_TOKEN/],
['sem prometer envio',/deliveryVerified:false/],
['sem telefone no retorno',/return response\(\{ok:true,queued:/],
['POST ingest',/await postJson\(ingest,token/],
['dedupe pelo provedor',/duplicate:result\.body\.duplicate===true/],
];for(const [name,re] of checks){assert(re.test(s),name+' nao encontrado');}
console.log(`MSG-M1 Site — ${checks.length} contratos estaticos de mensageria aprovados, sem rede.`);
