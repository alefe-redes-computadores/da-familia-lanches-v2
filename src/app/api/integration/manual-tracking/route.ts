/** R70 — signed Entregas -> Site transient provider handoff.
 * This is not a generic WhatsApp relay. The only accepted source is an
 * authorized, opted-in, freshly created DFL manual delivery.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertSignedIntegrationRequest } from '@/lib/integration/server/signature';
import { r27SendToProvider } from '@/lib/tracking/r27ProviderTransport';
import { r27DispatchConfigured, r27ValidHandoffInput } from '@/lib/tracking/r27ProviderPolicy';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'cache-control':'no-store, max-age=0','referrer-policy':'no-referrer'}});
const keys=['contract','version','action','event_id','delivery_id','recipient_e164','tracking_link','expires_at','consent_granted'];
const shape=(input:unknown):input is Record<string,unknown>=>Boolean(input&&typeof input==='object'&&!Array.isArray(input));
export async function POST(req:NextRequest){
  if(!r27DispatchConfigured(process.env)||process.env.DFL_MANUAL_MESSAGING_ENABLED!=='true'||
    process.env.DFL_MANUAL_MESSAGING_SCOPE!=='consented_customers'||
    process.env.DFL_MANUAL_MESSAGING_ROLLOUT_APPROVED!=='true'||
    process.env.DFL_MANUAL_MESSAGING_KILL_SWITCH==='true')return reply({ok:false,code:'NOT_CERTIFIED'},403);
  let raw='';
  try{raw=await req.text();if(raw.length<100||raw.length>1400)return reply({ok:false,code:'INVALID_BODY'},422);}catch{return reply({ok:false,code:'INVALID_BODY'},422);}
  let input:unknown;
  try{input=JSON.parse(raw);}catch{return reply({ok:false,code:'INVALID_BODY'},422);}
  if(!shape(input)||Object.keys(input).length!==keys.length||!keys.every(k=>Object.prototype.hasOwnProperty.call(input,k)))
    return reply({ok:false,code:'INVALID_BODY'},422);
  const id=input.delivery_id,ev=input.event_id;
  if(input.contract!=='dfl.tracking.manual.handoff.v1'||input.version!==1||input.action!=='send_initial'||
    input.consent_granted!==true||typeof id!=='string'||!/^dfl-[A-Za-z0-9-]{12,75}$/.test(id)||
    typeof ev!=='string'||ev!==`manual-tracking-initial__${id}`||
    !r27ValidHandoffInput({order_id:id,recipient_e164:input.recipient_e164,url:input.tracking_link,expires_at:input.expires_at}))
    return reply({ok:false,code:'INVALID_HANDOFF'},422);
  try{assertSignedIntegrationRequest({body:raw,timestamp:req.headers.get('x-dfl-timestamp'),
    signature:req.headers.get('x-dfl-signature'),eventId:req.headers.get('x-dfl-event-id'),expectedEventId:ev});}
  catch{return reply({ok:false,code:'INVALID_SIGNATURE'},401);}
  try {
    const delivered=await r27SendToProvider({order_id:id,url:String(input.tracking_link),
      recipient_e164:String(input.recipient_e164),expires_at:String(input.expires_at)},'manual');
    return reply({contract:'dfl.tracking.manual.handoff.v1',version:1,ok:true,
      result:delivered.result,provider_event_id:delivered.provider_event_id,customer_delivery_confirmed:false});
  } catch {
    // A network timeout is forever uncertain. Never retry here.
    return reply({ok:false,code:'PROVIDER_OUTCOME_UNCERTAIN'},503);
  }
}
