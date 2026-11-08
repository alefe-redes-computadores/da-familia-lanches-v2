/** R32 — one future manual next-stop transition, never a route-start substitute.
 * Pure contract: sender is Entregas, transport is Site, provider is Supabase.
 * This module NEVER sends or registers messages and is OFF by default.
 */
export const R32_NEXT_STOP_EVENT = 'delivery.next_stop' as const;
export const R32_NEXT_STOP_PREFIX = 'manual-msg-v2__delivery.next_stop__' as const;
const obj = (v:unknown):v is Record<string,unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const txt = (v:unknown) => typeof v === 'string' ? v.trim() : '';
const id = (v:unknown) => /^[A-Za-z0-9_-]{3,160}$/.test(txt(v));
const validPhone = (v:string) => /^55[1-9]\d{9,10}$/.test(v);
/** Independently gated; never infer permission from the existing manual messaging scope. */
export function r32ManualNextStopCanary(env:Record<string,string|undefined>, phone:string):boolean {
  return env.DFL_MANUAL_NEXT_STOP_ENABLED === 'true' &&
    env.DFL_MANUAL_NEXT_STOP_KILL_SWITCH === 'false' &&
    env.DFL_MANUAL_NEXT_STOP_SCOPE === 'canary' &&
    env.DFL_MANUAL_MESSAGING_ENABLED === 'true' &&
    env.DFL_MANUAL_MESSAGING_KILL_SWITCH !== 'true' &&
    validPhone(phone) &&
    env.DFL_MESSAGING_PILOT_PHONE_E164 === phone;
}
/** An explicit physical stop transition, not a reorder or an estimated arrival. */
export function r32ValidManualNextStop(data:unknown, now=Date.now()):boolean {
  if(!obj(data)||data.source!=='manual'||data.event_type!==R32_NEXT_STOP_EVENT) return false;
  const deliveryId=txt(data.order_id).replace(/^entregas:/,'');
  if(!/^dfl-[A-Za-z0-9-]{12,120}$/.test(deliveryId)||data.order_id!==`entregas:${deliveryId}`)return false;
  const p=data.payload;
  if(!obj(p)||p.fulfillment_mode!=='delivery'||p.delivery_id!==deliveryId||
    p.manual_messaging_opt_in_v1!==true||p.notify_whatsapp!==true) return false;
  if(p.route_started!==true||p.route_closed!==false||p.previous_stop_completed!==true||
    p.stops_ahead!==0||p.pending_stop_rank!==1) return false;
  if(!id(p.route_id)||!id(p.previous_stop_group_id)||!id(p.next_stop_group_id)||
    p.previous_stop_group_id===p.next_stop_group_id)return false;
  const planned=Number(p.planned_stop),total=Number(p.total_stops),version=Number(p.snapshot_version);
  if(!Number.isSafeInteger(planned)||!Number.isSafeInteger(total)||
    planned<2||total<2||planned>total||total>100||
    !Number.isSafeInteger(version)||version<1||version>2_000_000_000) return false;
  const transition=txt(p.transition_key);
  if(!/^[a-f0-9]{64}$/.test(transition)||
    data.event_id!==`${R32_NEXT_STOP_PREFIX}${deliveryId}__${transition}`)return false;
  const occurred=txt(data.occurred_at),completion=txt(p.previous_stop_completed_at);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(occurred)||
    occurred!==completion)return false;
  const timestamp=Date.parse(occurred);
  // No backlog / stale/reordered event may be reanimated by delayed workers.
  if(!Number.isFinite(timestamp)||timestamp>now+30_000||now-timestamp>7*60_000)return false;
  return true;
}
