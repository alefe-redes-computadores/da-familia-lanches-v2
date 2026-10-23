import fs from "node:fs";
import assert from "node:assert/strict";
const src=p=>fs.readFileSync(p,"utf8");
const checks=[
 ["API somente POST",src("src/app/api/customer/guest-order-status/route.ts").includes("export async function POST")&&!src("src/app/api/customer/guest-order-status/route.ts").includes("export async function GET")],
 ["prova aleatória obrigatória",src("src/app/api/customer/guest-order-status/route.ts").includes("safeEqual(order.clientRequestId,key)")],
 ["nenhuma leitura para chave falsa",src("src/app/api/customer/guest-order-status/route.ts").indexOf("if(!safeEqual(orderId,expectedId))")<src("src/app/api/customer/guest-order-status/route.ts").indexOf(".doc(orderId).get()")],
 ["autorização estrita convidado",src("src/app/api/customer/guest-order-status/route.ts").includes('order.customerMode!=="guest"')],
 ["ID válido sem consulta aberta",src("src/app/api/customer/guest-order-status/route.ts").includes("site_[a-f0-9]{40}")],
 ["sem cache",src("src/app/api/customer/guest-order-status/route.ts").includes("no-store, private")],
 ["resposta restrita",!src("src/app/api/customer/guest-order-status/route.ts").includes("phone:")&&!src("src/app/api/customer/guest-order-status/route.ts").includes("address:")],
 ["chave na memória local do convidado",src("src/components/ui/CheckoutModal.tsx").includes("trackingKey:orderAttemptRef.current")],
 ["nenhuma migração destrutiva",src("src/lib/guestContinuity.ts").includes("trackingKey?:string")&&src("src/lib/guestContinuity.ts").includes("updateGuestOrderStatus")],
 ["sem criação de pedido por sincronização",src("src/lib/guestContinuity.ts").includes("Boolean(x.trackingKey)")],
 ["consulta só modal aberto e visível",src("src/components/ui/OrdersModal.tsx").includes('document.visibilityState!=="visible"')],
 ["sem polling acelerado",src("src/components/ui/OrdersModal.tsx").includes("90000")],
 ["poucas consultas",src("src/components/ui/OrdersModal.tsx").includes("slice(0,3)")],
 ["sem vazamento de credencial na URL",src("src/components/ui/OrdersModal.tsx").includes('method:"POST"')],
 ["status legado rotulado",src("src/components/ui/OrdersModal.tsx").includes("Registro local antigo")],
 ["modais carregados sob demanda",src("src/components/layout/AppShell.tsx").includes("dynamic(() => import(\"@/components/ui/CheckoutModal\")")],
 ["admin diagnóstico sem Firebase",!src("src/components/admin/CatalogQualityPanel.tsx").includes("firebase/")],
 ["detecção de duplicidade",src("src/components/admin/CatalogQualityPanel.tsx").includes("Nome repetido na mesma categoria")],
 ["detecção de combos inválidos",src("src/components/admin/CatalogQualityPanel.tsx").includes("Combo vinculado a item inexistente")],
 ["admin com diagnóstico",src("src/components/admin/CatalogAdmin.tsx").includes("<CatalogQualityPanel products={products} categories={categories}")],
 ["V86 R1 intacta",src("src/lib/addressIntelligence.ts").includes("normalizeDistrict")],
 ["V86 R2 intacta",src("src/components/admin/CatalogAdmin.tsx").includes("editorActionsV86")],
 ["API do pedido continua autoridade",src("src/app/api/orders/route.ts").includes("buildOrderCreatedEvent")],
];
for(const [name,condition] of checks){assert.ok(condition,`V86 R3: ${name}`);console.log("✓",name)}
// Execução isolada da API com Firestore/Next simulados: verifica autorização e custo zero para chaves falsas.
import ts from "typescript";
import crypto from "node:crypto";
let reads=0;
let stored={customerMode:"guest",checkoutChannel:"site",clientRequestId:"",status:"Em Produção",userPhone:"(34) 99999-9999",endereco:"Rua confidencial"};
const adm={adminDb:{collection:()=>({doc:()=>({get:async()=>{reads++;return {exists:true,data:()=>stored}}})})}};
const response={NextResponse:{json:(body,opts={})=>({body,status:opts.status??200})}};
const generated=ts.transpileModule(src("src/app/api/customer/guest-order-status/route.ts"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const ex={};new Function("require","exports",generated)((name)=>name==="node:crypto"?crypto:name==="next/server"?response:name==="@/lib/integration/server/admin"?adm:(()=>{throw Error("unexpected import "+name)})(),ex);
const post=async(orderId,trackingKey)=>ex.POST({text:async()=>JSON.stringify({orderId,trackingKey})});
const k="guest-private-uuid-1234567890123456789";
const user=`guest_${crypto.createHash("sha256").update(k).digest("hex").slice(0,24)}`;
const id=`site_${crypto.createHash("sha256").update(user+":"+k).digest("hex").slice(0,40)}`;
stored={...stored,clientRequestId:k};
let result=await post(id,"invalid-secret-1234567890123456789");
assert.equal(result.status,404);assert.equal(reads,0,"chave falsa nunca deve consultar Firebase");
result=await post(id,k);assert.equal(result.status,200);assert.equal(result.body.status,"Em Produção");
assert.equal(reads,1);assert.ok(!("endereco" in result.body)&&!("userPhone" in result.body));
stored={...stored,customerMode:"google"};result=await post(id,k);assert.equal(result.status,404);
assert.equal(reads,2);console.log("✓ API guest isolada: negativa 0 reads, status válido, Google recusado, privacidade sem PII");
console.log(`V86 R3 — ${checks.length} contratos estáticos + API isolada OK`);
