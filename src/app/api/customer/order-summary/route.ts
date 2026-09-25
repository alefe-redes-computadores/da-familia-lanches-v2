import { NextRequest,NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminApp,adminDb } from "@/lib/integration/server/admin";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 try{
  const bearer=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"").trim()||"";
  if(!bearer)return NextResponse.json({ok:false,error:"AUTH_REQUIRED"},{status:401});
  const decoded=await getAuth(adminApp).verifyIdToken(bearer,true);
  const ref=adminDb.doc(`Usuarios/${decoded.uid}/Loyalty/state`),current=await ref.get(),data=current.data()??{};
  if(data.initialized===true&&Number(data.version)>=2)return NextResponse.json({ok:true,cached:true});
  const orders=adminDb.collection("Pedidos").where("userId","==",decoded.uid);
  const[total,completed,cancelled]=await Promise.all([
   orders.count().get(),
   orders.where("status","==","Finalizado").count().get(),
   orders.where("status","==","Cancelado").count().get(),
  ]);
  await ref.set({version:2,initialized:true,totalOrders:total.data().count,completedOrders:completed.data().count,cancelledOrders:cancelled.data().count,backfilledAt:FieldValue.serverTimestamp(),updatedAt:FieldValue.serverTimestamp()},{merge:true});
  return NextResponse.json({ok:true,cached:false});
 }catch(error){console.error("[customer/order-summary]",error);return NextResponse.json({ok:false,error:"SUMMARY_FAILED"},{status:500})}
}
