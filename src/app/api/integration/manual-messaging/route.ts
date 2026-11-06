import { NextRequest, NextResponse } from 'next/server';
import { assertSignedIntegrationRequest } from '@/lib/integration/server/signature';

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
  if(data.source!=='manual'||!EVENTS.has(eventType)||!/^entregas:dfl-[A-Za-z0-9-]{12,120}$/.test(orderId)||eventId!==`manual-msg-v1__${eventType}__${orderId.slice('entregas:'.length)}`){return response({ok:false,error:'invalid_manual_envelope'},422);}
  try{assertSignedIntegrationRequest({body:raw,timestamp:req.headers.get('x-dfl-timestamp'),signature:req.headers.get('x-dfl-signature'),eventId:req.headers.get('x-dfl-event-id'),expectedEventId:eventId});}
  catch{return response({ok:false,error:'invalid_signature'},401);}
  const phone=String(data.customer_phone||'').trim(),name=String(data.customer_name||'').trim();
  if(!/^55[1-9]\d{9,10}$/.test(phone)||name.length>80||!/^[A-Za-z0-9_-]+$/.test(orderId.slice('entregas:'.length))){return response({ok:false,error:'invalid_contact_fields'},422);}
  const content=data.payload;
  if(!content||typeof content!=='object'||Array.isArray(content))return response({ok:false,error:'invalid_payload'},422);
  const obj=content as Record<string,unknown>;
  if(obj.delivery_id!==orderId.slice('entregas:'.length)||obj.fulfillment_mode!=='delivery')return response({ok:false,error:'invalid_payload_identity'},422);
  const ingest=safeEndpoint(process.env.DFL_MESSAGING_INGEST_URL||''),token=process.env.DFL_MESSAGING_INGEST_TOKEN?.trim();
  if(!ingest||!token)return response({ok:false,error:'messaging_not_configured'},503);
  try{
    const result=await postJson(ingest,token,'x-dfl-messaging-token',{source:'manual',source_event_id:eventId,event_type:eventType,order_id:orderId,customer_phone:phone,customer_name:name,payload:obj});
    if(!result.ok||result.body.ok!==true)return response({ok:false,error:'ingest_rejected',code:result.code},503);
    const worker=safeEndpoint(process.env.DFL_MESSAGING_WORKER_URL||''),workerToken=process.env.DFL_MESSAGING_WORKER_TOKEN?.trim();
    if(worker&&workerToken&&result.body.duplicate!==true){
      try{await postJson(worker,workerToken,'x-dfl-messaging-worker-token',{},1300);}catch{/* Fila persistida; cron/worker pode processar depois. */}
    }
    return response({ok:true,queued:result.body.queued===true,duplicate:result.body.duplicate===true,deliveryVerified:false});
  }catch{return response({ok:false,error:'messaging_ingest_unavailable'},503);}
}
