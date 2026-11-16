/** R76 P2 — validação independente no Site, sem envio nem efeitos colaterais. */
const obj=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const txt=(v:unknown)=>typeof v==='string'?v.trim():'';
const at=(v:unknown)=>{const s=txt(v);return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(s)&&Number.isFinite(Date.parse(s))?Date.parse(s):null};
export function r76KitchenEnabled(env:Record<string,string|undefined>):boolean {
  return env.DFL_R76_KITCHEN_ENABLED==='true' && env.DFL_R76_KITCHEN_KILL_SWITCH==='false' &&
    env.DFL_R76_KITCHEN_ROLLOUT_APPROVED==='true' && env.DFL_R76_KITCHEN_WORKER_CERTIFIED==='true' &&
    env.DFL_MANUAL_MESSAGING_ENABLED==='true'&&env.DFL_MANUAL_MESSAGING_KILL_SWITCH!=='true';
}
/** R76: canario de cozinha por destinatario, sem afetar mensagens anteriores. */
export function r76KitchenAudienceAllowed(env:Record<string,string|undefined>,phone:string):boolean {
  if(!/^55[1-9]\d{9,10}$/.test(phone))return false;
  if(env.DFL_R76_KITCHEN_AUDIENCE_MODE==='general'&&env.DFL_R76_KITCHEN_GENERAL_APPROVED==='true')return true;
  const pilot=(env.DFL_MESSAGING_PILOT_PHONE_E164||'').trim();
  return /^55[1-9]\d{9,10}$/.test(pilot)&&phone===pilot;
}
export function r76ValidKitchenEvent(value:unknown,now=Date.now(),activatedAt?:string):boolean {
  if(!obj(value)||value.source!=='manual'||!obj(value.payload))return false;
  const p=value.payload;
  if(value.event_type!=='order.production'&&value.event_type!=='order.ready')return false;
  const type=value.event_type,id=txt(p.delivery_id),order=txt(value.order_id),key=txt(p.transition_key);
  if(!/^dfl-[A-Za-z0-9-]{12,120}$/.test(id)||order!==`entregas:${id}`||
    !/^[a-f0-9]{64}$/.test(key)||value.event_id!==`manual-msg-v2__${type}__${id}__${key}`)return false;
  if(p.delivery_stage_v1!==true||p.fulfillment_mode!=='delivery'||p.logistics_provider!=='dfl'||
    !['loja','manual','ifood','food99','keeta'].includes(txt(p.origin))||
    !['dfl_entregas','manual'].includes(txt(p.source_system))||p.notify_whatsapp!==true||p.manual_messaging_opt_in_v1!==true)return false;
  const created=at(p.created_at),started=at(p.preparation_started_at),ready=at(p.preparation_ready_at);
  const occurred=at(value.occurred_at),active=at(activatedAt);
  if(created===null||started===null||occurred===null||active===null||created<active||occurred<created||started<created)return false;
  if(occurred>now+30_000||now-occurred>7*60_000)return false;
  if(type==='order.production')return occurred===started&&ready===null;
  return ready!==null&&ready>=started&&occurred===ready;
}
