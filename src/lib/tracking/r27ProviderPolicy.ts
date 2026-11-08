/** R27 — fail-closed bridge policy for the dedicated tracking handoff provider.
 * No I/O. Enabling preconditions are independent of ordinary messaging flags.
 */
export const R27_COLLECTION='tracking_auto_delivery_jobs_v1';
export type R27ProviderResult='accepted_by_provider'|'delivery_uncertain'|'rejected_by_provider';
export type R27ProviderReceipt={result:R27ProviderResult;provider_event_id:string};
export type R27Configuration={url:string;apikey:string;transportSecret:string};
export type R27HandoffInput={url:string;recipient_e164:string;order_id:string;expires_at:string};
const string=(x:unknown)=>typeof x==='string'?x.trim():'';
const dict=(x:unknown):x is Record<string,unknown>=>Boolean(x&&typeof x==='object'&&!Array.isArray(x));
const orderId=(s:string)=>/^[A-Za-z0-9_-]{8,80}$/.test(s);
const phone=(s:string)=>/^\+55[1-9][0-9][2-9][0-9]{7,8}$/.test(s);
const token=(s:string)=>/^[A-Za-z0-9_-]{43}$/.test(s);
export function r27ValidHandoffInput(value:unknown,now=Date.now()):value is R27HandoffInput {
  if(!dict(value))return false;
  const id=string(value.order_id),recipient=string(value.recipient_e164),link=string(value.url);
  if(!orderId(id)||!phone(recipient)||!link.startsWith('https://dafamilialanches.com.br/acompanhar#t='))return false;
  if(!token(link.slice('https://dafamilialanches.com.br/acompanhar#t='.length)))return false;
  const expiration=Date.parse(string(value.expires_at));
  return Number.isFinite(expiration)&&expiration>now&&expiration<=now+46*60_000;
}
export function r27ValidProviderReply(value:unknown):value is R27ProviderReceipt & {contract:'dfl.tracking.provider.v1';version:1;action:'send_tracking_initial';customer_delivery_confirmed:false} {
  if(!dict(value))return false;
  const keys=Object.keys(value);
  if(keys.length!==6||!keys.every(k=>['contract','version','action','result','provider_event_id','customer_delivery_confirmed'].includes(k)))return false;
  return value.contract==='dfl.tracking.provider.v1'&&value.version===1&&
    value.action==='send_tracking_initial'&&value.customer_delivery_confirmed===false&&
    ['accepted_by_provider','delivery_uncertain','rejected_by_provider'].includes(string(value.result))&&
    /^[A-Za-z0-9._:/+=-]{8,220}$/.test(string(value.provider_event_id));
}
/** The endpoint is a dedicated Edge Function. Never call the existing persistent messaging ingest. */
export function r27ProviderConfig(env:Record<string,string|undefined>):R27Configuration|null {
  const raw=string(env.DFL_SITE_TRACKING_PROVIDER_HANDOFF_URL);
  const projectRef=string(env.DFL_SITE_TRACKING_PROVIDER_PROJECT_REF);
  const apikey=string(env.DFL_SITE_TRACKING_PROVIDER_APIKEY);
  const transportSecret=string(env.DFL_SITE_TRACKING_PROVIDER_HANDOFF_SECRET);
  if(!/^[a-z0-9]{15,32}$/.test(projectRef)||!apikey.startsWith('sb_secret_')||apikey.length<35||
      transportSecret.length<32||transportSecret.length>512)return null;
  try {
    const url=new URL(raw);
    if(url.protocol!=='https:'||url.hostname!==`${projectRef}.supabase.co`||
       url.pathname!=='/functions/v1/dfl-tracking-provider-handoff'||
       url.username||url.password||url.port||url.search||url.hash||url.origin+url.pathname!==raw)return null;
    return {url:raw,apikey,transportSecret};
  } catch {return null;}
}
/** OFF by default. Every bit must be deliberately certified AND the adapter configured. */
export function r27DispatchConfigured(env:Record<string,string|undefined>):boolean {
  return env.DFL_SITE_TRACKING_ENABLED==='1'&&
    env.DFL_SITE_TRACKING_AUTO_ACCEPT_ENABLED==='1'&&
    env.DFL_SITE_TRACKING_AUTO_ISSUE_ENABLED==='1'&&
    env.DFL_SITE_TRACKING_AUTO_PROVIDER_CERTIFIED==='1'&&
    env.DFL_SITE_TRACKING_PROVIDER_TRANSPORT_CERTIFIED==='1'&&
    env.DFL_SITE_TRACKING_AUTO_WORKER_ENABLED==='1'&&
    env.DFL_SITE_TRACKING_AUTO_KILL_SWITCH!=='true'&&
    r27ValidActivation(env.DFL_SITE_TRACKING_AUTO_ACTIVATED_AT)&&
    r27ProviderConfig(env)!==null;
}

/** Prevent pre-rollout R23 backlog from becoming customer notifications. */
export function r27ValidActivation(value:unknown,now=Date.now()):boolean {
  const text=string(value);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(text))return false;
  const timestamp=Date.parse(text);
  return Number.isFinite(timestamp)&&timestamp<=now+120_000;
}
export function r27ShouldEnqueue(env:Record<string,string|undefined>,acceptedAt:unknown,now=Date.now()):boolean {
  if(!r27DispatchConfigured(env))return false;
  const accepted=Date.parse(string(acceptedAt));
  const activated=Date.parse(string(env.DFL_SITE_TRACKING_AUTO_ACTIVATED_AT));
  return Number.isFinite(accepted)&&accepted>=activated&&accepted>=now-24*3600_000&&accepted<=now+120_000;
}
