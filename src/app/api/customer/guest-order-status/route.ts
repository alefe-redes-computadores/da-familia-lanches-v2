import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/integration/server/admin";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const headers={"Cache-Control":"no-store, private", "X-Content-Type-Options":"nosniff"};
const deny=()=>NextResponse.json({ok:false,error:"TRACKING_NOT_FOUND"},{status:404,headers});
const clean=(v:unknown,max:number)=>typeof v==="string"?v.trim().slice(0,max):"";
function safeEqual(a:string,b:string){
 const left=createHash("sha256").update(a).digest();
 const right=createHash("sha256").update(b).digest();
 return timingSafeEqual(left,right);
}
/** Um pedido de convidado só pode ser consultado com a chave aleatória da compra.
 * O ID público e telefone nunca funcionam como credenciais.
 * Retorna SOMENTE estado; sem endereço, telefone, nome, itens ou perfil.
 */
export async function POST(request:NextRequest){
 try{
  const raw=await request.text();
  if(!raw||raw.length>500)return deny();
  const body=JSON.parse(raw) as Record<string,unknown>;
  const orderId=clean(body.orderId,70),key=clean(body.trackingKey,90);
  if(!/^site_[a-f0-9]{40}$/.test(orderId)|| !/^[A-Za-z0-9_-]{16,80}$/.test(key))return deny();
  // A identificação guest é derivada criptograficamente da chave de idempotência.
  // Prove a correspondência ANTES da leitura Firestore: pares falsos custam zero reads.
  const actorId=`guest_${createHash("sha256").update(key).digest("hex").slice(0,24)}`;
  const expectedId=`site_${createHash("sha256").update(actorId+":"+key).digest("hex").slice(0,40)}`;
  if(!safeEqual(orderId,expectedId))return deny();
  const snap=await adminDb.collection("Pedidos").doc(orderId).get();
  if(!snap.exists)return deny();
  const order=snap.data()||{};
  if(order.customerMode!=="guest"||order.checkoutChannel!=="site"||typeof order.clientRequestId!=="string"||!safeEqual(order.clientRequestId,key))return deny();
  const status=clean(order.status,70)||"Pendente";
  return NextResponse.json({ok:true,status,
   ...(status==="Cancelado"?{cancelPublicMessage:clean(order.cancelPublicMessage,300)}:{}),
   ...(typeof order.deliveryTrackingEvent==="string"?{deliveryTrackingEvent:clean(order.deliveryTrackingEvent,80)}:{}),
  },{status:200,headers});
 }catch(error){
  // Falhas de banco são transitórias; nunca expor detalhes internos ou identidade.
  if(error instanceof SyntaxError)return deny();
  console.error("[guest-status] indisponível",error instanceof Error?error.name:"UNKNOWN");
  return NextResponse.json({ok:false,error:"TRACKING_UNAVAILABLE"},{status:503,headers});
 }
}
