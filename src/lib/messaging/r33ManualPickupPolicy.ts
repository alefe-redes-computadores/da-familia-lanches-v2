/** R33 — strict manual pickup notifications, isolated from Site pickup authority.
 * OFF by default. The sender is DFL Entregas; Site authenticates the envelope.
 * Supabase renders the existing templates only after a separate worker gate.
 */
const isObject=(x:unknown):x is Record<string,unknown>=>Boolean(x&&typeof x==='object'&&!Array.isArray(x));
const txt=(x:unknown)=>typeof x==='string'?x.trim():'';
const isIso=(x:string)=>/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
export type R33PickupKind='order.created'|'order.ready';
export function r33ManualPickupCanary(env:Record<string,string|undefined>,phone:string):boolean {
  return env.DFL_MANUAL_PICKUP_ENABLED==='true'&&
    env.DFL_MANUAL_PICKUP_KILL_SWITCH==='false'&&
    env.DFL_MANUAL_PICKUP_SCOPE==='canary'&&
    env.DFL_MANUAL_MESSAGING_ENABLED==='true'&&
    env.DFL_MANUAL_MESSAGING_KILL_SWITCH==='false'&&
    /^55[1-9]\d{9,10}$/.test(phone)&&env.DFL_MESSAGING_PILOT_PHONE_E164===phone;
}
/** R38 — additional recipients for v2 MANUAL pickup only.
 * Existing commercial Site, manual delivery v1 and manual next-stop remain unchanged.
 * Canary continues to be granted by R33 exclusively to the original pilot phone.
 * Explicit authorized_clients has a bounded list; general consented_customers
 * requires its own separate rollout approval flag, OFF by default.
 */
export function r38ManualPickupRecipientAllowed(
  env:Record<string,string|undefined>,phone:string,payload:Record<string,unknown>
):boolean {
  if(env.DFL_MANUAL_PICKUP_ENABLED!=='true'||env.DFL_MANUAL_PICKUP_KILL_SWITCH!=='false'||
    env.DFL_MANUAL_MESSAGING_ENABLED!=='true'||env.DFL_MANUAL_MESSAGING_KILL_SWITCH!=='false'||
    !/^55[1-9]\d{9,10}$/.test(phone)||
    payload.manual_messaging_opt_in_v1!==true||payload.notify_whatsapp!==true)return false;
  if(env.DFL_MANUAL_PICKUP_SCOPE==='authorized_clients') {
    const raw=(env.DFL_MANUAL_PICKUP_APPROVED_PHONES_E164||'').trim();
    const phones=raw.split(',').map(x=>x.trim()).filter(Boolean);
    return phones.length>0 && phones.length<=12 && new Set(phones).size===phones.length &&
      phones.every(x=>/^55[1-9]\d{9,10}$/.test(x)) && phones.includes(phone);
  }
  if(env.DFL_MANUAL_PICKUP_SCOPE==='consented_customers') {
    return env.DFL_MANUAL_PICKUP_ROLLOUT_APPROVED==='true';
  }
  return false;
}

export function r33ValidManualPickup(value:unknown,now=Date.now()):boolean {
  if(!isObject(value)||value.source!=='manual')return false;
  const type=value.event_type;
  if(type!=='order.created'&&type!=='order.ready')return false;
  const orderId=txt(value.order_id),deliveryId=orderId.replace(/^entregas:/,'');
  if(!/^dfl-[A-Za-z0-9-]{12,120}$/.test(deliveryId)||orderId!==`entregas:${deliveryId}`)return false;
  const p=value.payload;
  if(!isObject(p)||p.delivery_id!==deliveryId||p.fulfillment_mode!=='pickup'||
    p.manual_pickup_v1!==true||p.manual_messaging_opt_in_v1!==true||
    p.notify_whatsapp!==true||p.completed===true)return false;
  const key=txt(p.transition_key);
  if(!/^[a-f0-9]{64}$/.test(key)||value.event_id!==`manual-msg-v2__${type}__${deliveryId}__${key}`)return false;
  const at=txt(value.occurred_at),authority=txt(type==='order.created'?p.created_at:p.pickup_ready_at);
  if(!isIso(at)||at!==authority)return false;
  const ms=Date.parse(at),maxAge=type==='order.created'?15*60_000:7*60_000;
  if(ms>now+30_000||now-ms>maxAge)return false;
  if(type==='order.created'&&p.pickup_ready_at!=null&&txt(p.pickup_ready_at))return false;
  if(type==='order.ready'&&p.previous_stop_completed===true)return false;
  return true;
}
