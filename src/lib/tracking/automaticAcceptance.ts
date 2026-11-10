/** R23 — aceite Site -> Entregas P9; sem emissão de token, sem WhatsApp. */
import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { adminDb } from '@/lib/integration/server/admin';
import { callEntregas } from '@/lib/tracking/server';
import { acceptedOrderCanNotify, AUTO_ACCEPT_COLLECTION, AUTO_ACCEPT_PATH, terminalOrDifferentAcceptance } from './automaticAcceptancePolicy';
import { R27_COLLECTION, r27ShouldEnqueue } from './r27ProviderPolicy';
import { r41TrackingPilotRecipient } from './r41PilotRecipient';

type Raw = Record<string, unknown>;
const text = (v: unknown): string => typeof v === 'string' ? v.trim() : '';
const hash = (v: string) => createHash('sha256').update(v,'utf8').digest('hex');
const MAX_ATTEMPTS = 5;

export function autoAcceptanceEnabled(): boolean {
  return process.env.DFL_SITE_TRACKING_AUTO_ACCEPT_ENABLED === '1' &&
    process.env.DFL_SITE_TRACKING_ENABLED === '1';
}

export async function drainAutoAcceptances(limit=5) {
  const result = { enabled: autoAcceptanceEnabled(), claimed:0, acknowledged:0, deferred:0, blocked:0 };
  if (!result.enabled) return result;
  const snap = await adminDb.collection(AUTO_ACCEPT_COLLECTION)
    .where('state','in',['pending','processing']).limit(Math.min(10,Math.max(1,limit))).get();
  for (const doc of snap.docs) {
    const lock = randomUUID();
    const now = new Date().toISOString();
    const claim = await adminDb.runTransaction(async tx => {
      const fresh = await tx.get(doc.ref);
      if (!fresh.exists) return null;
      const d = fresh.data() as Raw;
      const state = text(d.state);
      if (state !== 'pending' && state !== 'processing') return null;
      const lastLock = Date.parse(text(d.locked_at));
      if (state === 'processing' && (!Number.isFinite(lastLock) || Date.now()-lastLock < 5*60_000)) return null;
      const retryAt = Date.parse(text(d.retry_at));
      if (state === 'pending' && Number.isFinite(retryAt) && retryAt>Date.now()) return null;
      const attempts = Number(d.attempts || 0);
      if (attempts >= MAX_ATTEMPTS) {
        tx.update(doc.ref,{state:'blocked',last_error_code:'MAX_ATTEMPTS',updated_at:now});
        return null;
      }
      tx.update(doc.ref,{state:'processing',locked_at:now,locked_by:lock,attempts:attempts+1,updated_at:now});
      return {orderId:text(d.order_id),acceptedAt:text(d.accepted_at),attempts:attempts+1};
    });
    if (!claim) continue;
    result.claimed++;
    let state:'acknowledged'|'pending'|'blocked'='pending';
    let code='REMOTE_RETRY';
    try {
      const orderSnap=await adminDb.collection('Pedidos').doc(claim.orderId).get();
      const order=(orderSnap.data()||{}) as Raw;
      if (!orderSnap.exists || terminalOrDifferentAcceptance(order,claim.acceptedAt) ||
          !acceptedOrderCanNotify(order,claim.acceptedAt) || Date.now()-Date.parse(claim.acceptedAt)>24*3600_000 ||
          !r41TrackingPilotRecipient(process.env, (order.customerSnapshot as Raw | undefined)?.phoneE164)) {
        state='blocked'; code='NOT_ELIGIBLE';
      } else {
        const customer=order.customerSnapshot as Record<string,unknown>;
        const eventId=`site-R21-accepted-${claim.orderId}`;
        const payload={
          contract:'dfl.tracking.automatic',version:1,action:'commercial_accept',
          canonical_order_key:`site:${claim.orderId}`, event_id:eventId,
          accepted_at:claim.acceptedAt,
          idempotency_key:hash(`auto-accept|${claim.orderId}|${claim.acceptedAt}`),
          recipient_e164:text(customer.phoneE164),
          consent:{channel:'whatsapp',granted:true,granted_at:text(order.whatsappNotificationsConsentAt),source:'dfl_site'},
        };
        const remote=await callEntregas(AUTO_ACCEPT_PATH,payload);
        const body=remote.data && typeof remote.data==='object' && !Array.isArray(remote.data)
          ? remote.data as Raw : {};
        if (remote.ok && body.ok===true && body.commercial_state==='confirmed') {
          state='acknowledged';code='ACCEPTED_BY_ENTREGAS';
        } else if ([400,401,403,409,422].includes(remote.status)) {
          state='blocked';code=`REMOTE_${remote.status}`;
        } else { code=`REMOTE_${remote.status}`; }
      }
    } catch { code='TRANSPORT_UNCERTAIN'; }
    if(state==='pending' && claim.attempts>=MAX_ATTEMPTS){state='blocked';code='MAX_ATTEMPTS';}
    const next= new Date(Date.now()+Math.min(30,2**claim.attempts)*60_000).toISOString();
    // R26: stale workers cannot overwrite a newer lease/acknowledgement.
    const settled=await adminDb.runTransaction(async tx=>{
      // R27: enqueue once AT THE SAME TX as commercial ACK; no old backlog.
      // Read every document before the first write (Firestore transaction rule).
      const enqueue=state==='acknowledged'&&r27ShouldEnqueue(process.env,claim.acceptedAt);
      const jobRef=enqueue?adminDb.collection(R27_COLLECTION).doc(claim.orderId):null;
      const fresh=await tx.get(doc.ref);
      const jobSnap=jobRef?await tx.get(jobRef):null;
      const live=(fresh.data()||{}) as Raw;
      if(!fresh.exists||text(live.state)!=='processing'||text(live.locked_by)!==lock)return false;
      tx.update(doc.ref,{state,locked_at:null,locked_by:null,updated_at:new Date().toISOString(),
        last_error_code:code,...(state==='pending'?{retry_at:next}:{}),
        ...(state==='acknowledged'?{acknowledged_at:new Date().toISOString()}:{}),});
      if(jobRef&&jobSnap&&!jobSnap.exists){
        const stamp=new Date().toISOString();
        tx.create(jobRef,{order_id:claim.orderId,accepted_at:claim.acceptedAt,
          state:'pending',attempts:0,created_at:stamp,updated_at:stamp});
      }
      return true;
    });
    if(!settled){result.deferred++;continue;}
    if (state==='acknowledged') result.acknowledged++;
    else if (state==='blocked') result.blocked++;
    else result.deferred++;
  }
  return result;
}
