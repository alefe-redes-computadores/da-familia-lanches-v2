/** R27 — bounded, fenced, NEVER-retry-uncertain initial tracking handoffs.
 * Jobs are created atomically by R23 acceptance only when every R27 gate is ON.
 */
import 'server-only';
import {randomUUID} from 'node:crypto';
import {adminDb} from '@/lib/integration/server/admin';
import {r25SendInitialOnce} from './automaticInitialHandoff';
import {r27SendToProvider} from './r27ProviderTransport';
import {R27_COLLECTION,r27DispatchConfigured} from './r27ProviderPolicy';
import {r41TrackingPilotRecipient} from './r41PilotRecipient';

const value=(x:unknown)=>typeof x==='string'?x.trim():'';
export type R27Run={enabled:boolean;claimed:number;accepted:number;review:number;suppressed:number};
export async function drainR27AutomaticDelivery(limit=1):Promise<R27Run> {
  const result:R27Run={enabled:r27DispatchConfigured(process.env),claimed:0,accepted:0,review:0,suppressed:0};
  if(!result.enabled)return result;
  // Pending-only queue. No recovery of an abandoned processing job: it may
  // have issued a token or contacted the provider before the worker died.
  const size=Math.max(1,Math.min(3,Math.trunc(limit)||1));
  const snap=await adminDb.collection(R27_COLLECTION).where('state','==','pending').limit(size).get();
  for(const doc of snap.docs){
    if(!r27DispatchConfigured(process.env))break;
    const lease=randomUUID();
    const now=new Date().toISOString();
    const orderId=await adminDb.runTransaction(async tx=>{
      const fresh=await tx.get(doc.ref);
      const d=(fresh.data()||{}) as Record<string,unknown>;
      if(!fresh.exists||value(d.state)!=='pending')return null;
      if(!value(d.order_id)||doc.id!==value(d.order_id))return null;
      tx.update(doc.ref,{state:'processing',locked_by:lease,locked_at:now,
        updated_at:now,attempts:1});
      return value(d.order_id);
    });
    if(!orderId)continue;
    result.claimed++;
    let final:'provider_accepted'|'review_required'|'suppressed'='review_required';
    let reason='UNKNOWN_AFTER_CLAIM';
    try{
      // R41: ultimo bloqueio antes de emitir token ou contactar o provedor.
      const orderSnap=await adminDb.collection('Pedidos').doc(orderId).get();
      const snapshot=(orderSnap.data()||{}) as Record<string,unknown>;
      const customer=(snapshot.customerSnapshot||{}) as Record<string,unknown>;
      if(!orderSnap.exists || !r41TrackingPilotRecipient(process.env,customer.phoneE164)){
        final='suppressed';reason='R41_PILOT_ONLY';
      } else {
        const state=await r25SendInitialOnce(orderId,r27SendToProvider);
        if(state==='provider_accepted'){final='provider_accepted';reason='PROVIDER_API_ACK';}
        else if(state==='ineligible'){final='suppressed';reason='ORDER_NO_LONGER_ELIGIBLE';}
        else {reason=state==='already_reserved'?'PREVIOUS_RESERVATION':
          state==='off'?'GATE_CHANGED_AFTER_CLAIM':'HUMAN_REVIEW_REQUIRED';}
      }
    }catch{reason='UNEXPECTED_UNCERTAIN_FAILURE';}
    // Settlement must be fenced; stale workers cannot overwrite newer review.
    const settled=await adminDb.runTransaction(async tx=>{
      const fresh=await tx.get(doc.ref);
      const d=(fresh.data()||{}) as Record<string,unknown>;
      if(!fresh.exists||value(d.state)!=='processing'||value(d.locked_by)!==lease)return false;
      tx.update(doc.ref,{state:final,reason,updated_at:new Date().toISOString(),
        locked_by:null,locked_at:null});
      return true;
    });
    if(!settled){result.review++;continue;}
    if(final==='provider_accepted')result.accepted++;
    else if(final==='suppressed')result.suppressed++;
    else result.review++;
  }
  return result;
}
