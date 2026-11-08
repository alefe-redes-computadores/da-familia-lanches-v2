/** R29 — pure, fail-closed operational preflight contract. Never authorizes sending. */
export const R29_REF = 'bwggczkzsqcdeayyysmx';
export const R29_URL = `https://${R29_REF}.supabase.co/functions/v1/dfl-tracking-provider-handoff`;
export const R29_PREFLIGHT = {contract:'dfl.tracking.provider.preflight.v1',version:1,action:'preflight'} as const;
export type R29State = 'configured'|'off'|'unknown';
export type R29Check = {id:string;label:string;state:R29State};
export type R29Remote = {
  state:'not_checked'|'reachable'|'authenticated'|'unauthorized'|'unavailable'|'invalid_reply';
  providerConfigured:boolean|null;
  deliveryEnabled:boolean|null;
};
const obj = (x:unknown):x is Record<string,unknown> => Boolean(x && typeof x==='object' && !Array.isArray(x));
export function r29ValidPreflight(x:unknown):x is {
  contract:'dfl.tracking.provider.preflight.v1';version:1;action:'preflight';
  auth_verified:true;provider_configured:boolean;delivery_enabled:boolean;
  sends_attempted:0;customer_delivery_confirmed:false;
} {
  if(!obj(x))return false;
  const keys=['contract','version','action','auth_verified','provider_configured','delivery_enabled','sends_attempted','customer_delivery_confirmed'];
  return Object.keys(x).length===keys.length && Object.keys(x).every(k=>keys.includes(k)) &&
    x.contract===R29_PREFLIGHT.contract && x.version===1 && x.action===R29_PREFLIGHT.action &&
    x.auth_verified===true && typeof x.provider_configured==='boolean' &&
    typeof x.delivery_enabled==='boolean' && x.sends_attempted===0 &&
    x.customer_delivery_confirmed===false;
}
export function r29Checks(env:Record<string,string|undefined>,configValid:boolean):R29Check[] {
  const enabled=(name:string)=>env[name]==='1';
  const check=(id:string,label:string,yes:boolean):R29Check=>({id,label,state:yes?'configured':'off'});
  return [
    check('public','Acompanhamento público',enabled('DFL_SITE_TRACKING_ENABLED')),
    check('accept','Aceite S2S',enabled('DFL_SITE_TRACKING_AUTO_ACCEPT_ENABLED')),
    check('issue','Emissão inicial',enabled('DFL_SITE_TRACKING_AUTO_ISSUE_ENABLED')),
    check('provider','Certificação declarada no Site',enabled('DFL_SITE_TRACKING_AUTO_PROVIDER_CERTIFIED')),
    check('transport','Transporte certificado no Site',enabled('DFL_SITE_TRACKING_PROVIDER_TRANSPORT_CERTIFIED')),
    check('worker','Worker automático',enabled('DFL_SITE_TRACKING_AUTO_WORKER_ENABLED')),
    check('endpoint','Ponte P9: HTTPS e autenticação do Site',configValid),
    check('activation','Marco UTC válido',r29ValidActivation(env.DFL_SITE_TRACKING_AUTO_ACTIVATED_AT)),
    check('kill','Envio liberado pelo interruptor',env.DFL_SITE_TRACKING_AUTO_KILL_SWITCH==='false'),
    {id:'entregas',label:'Entregas: capability e aceite real',state:'unknown'},
    {id:'supabase',label:'Supabase: segredos e Evolution certificados',state:'unknown'},
    {id:'customer',label:'Mensagem recebida pelo canário',state:'unknown'},
  ];
}
/** Real timestamp, no empty or fabricated activation gate. */
export function r29ValidActivation(value:unknown,now=Date.now()):boolean {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value))return false;
  const millis=Date.parse(value);
  return Number.isFinite(millis)&&millis<=now+120_000&&millis>=Date.UTC(2026,0,1);
}

export const r29NoSends = {orderRead:false,tokenIssued:false,providerSend:false,dbWrite:false,customerDeliveryVerified:false} as const;
