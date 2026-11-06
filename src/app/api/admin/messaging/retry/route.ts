import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/integration/server/adminAuth';
import { adminDb } from '@/lib/integration/server/admin';
import { isAdminEmail } from '@/lib/adminAuthorization';
import { drainMessagingIntentFastLane } from '@/lib/integration/server/messagingFastLane';
import { evaluateManualRetry, manualRetryCount } from '@/lib/messaging/retryPolicy';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const HEADERS={'Cache-Control':'private, no-store, max-age=0'};
const result=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:HEADERS});
const MAX_LENGTH=240;
const denied=(error:string,status=409)=>result({ok:false,error},status);
function enabled(uid:string){
  const owner=process.env.DFL_MESSAGING_RETRY_OWNER_UID?.trim();
  return Boolean(owner && uid===owner && process.env.DFL_MESSAGING_MANUAL_RETRY_ENABLED==='true');
}
const statusOf=(s:unknown)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

export async function POST(req:NextRequest){
  const bearer=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
  if(!bearer)return denied('AUTH_REQUIRED',401);
  let uid='';
  try {
    const user=await adminAuth.verifyIdToken(bearer,true);
    if(!isAdminEmail(user.email))return denied('FORBIDDEN',403);
    uid=user.uid;
  } catch {return denied('AUTH_REQUIRED',401);}
  // OFF is intentional even for valid admins. A separate owner UID and server
  // activation are required; this route never enables any messaging service.
  if(!enabled(uid))return denied('MANUAL_RETRY_OFF',403);
  if(!process.env.DFL_MESSAGING_INGEST_URL?.trim()||!process.env.DFL_MESSAGING_INGEST_TOKEN?.trim())
    return denied('INGEST_NOT_CONFIGURED',503);
  let id='';
  try {
    const body=await req.text();
    if(body.length>MAX_LENGTH)return denied('BODY_TOO_LARGE',413);
    const raw:unknown=JSON.parse(body);
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return denied('INVALID_REQUEST',400);
    const obj=raw as Record<string,unknown>;
    if(obj.action!=='retry'||typeof obj.id!=='string')return denied('INVALID_REQUEST',400);
    id=obj.id.trim();
  } catch {return denied('INVALID_JSON',400);}
  if(id.length<8||id.length>200||!/^[A-Za-z0-9_.%:-]+$/.test(id)||id.includes('..'))
    return denied('INVALID_INTENT_ID',400);

  const intentRef=adminDb.collection('integration_notification_intents').doc(id);
  const now=new Date().toISOString();
  type Decision={accepted:boolean;code:string;remaining:number};
  let decision:Decision;
  try {
    decision=await adminDb.runTransaction(async tx=>{
      const snap=await tx.get(intentRef);
      if(!snap.exists)return {accepted:false,code:'INTENT_NOT_FOUND',remaining:0};
      const data=snap.data() as Record<string,unknown>;
      const assessed=evaluateManualRetry({status:data.status,error:data.last_error,manualRetryCount:data.manual_retry_count,
        manualRetryAt:data.manual_retry_at,createdAt:data.created_at});
      if(!assessed.retryable||data.messaging_eligible===true)
        return {accepted:false,code:assessed.reason==='allowed'?'IN_PROGRESS':assessed.reason.toUpperCase(),remaining:assessed.remaining};
      const orderId=typeof data.order_id==='string'?data.order_id.trim():'';
      const event=String(data.messaging_event_type||data.intent_type||'');
      if(!orderId||orderId.length>160||orderId.includes('/')||event==='delivery_position_changed'||event==='delivery.assigned')
        return {accepted:false,code:'INVALID_PROJECTION',remaining:assessed.remaining};
      // Read the commercial authority in the same transaction. Never revive an
      // obsolete stage or a cancellation in the wrong business state.
      const orderSnap=await tx.get(adminDb.collection('Pedidos').doc(orderId));
      if(!orderSnap.exists)return {accepted:false,code:'ORDER_NOT_FOUND',remaining:assessed.remaining};
      const order=orderSnap.data() as Record<string,unknown>;
      const state=statusOf(order.status);
      if(state.includes('cancel') && !event.includes('cancel'))
        return {accepted:false,code:'ORDER_CANCELLED',remaining:assessed.remaining};
      if((state.includes('final')||state.includes('conclu')) &&
         !event.includes('completed')&&!event.includes('cancel'))
        return {accepted:false,code:'OBSOLETE_STAGE',remaining:assessed.remaining};
      if(event.includes('cancel')&&!state.includes('cancel'))
        return {accepted:false,code:'STATUS_CHANGED',remaining:assessed.remaining};
      const oldCount=manualRetryCount(data.manual_retry_count);
      tx.update(intentRef,{
        status:'pending',messaging_eligible:true,attempts:5, // exactly ONE worker attempt per manual retry
        locked_by:null,locked_at:null,updated_at:now,last_error:null,
        manual_retry_count:oldCount+1,manual_retry_at:now,manual_retry_by:uid,
        manual_retry_previous_category:assessed.category,
      });
      return {accepted:true,code:'QUEUED_FOR_SINGLE_ATTEMPT',remaining:Math.max(0,1-oldCount)};
    });
  } catch {
    return denied('RETRY_TRANSACTION_UNAVAILABLE',503);
  }
  if(!decision.accepted)return result({ok:false,error:decision.code,remaining:decision.remaining},409);
  // The retry is already committed before any network operation; a network
  // failure never refunds a retry or triggers a second click automatically.
  try {
    const delivery=await drainMessagingIntentFastLane(id);
    return result({ok:true,status:'retry_recorded',remaining:decision.remaining,
      queuedInSupabase:delivery.queued===true,providerDelivered:false,
      note:'Retry controlado. Confirme o resultado na fila; aceite não significa entrega.'});
  } catch {
    return result({ok:true,status:'retry_recorded',remaining:decision.remaining,
      queuedInSupabase:false,providerDelivered:false,
      note:'Tentativa registrada. A fila permanece sob controle do servidor; não toque novamente.'});
  }
}
export async function GET(){return result({ok:false,error:'METHOD_NOT_ALLOWED'},405);}
