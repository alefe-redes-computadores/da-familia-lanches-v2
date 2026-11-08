/** R27 — one-shot server-only transport. Nothing here writes the URL or token to storage.
 * This endpoint is a NEW, separately certified provider adapter. Never use the
 * existing Supabase messaging ingest: its durable outbox could store the token.
 */
import 'server-only';
import {r27ProviderConfig,r31ExistingMessagingConfig,r27ValidHandoffInput,r27ValidProviderReply,type R27HandoffInput,type R27ProviderReceipt} from './r27ProviderPolicy';
import {r31SignedHeaders} from './r31MessagingAuthentication';

export async function r27SendToProvider(input:R27HandoffInput):Promise<R27ProviderReceipt> {
  const conf=r27ProviderConfig(process.env);
  const existing=conf?null:r31ExistingMessagingConfig(process.env);
  if((!conf&&!existing)||!r27ValidHandoffInput(input))throw new Error('R27_HANDOFF_NOT_READY');
  // Only the trusted Edge Function may receive the ephemeral token fragment.
  const body=JSON.stringify({
    contract:'dfl.tracking.provider.v1',version:1,action:'send_tracking_initial',
    canonical_order_key:`site:${input.order_id}`,recipient_e164:input.recipient_e164,
    tracking_link:input.url,expires_at:input.expires_at,
  });
  let reply:Response;
  try {
    const target=conf?conf.url:existing!.url;
    const headers:Record<string,string>=conf?{'content-type':'application/json','accept':'application/json',
      'apikey':conf.apikey,'x-dfl-tracking-provider-secret':conf.transportSecret}:
      {'content-type':'application/json','accept':'application/json',...r31SignedHeaders(body,existing!)};
    reply=await fetch(target,{
      method:'POST',cache:'no-store',redirect:'error',credentials:'omit',
      signal:AbortSignal.timeout(6500),
      headers,
      body,
    });
  } catch {
    // Network uncertainty: absolutely NO automatic retry, ever.
    throw new Error('R27_PROVIDER_TRANSPORT_UNCERTAIN');
  }
  let data:unknown;
  try {
    if(!reply.ok||(reply.headers.get('content-type')||'').split(';')[0].trim()!=='application/json')
      throw new Error('R27_PROVIDER_REJECTED');
    const raw=await reply.text();
    if(raw.length<20||raw.length>2048)throw new Error('R27_PROVIDER_INVALID_REPLY');
    data=JSON.parse(raw);
  } catch {
    throw new Error('R27_PROVIDER_REPLY_UNCERTAIN');
  }
  if(!r27ValidProviderReply(data))throw new Error('R27_PROVIDER_CONTRACT_INVALID');
  // Accepted by the provider API != delivered / received / read by WhatsApp.
  return {result:data.result,provider_event_id:data.provider_event_id};
}
