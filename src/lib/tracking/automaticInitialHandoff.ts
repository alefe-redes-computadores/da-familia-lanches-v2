/** R25 — reserved-once Site -> Entregas P9 grant -> ephemeral provider handoff.
 * STAGED BY DESIGN: no route, cron or caller is installed in R25. OFF by default.
 * The R26 provider adapter must call this function from a trusted server only.
 */
import 'server-only';
import {createHash} from 'node:crypto';
import {adminDb} from '@/lib/integration/server/admin';
import {callEntregas} from '@/lib/tracking/server';
import {AUTO_ACCEPT_COLLECTION} from './automaticAcceptancePolicy';
import {
  R25_COLLECTION,R25_ISSUE_PATH,R25_RECEIPT_PATH,r25Eligible,r25EphemeralLink,
  r25IssueBody,r25ReceiptBody,r25ValidIssueReply,r25ValidOrderId,r25ValidReceipt,
  type R25ProviderReceipt,
} from './automaticInitialPolicy';

type Raw=Record<string,unknown>;
const text=(v:unknown)=>typeof v==='string'?v.trim():'';
const obj=(v:unknown):Raw=>v&&typeof v==='object'&&!Array.isArray(v)?v as Raw:{};
const key=(kind:string,id:string,at:string)=>createHash('sha256').update(`r25|${kind}|${id}|${at}`,'utf8').digest('hex');

/** THREE separate OFF switches. Never infer certification from manual messaging permissions. */
export function r25HandoffEnabled():boolean {
  return process.env.DFL_SITE_TRACKING_ENABLED==='1' &&
    process.env.DFL_SITE_TRACKING_AUTO_ACCEPT_ENABLED==='1' &&
    process.env.DFL_SITE_TRACKING_AUTO_ISSUE_ENABLED==='1' &&
    process.env.DFL_SITE_TRACKING_AUTO_PROVIDER_CERTIFIED==='1';
}

export type R25ProviderHandoff=(input:{
  /** Single-use URL. Never persist or place it in a durable provider/outbox queue. */
  url:string;recipient_e164:string;order_id:string;expires_at:string;
})=>Promise<R25ProviderReceipt>;
export type R25Outcome='off'|'ineligible'|'already_reserved'|'review_required'|'provider_accepted';

/** Invocation is intentionally not connected to any public, admin, or cron endpoint.
 * Once the provider transport is certified, R26 may wire this callback server-side.
 * Unknown outcomes MUST NOT be retried automatically: one initial grant per order.
 */
export async function r25SendInitialOnce(orderId:string,provider:R25ProviderHandoff):Promise<R25Outcome> {
  if(!r25HandoffEnabled())return 'off';
  if(!r25ValidOrderId(orderId)||typeof provider!=='function')return 'ineligible';
  const ref=adminDb.collection(R25_COLLECTION).doc(orderId);
  const orderRef=adminDb.collection('Pedidos').doc(orderId);
  const acceptanceRef=adminDb.collection(AUTO_ACCEPT_COLLECTION).doc(orderId);
  const now=new Date().toISOString();
  // Reserve BEFORE contacting Entregas. No stale-lock rescue; human review only.
  let reserved:{acceptedAt:string;phone:string}|null=null;
  try {
    reserved=await adminDb.runTransaction(async tx=>{
      const [reservation,orderSnap,acceptanceSnap]=await Promise.all([
        tx.get(ref),tx.get(orderRef),tx.get(acceptanceRef),
      ]);
      if(reservation.exists || !orderSnap.exists || !acceptanceSnap.exists)return null;
      const order=obj(orderSnap.data());
      const acceptance=obj(acceptanceSnap.data());
      if(!r25Eligible(order,acceptance))return null;
      const acceptedAt=text(order.acceptedAt);
      const phone=text(obj(order.customerSnapshot).phoneE164);
      tx.create(ref,{order_id:orderId,acceptance_event_id:`site-R21-accepted-${orderId}`,
        accepted_at:acceptedAt,state:'reserved',created_at:now,updated_at:now,
        // No phone, URL, token or provider identifier in this durable record.
      });
      return {acceptedAt,phone};
    });
  }catch{return 'review_required';}
  if(!reserved){
    // Explicitly distinguish a past attempt from an ineligible order (no token access).
    try {return (await ref.get()).exists?'already_reserved':'ineligible';}
    catch{return 'review_required';}
  }
  const acceptedAt=reserved.acceptedAt;
  const quarantine=async(reason:string,grantId?:string)=>{
    try {await ref.update({state:'review_required',reason,updated_at:new Date().toISOString(),
      ...(grantId?{grant_id:grantId}:{})});}catch{/* Never retry grant/provider after unknown persistence. */}
    return 'review_required' as const;
  };
  try {
    await ref.update({state:'issuing',updated_at:new Date().toISOString()});
    const issued=await callEntregas(R25_ISSUE_PATH,r25IssueBody(orderId,reserved.phone,key('issue',orderId,acceptedAt)));
    if(!issued.ok||issued.status!==201||!r25ValidIssueReply(issued.data))return quarantine('issue_uncertain_or_rejected');
    const {grant_id:grantId,opaque_token:token,expires_at:expiresAt}=issued.data;
    // Persist only the non-secret grant ID; token remains in the current call stack.
    try {await ref.update({state:'issued_pending_provider',grant_id:grantId,updated_at:new Date().toISOString()});}
    catch{return quarantine('issued_persistence_uncertain',grantId);}
    // Recheck the commercial authority immediately before external provider handoff.
    const [freshOrder,freshAccept]=await Promise.all([orderRef.get(),acceptanceRef.get()]);
    if(!freshOrder.exists||!freshAccept.exists||
       !r25Eligible(obj(freshOrder.data()),obj(freshAccept.data()))||
       text(obj(obj(freshOrder.data()).customerSnapshot).phoneE164)!==reserved.phone) {
      return quarantine('changed_before_provider_handoff',grantId);
    }
    // The callback must synchronously hand off to an authorized provider API;
    // no Supabase outbox, Firestore or logs may receive the URL/token.
    let receipt:R25ProviderReceipt;
    try {
      receipt=await provider({url:r25EphemeralLink(token),recipient_e164:reserved.phone,
        order_id:orderId,expires_at:expiresAt});
    }catch{return quarantine('provider_transport_uncertain',grantId);}
    if(!r25ValidReceipt(receipt))return quarantine('provider_receipt_uncertain',grantId);
    const ack=await callEntregas(R25_RECEIPT_PATH,
      r25ReceiptBody(orderId,grantId,key('receipt',orderId,acceptedAt),receipt));
    const data=obj(ack.data);
    if(!ack.ok||data.ok!==true||
      !['recorded','already_recorded'].includes(text(data.code))||
      data.provider_state!==receipt.result||data.customer_delivery_confirmed!==false) {
      return quarantine('entregas_receipt_uncertain',grantId);
    }
    const state=receipt.result==='accepted_by_provider'?'provider_accepted':'review_required';
    await ref.update({state,grant_id:grantId,provider_result:receipt.result,
      updated_at:new Date().toISOString(),
      ...(state==='review_required'?{reason:'provider_not_confirmed'}:{})});
    // Accepted by API != delivered, received or read in WhatsApp.
    return state==='provider_accepted'?'provider_accepted':'review_required';
  }catch{return quarantine('handoff_uncertain');}
}
