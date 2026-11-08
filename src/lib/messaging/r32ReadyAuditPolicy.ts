/** R32 — minimize order.ready diagnostics, no customer details or mutations. */
export const R32_AUDIT_MAX_ROWS=40;
const txt=(x:unknown,max=100)=>typeof x==='string'?x.trim().slice(0,max):'';
const obj=(x:unknown):Record<string,unknown>=>x&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:{};
export const r32ValidOrderId=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{8,100}$/.test(value);
export function r32RedactedIntent(row:Record<string,unknown>) {
  const status=txt(row.status,32);
  const allowed=new Set(['pending','processing','queued','failed','suppressed','unknown']);
  return {state:allowed.has(status)?status:'unknown',
    eventType:txt(row.messaging_event_type||row.intent_type,45),
    reason:txt(row.suppressed_reason,110)||null,
    updatedAt:txt(row.updated_at||row.created_at,50)||null,
    // Never expose phone, order address, outbox payload, link or provider credentials.
    sourceEventRef:txt(row.source_event_id,180).slice(-24)||null};
}
export function r32RedactedOutbox(row:Record<string,unknown>) {
  const p=obj(row.payload);
  const state=txt(row.status,35);
  return {eventType:txt(row.event_type,45),
    stage:txt(p.status,42),
    state:state||'unknown',
    eventRef:txt(row.event_id,180).slice(-24)||null,
    occurredAt:txt(row.occurred_at,50)||null};
}
export function r32ReadyReason(snapshot:{orderExists:boolean;status:string;outboxCount:number;intents:ReturnType<typeof r32RedactedIntent>[];gate:string|null}) {
  if(!snapshot.orderExists)return 'order_not_found';
  if(snapshot.intents.some(x=>x.state==='suppressed'))return 'intent_suppressed';
  if(snapshot.intents.some(x=>x.state==='failed'))return 'intent_failed';
  if(snapshot.intents.some(x=>x.state==='queued'))return 'queued_not_delivered';
  if(snapshot.intents.some(x=>x.state==='processing'||x.state==='pending'))return 'processing_or_pending';
  if(snapshot.outboxCount===0)return 'no_ready_outbox_in_sample';
  if(snapshot.gate)return 'current_policy_blocked';
  return 'projection_or_provider_not_confirmed';
}
