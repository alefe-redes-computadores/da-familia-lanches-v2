"use strict";
/** Verificacao publica opcional, SOMENTE GET de HTML. Nao cria pedidos. */
const https=require("node:https");
const endpoints=[
 {name:"Site principal",url:"https://dafamilialanches.com.br/",expect:"storefront"},
 {name:"Painel (acesso protegido permitido)",url:"https://admin.dafamilialanches.com.br/",expect:"admin"},
];
const maxBytes=4096;
function probe(item){return new Promise(resolve=>{
 const req=https.get(item.url,{headers:{"user-agent":"DFL-Site-R42-ReadOnly-Check/1.0","accept":"text/html"},timeout:8000},res=>{
  let bytes=0;res.on("data",chunk=>{bytes+=chunk.length;if(bytes>=maxBytes)res.destroy();});
  res.on("close",()=>resolve({name:item.name,url:item.url,status:res.statusCode||0,location:res.headers.location||null}));
  res.on("end",()=>resolve({name:item.name,url:item.url,status:res.statusCode||0,location:res.headers.location||null}));
 });
 req.on("timeout",()=>req.destroy(new Error("tempo esgotado")));
 req.on("error",error=>resolve({name:item.name,url:item.url,status:0,error:error.message}));
});}
(async()=>{
 for(const item of endpoints){const result=await probe(item);const safe=item.expect==="admin"?[200,301,302,307,308,401,403].includes(result.status):[200,301,302,307,308].includes(result.status);
 console.log(`${safe?"ALCANCAVEL":"VERIFICAR"}: ${result.name} | HTTP ${result.status}${result.error?" | "+result.error:""}`);
 }
 console.log("R42: consulta publica somente de leitura. Este teste NÃO comprova que compras ou Entregas funcionem.");
})().catch(e=>{console.error("R42: falha inesperada",e);process.exitCode=1});
