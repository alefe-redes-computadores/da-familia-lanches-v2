/** R23 — aceite comercial no backend, transação Firestore idempotente. */
import { after, NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth } from '@/lib/integration/server/adminAuth';
import { adminDb } from '@/lib/integration/server/admin';
import { isAdminEmail } from '@/lib/adminAuthorization';
import { acceptanceStatus, acceptedOrderCanNotify, AUTO_ACCEPT_COLLECTION } from '@/lib/tracking/automaticAcceptancePolicy';
import { drainAutoAcceptances, autoAcceptanceEnabled } from '@/lib/tracking/automaticAcceptance';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={ 'cache-control':'private, no-store, max-age=0', 'x-content-type-options':'nosniff' };
const json=(v:unknown,status=200)=>NextResponse.json(v,{status,headers});

export async function POST(req:NextRequest) {
  const bearer=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
  if (!bearer) return json({ok:false,error:'UNAUTHORIZED'},401);
  let uid='';
  try {
    const claims=await adminAuth.verifyIdToken(bearer);
    if (!claims.email || !isAdminEmail(claims.email)) return json({ok:false,error:'UNAUTHORIZED'},401);
    uid=claims.uid;
  } catch {return json({ok:false,error:'UNAUTHORIZED'},401);}
  const body:unknown=await req.json().catch(()=>null);
  if (!body||typeof body!=='object'||Array.isArray(body) || Object.keys(body).length!==1) return json({ok:false,error:'INVALID_REQUEST'},400);
  const orderId=(body as Record<string,unknown>).orderId;
  if (typeof orderId!=='string'|| !/^[A-Za-z0-9_-]{8,80}$/.test(orderId)) return json({ok:false,error:'INVALID_ORDER_ID'},400);
  try {
    const ref=adminDb.collection('Pedidos').doc(orderId);
    const intentRef=adminDb.collection(AUTO_ACCEPT_COLLECTION).doc(orderId);
    const result=await adminDb.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists)return{state:'not_found' as const};
      const order=snap.data()||{};
      const current=acceptanceStatus(order.status);
      if (!current)return{state:'conflict' as const};
      if(typeof order.acceptedAt==='string' && Number.isFinite(Date.parse(order.acceptedAt)))
        return{state:'existing' as const,status:current};
      const now=Timestamp.now();
      const acceptedAt=now.toDate().toISOString();
      // Firestore exige TODAS as leituras antes de qualquer escrita.
      const eligible=acceptedOrderCanNotify(order,acceptedAt);
      const existingIntent=eligible ? await tx.get(intentRef) : null;
      tx.update(ref,{acceptedAt,acceptedBy:uid,acceptedStageAt:now});
      if (eligible && existingIntent && !existingIntent.exists) {
        tx.create(intentRef,{
          order_id:orderId,event_id:`site-R21-accepted-${orderId}`,
          accepted_at:acceptedAt,state:'pending',attempts:0,
          created_at:acceptedAt,updated_at:acceptedAt,
          // Token, telefone e segredos nunca entram na fila.
        });
      }
      return{state:'changed' as const,status:current};
    });
    if (result.state==='not_found')return json({ok:false,error:'ORDER_NOT_FOUND'},404);
    if (result.state==='conflict')return json({ok:false,error:'ORDER_STATUS_CONFLICT'},409);
    if(result.state==='changed' && autoAcceptanceEnabled()) {
      after(async()=>{await drainAutoAcceptances(1).catch(()=>undefined);});
    }
    return json({ok:true,changed:result.state==='changed',status:result.status,rewardAwarded:false});
  } catch {return json({ok:false,error:'ACCEPTANCE_UNAVAILABLE'},503);}
}
