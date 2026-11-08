/** R32 — on-demand admin-only order.ready event lineage; bounded and read-only. */
import {NextRequest,NextResponse} from 'next/server';
import {adminAuth} from '@/lib/integration/server/adminAuth';
import {adminDb} from '@/lib/integration/server/admin';
import {isAdminEmail} from '@/lib/adminAuthorization';
import {r11SiteMessageGate} from '@/lib/integration/server/messagingR11Policy';
import {R32_AUDIT_MAX_ROWS,r32RedactedIntent,r32RedactedOutbox,r32ReadyReason,r32ValidOrderId} from '@/lib/messaging/r32ReadyAuditPolicy';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store, max-age=0','Pragma':'no-cache','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers});
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
const text=(v:unknown)=>typeof v==='string'?v.trim():'';
export async function GET(req:NextRequest){
  const bearer=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
  if(!bearer)return reply({ok:false,code:'AUTH_REQUIRED'},401);
  try{
    const claims=await adminAuth.verifyIdToken(bearer,true);
    if(!claims.email||!isAdminEmail(claims.email))return reply({ok:false,code:'FORBIDDEN'},403);
  }catch{return reply({ok:false,code:'AUTH_REQUIRED'},401);}
  const orderId=req.nextUrl.searchParams.get('orderId')||'';
  if(!r32ValidOrderId(orderId))return reply({ok:false,code:'INVALID_ORDER_ID'},422);
  try{
    // Three directed reads, no collection scans, no writes and no Supabase access.
    const [orderSnap,outboxSnap,intentSnap]=await Promise.all([
      adminDb.collection('Pedidos').doc(orderId).get(),
      adminDb.collection('integration_outbox').where('entity_id','==',orderId).limit(R32_AUDIT_MAX_ROWS).get(),
      adminDb.collection('integration_notification_intents').where('order_id','==',orderId).limit(R32_AUDIT_MAX_ROWS).get(),
    ]);
    const order=orderSnap.exists?obj(orderSnap.data()):{};
    const status=text(order.status).slice(0,45),customer=obj(order.customerSnapshot);
    const phone=text(customer.phoneE164)||text(customer.phone)||text(order.userPhone);
    const gate=orderSnap.exists?r11SiteMessageGate({eventType:'order.ready',sourceEventType:'order.updated',phone,order,env:process.env}):null;
    const outbox=outboxSnap.docs.map(x=>obj(x.data())).filter(x=>x.event_type==='order.updated'&&
      text(obj(x.payload).status).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()==='pronto')
      .map(r32RedactedOutbox).slice(0,12);
    const intents=intentSnap.docs.map(x=>obj(x.data())).filter(x=>x.messaging_event_type==='order.ready')
      .map(r32RedactedIntent).slice(0,12);
    const reason=r32ReadyReason({orderExists:orderSnap.exists,status,outboxCount:outbox.length,intents,gate});
    return reply({ok:true,checkedAt:new Date().toISOString(),orderId,orderExists:orderSnap.exists,
      commercialStatus:status||null,fulfillment:order.tipoEntrega==='pickup'?'pickup':'delivery',
      consentGranted:order.whatsappNotificationsConsent===true,
      consentTimestampPresent:Number.isFinite(Date.parse(text(order.whatsappNotificationsConsentAt))),
      phonePresent:Boolean(phone),gateReason:gate,
      readyOutbox:outbox,readyIntents:intents,reason,
      sampleLimited:outboxSnap.size===R32_AUDIT_MAX_ROWS||intentSnap.size===R32_AUDIT_MAX_ROWS,
      providerDeliveryVerified:false,
      note:'Diagnóstico Firestore: queued não é entregue. Para provar envio da Evolution, correlacione o evento no Supabase. Sem alterações no pedido.'});
  }catch{return reply({ok:false,code:'AUDIT_UNAVAILABLE'},503);}
}
