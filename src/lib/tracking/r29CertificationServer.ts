/** R29 — admin-only, read-only, one-shot preflight. No customer data or order IDs. */
import 'server-only';
import {r27ProviderConfig,r31ExistingMessagingConfig} from './r27ProviderPolicy';
import {r31SignedHeaders} from './r31MessagingAuthentication';
import {r30AssessRelease} from './r30ReleasePolicy';
import {R29_PREFLIGHT,R29_URL,r29Checks,r29NoSends,r29ValidPreflight,type R29Remote} from './r29CertificationPolicy';
const EMPTY:R29Remote={state:'not_checked',providerConfigured:null,deliveryEnabled:null};

async function probeOnce():Promise<R29Remote> {
  const conf=r27ProviderConfig(process.env);
  const existing=conf?null:r31ExistingMessagingConfig(process.env);
  // Fixed trusted origin; never let a query, Host header or user input choose a URL.
  if(!conf&&!existing){
    try {
      const res=await fetch(R29_URL,{method:'GET',cache:'no-store',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(4500)});
      return {state:res.status===405?'reachable':'unavailable',providerConfigured:null,deliveryEnabled:null};
    }catch{return {state:'unavailable',providerConfigured:null,deliveryEnabled:null};}
  }
  // This request cannot issue tokens, mutate state, or send a WhatsApp message.
  // It is authenticated by the two independent R27 server-only credentials.
  try {
    const payload=JSON.stringify(R29_PREFLIGHT);
    const headers:Record<string,string>=conf?{'content-type':'application/json','accept':'application/json',
        'x-dfl-tracking-preflight':'1','x-dfl-tracking-provider-secret':conf.transportSecret,'apikey':conf.apikey}:
        {'content-type':'application/json','accept':'application/json',
         'x-dfl-tracking-preflight':'1',...r31SignedHeaders(payload,existing!)};
    const res=await fetch(conf?conf.url:existing!.url,{method:'POST',cache:'no-store',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(5500),
      headers,body:payload});
    if(!res.ok)return {state:res.status===401?'unauthorized':'unavailable',providerConfigured:null,deliveryEnabled:null};
    if(!(res.headers.get('content-type')||'').includes('application/json'))return {state:'invalid_reply',providerConfigured:null,deliveryEnabled:null};
    const raw=await res.text();
    if(raw.length>700)return {state:'invalid_reply',providerConfigured:null,deliveryEnabled:null};
    const data:unknown=JSON.parse(raw);
    if(!r29ValidPreflight(data))return {state:'invalid_reply',providerConfigured:null,deliveryEnabled:null};
    return {state:'authenticated',providerConfigured:data.provider_configured,deliveryEnabled:data.delivery_enabled};
  }catch{return {state:'unavailable',providerConfigured:null,deliveryEnabled:null};}
}
export async function r29ReadCertification(probe=false){
  const dedicated=Boolean(r27ProviderConfig(process.env));
  const reused=Boolean(r31ExistingMessagingConfig(process.env));
  const valid=dedicated||reused;
  const checks=r29Checks(process.env,valid);
  const receiver=probe?await probeOnce():EMPTY;
  return {ok:true as const,checkedAt:new Date().toISOString(),
    checks,receiver,bridgeMode:(dedicated?'dedicated':reused?'existing_messaging':'unconfigured') as 'dedicated'|'existing_messaging'|'unconfigured',
    releaseGate:r30AssessRelease(checks,receiver),
    ...r29NoSends,
    release:'requires_end_to_end_canary_homologation' as const,
    note:'Pré-voo sem pedido, telefone, token, gravação, mensagem ou ativação. HTTP 405 só confirma a presença do receptor; credenciais e entrega real são provas distintas.',
  };
}
