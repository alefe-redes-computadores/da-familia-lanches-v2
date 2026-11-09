import { NextRequest, NextResponse } from 'next/server';
import { assertSignedIntegrationRequest } from '@/lib/integration/server/signature';


// R8: autorização restrita. Nunca aceita uma flag generica como liberação ampla.
function r8ApprovedNumbers(): Set<string> | null {
  const raw = process.env.DFL_MANUAL_MESSAGING_APPROVED_PHONES_E164 || '';
  const numbers = raw.split(',').map(v => v.trim()).filter(Boolean);
  if (!numbers.length || numbers.length > 12 || new Set(numbers).size !== numbers.length ||
      numbers.some(v => !/^55[1-9]\d{9,10}$/.test(v))) return null;
  return new Set(numbers);
}
function r8Authorized(phone: string, payload: Record<string,unknown>): boolean {
  if (process.env.DFL_MANUAL_MESSAGING_KILL_SWITCH === 'true') return false;
  const scope=process.env.DFL_MANUAL_MESSAGING_SCOPE?.trim();
  if (scope === 'canary') {
    const pilot=process.env.DFL_MESSAGING_PILOT_PHONE_E164?.trim();
    return Boolean(pilot && /^55[1-9]\d{9,10}$/.test(pilot) && phone === pilot);
  }
  // R19: compartilhamos com o Entregas o escopo consented_customers.
  // Assinatura HMAC e opt-in individual continuam obrigatorios.
  if (scope === 'consented_customers') {
    return process.env.DFL_MANUAL_MESSAGING_ROLLOUT_APPROVED === 'true' &&
      payload.manual_messaging_opt_in_v1 === true &&
      /^55[1-9]\d{9,10}$/.test(phone);
  }
  if (scope !== 'authorized_clients' ||
      process.env.DFL_MANUAL_MESSAGING_ROLLOUT_APPROVED !== 'true' ||
      payload.manual_messaging_opt_in_v1 !== true) return false;
  const allowed=r8ApprovedNumbers();
  return Boolean(allowed?.has(phone));
}

export const runtime='nodejs';
export const dynamic='force-dynamic';
const EVENTS=new Set(['order.created','delivery.started','delivery.completed']);
const RESPONSE_HEADERS={'cache-control':'private, no-store'};
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:RESPONSE_HEADERS});
const safeEndpoint=(value:string)=>{
  try { const url=new URL(value);return url.protocol==='https:' && /^[-a-z0-9]+\.supabase\.co$/.test(url.hostname) ? url.toString():null; }
  catch{return null;}
};
async function postJson(url:string, token:string,header:string,body:unknown, timeout=6000){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
  try{const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json',[header]:token},body:JSON.stringify(body),cache:'no-store',signal:controller.signal});return {ok:res.ok,code:res.status,body:await res.json().catch(()=>({})) as Record<string,unknown>};}
  finally{clearTimeout(timer);}
}
export async function POST(req:NextRequest){
  if(process.env.DFL_MANUAL_MESSAGING_ENABLED!=='true')return response({ok:false,error:'manual_messages_off'},403);
  let raw='';try{raw=await req.text();}catch{return response({ok:false,error:'invalid_body'},400);}
  if(raw.length<10||raw.length>4096)return response({ok:false,error:'body_length_invalid'},413);
  let data:Record<string,unknown>;
  try{const parsed:unknown=JSON.parse(raw);if(!parsed||Array.isArray(parsed)||typeof parsed!=='object')return response({ok:false,error:'invalid_json'},400);data=parsed as Record<string,unknown>;}catch{return response({ok:false,error:'invalid_json'},400);}
  const eventId=String(data.event_id||''), eventType=String(data.event_type||''),orderId=String(data.order_id||'');
  const r32NextStop=eventType==='delivery.next_stop';
  const legacyEnvelope=EVENTS.has(eventType)&&eventId===`manual-msg-v1__${eventType}__${orderId.slice('entregas:'.length)}`;
  // v2 identity must be tied to one prior physical stop completion, never to route start.
  const nextStopEnvelope=r32NextStop&&/^manual-msg-v2__delivery\.next_stop__dfl-[A-Za-z0-9-]{12,120}__[a-f0-9]{64}$/.test(eventId);
  // R33: manual pickup has its own v2 envelope; Site-origin pickup remains separate.
  const pickupEnvelope=(eventType==='order.created'||eventType==='order.ready')&&
    /^manual-msg-v2__order\.(?:created|ready)__dfl-[A-Za-z0-9-]{12,120}__[a-f0-9]{64}$/.test(eventId);
  if(data.source!=='manual'||!/^entregas:dfl-[A-Za-z0-9-]{12,120}$/.test(orderId)||!(legacyEnvelope||nextStopEnvelope||pickupEnvelope)){return response({ok:false,error:'invalid_manual_envelope'},422);}
  try{assertSignedIntegrationRequest({body:raw,timestamp:req.headers.get('x-dfl-timestamp'),signature:req.headers.get('x-dfl-signature'),eventId:req.headers.get('x-dfl-event-id'),expectedEventId:eventId});}
  catch{return response({ok:false,error:'invalid_signature'},401);}
  const phone=String(data.customer_phone||'').trim(),name=String(data.customer_name||'').trim();
  if(!/^55[1-9]\d{9,10}$/.test(phone)||name.length>80||!/^[A-Za-z0-9_-]+$/.test(orderId.slice('entregas:'.length))){return response({ok:false,error:'invalid_contact_fields'},422);}
  const content=data.payload;
  if(!content||typeof content!=='object'||Array.isArray(content))return response({ok:false,error:'invalid_payload'},422);
  const obj=content as Record<string,unknown>;
  // Dual server gate: signed event, opt-in and restrictive approved numbers.
  if(!r8Authorized(phone,obj))return response({ok:false,error:'manual_recipient_not_authorized'},403);
  if(obj.delivery_id!==orderId.slice('entregas:'.length)||obj.fulfillment_mode!==(pickupEnvelope?'pickup':'delivery'))return response({ok:false,error:'invalid_payload_identity'},422);
  // R32 manual next stop: additional independent canary + exact physical transition.
  // Deliberately loaded only for v2: legacy manual routes and tests remain unchanged.
  if(r32NextStop){
    const {r32ManualNextStopCanary,r32ValidManualNextStop}=await import('@/lib/messaging/r32ManualNextStopPolicy');
    if(!r32ValidManualNextStop(data))return response({ok:false,error:'invalid_manual_next_stop_v2'},422);
    if(!r32ManualNextStopCanary(process.env,phone))return response({ok:false,error:'manual_next_stop_off'},403);
  }
  if(pickupEnvelope){
    const {r33ManualPickupCanary,r33ValidManualPickup}=await import('@/lib/messaging/r33ManualPickupPolicy');
    if(!r33ValidManualPickup(data))return response({ok:false,error:'invalid_manual_pickup_v2'},422);
    if(!r33ManualPickupCanary(process.env,phone))return response({ok:false,error:'manual_pickup_off'},403);
  }
  const ingest=safeEndpoint(process.env.DFL_MESSAGING_INGEST_URL||''),token=process.env.DFL_MESSAGING_INGEST_TOKEN?.trim();
  if(!ingest||!token)return response({ok:false,error:'messaging_not_configured'},503);
  try{
    const result=await postJson(ingest,token,'x-dfl-messaging-token',{source:'manual',source_event_id:eventId,event_type:eventType,order_id:orderId,customer_phone:phone,customer_name:name,payload:obj});
    if(!result.ok||result.body.ok!==true)return response({ok:false,error:'ingest_rejected',code:result.code},503);
    // R15-R2: wake somente para uma nova entrada.
    const worker=safeEndpoint(process.env.DFL_MESSAGING_WORKER_URL||''),workerToken=process.env.DFL_MESSAGING_WORKER_TOKEN?.trim();
    let workerWake: 'not_applicable'|'not_configured'|'acknowledged'|'inactive'|'rejected'|'uncertain' = 'not_applicable';
    if(result.body.queued===true && result.body.duplicate!==true){
      if(!worker||!workerToken){
        workerWake='not_configured';
      }else{
        try{
          const wake=await postJson(worker,workerToken,'x-dfl-messaging-worker-token',{},4500);
          workerWake=!wake.ok||wake.body.ok!==true?'rejected':wake.body.active===true?'acknowledged':'inactive';
        }catch{
          workerWake='uncertain';
        }
      }
      if(workerWake!=='acknowledged'){
        console.warn('[integration/manual-messaging] wake nao confirmado; fila preservada',{workerWake,eventType});
      }
    }
    return response({ok:true,queued:result.body.queued===true,duplicate:result.body.duplicate===true,workerWake,deliveryVerified:false});
  }catch{return response({ok:false,error:'messaging_ingest_unavailable'},503);}
}
