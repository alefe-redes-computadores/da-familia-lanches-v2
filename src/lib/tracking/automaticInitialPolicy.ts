/** R25 — pure, fail-closed policy for ONE initial WhatsApp tracking handoff.
 * This module never makes network calls or issues tracking grants.
 */
import { acceptedOrderCanNotify, terminalOrDifferentAcceptance } from './automaticAcceptancePolicy';

export const R25_ISSUE_PATH='/api/integration/tracking/v1/auto/issue' as const;
export const R25_RECEIPT_PATH='/api/integration/tracking/v1/auto/receipt' as const;
export const R25_TTL_MINUTES=45 as const;
export const R25_COLLECTION='tracking_auto_initial_handoffs_v1';
export type R25ProviderResult='accepted_by_provider'|'delivery_uncertain'|'rejected_by_provider';
export type R25ProviderReceipt={result:R25ProviderResult;provider_event_id:string};

const dict=(v:unknown):v is Record<string,unknown> => Boolean(v&&typeof v==='object'&&!Array.isArray(v));
const txt=(v:unknown)=>typeof v==='string'?v.trim():'';
export const r25ValidOrderId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{8,80}$/.test(v);
export const r25ValidProviderEvent=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9._:\/+=-]{8,220}$/.test(v);

/** Acknowledged commercial acceptance is an additional prerequisite, never a replacement for consent. */
export function r25Eligible(order:Record<string,unknown>, acceptance:Record<string,unknown>, now=Date.now()):boolean {
  const at=txt(order.acceptedAt);
  const parsed=Date.parse(at);
  if(!Number.isFinite(parsed)||parsed>now+120_000||now-parsed>24*3600_000)return false;
  if(!acceptedOrderCanNotify(order,at)||terminalOrDifferentAcceptance(order,at))return false;
  if(acceptance.state!=='acknowledged'||txt(acceptance.accepted_at)!==at)return false;
  if(txt(acceptance.event_id)!==`site-R21-accepted-${txt(acceptance.order_id)}`)return false;
  return r25ValidOrderId(acceptance.order_id);
}

export type R25IssueBody={
  contract:'dfl.tracking.automatic';version:1;action:'issue_initial';
  canonical_order_key:string;acceptance_event_id:string;
  recipient_e164:string;idempotency_key:string;requested_ttl_minutes:45;
};
export function r25IssueBody(orderId:string,phone:string,stableKey:string):R25IssueBody {
  return {contract:'dfl.tracking.automatic',version:1,action:'issue_initial',
    canonical_order_key:`site:${orderId}`,acceptance_event_id:`site-R21-accepted-${orderId}`,
    recipient_e164:phone,idempotency_key:stableKey,requested_ttl_minutes:R25_TTL_MINUTES};
}

/** Validate the entire token-bearing response before using it; never persist or log this object. */
export function r25ValidIssueReply(v:unknown,now=Date.now()):v is {
  contract:'dfl.tracking.automatic';version:1;action:'issue_initial';
  status:'issued_pending_provider';grant_id:string;opaque_token:string;expires_at:string;
  one_time_only:true;delivery_confirmed:false;
} {
  if(!dict(v))return false;
  if(v.contract!=='dfl.tracking.automatic'||v.version!==1||v.action!=='issue_initial'||
     v.status!=='issued_pending_provider'||v.one_time_only!==true||v.delivery_confirmed!==false)return false;
  if(typeof v.grant_id!=='string'||!/^[a-f0-9]{64}$/.test(v.grant_id))return false;
  if(typeof v.opaque_token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(v.opaque_token))return false;
  const expiration=Date.parse(txt(v.expires_at));
  return Number.isFinite(expiration)&&expiration>now&&expiration<=now+46*60_000;
}

export function r25ValidReceipt(v:unknown):v is R25ProviderReceipt {
  return dict(v)&&['accepted_by_provider','delivery_uncertain','rejected_by_provider'].includes(String(v.result))&&
    r25ValidProviderEvent(v.provider_event_id);
}

export function r25ReceiptBody(orderId:string,grantId:string,stableKey:string,v:R25ProviderReceipt) {
  return {contract:'dfl.tracking.automatic' as const,version:1 as const,action:'provider_receipt' as const,
    canonical_order_key:`site:${orderId}`,grant_id:grantId,idempotency_key:stableKey,
    provider_event_id:v.provider_event_id,result:v.result};
}

/** Only used inside the trusted Site->provider process, never in the browser or a persistent queue. */
export function r25EphemeralLink(opaqueToken:string) {
  return `https://dafamilialanches.com.br/acompanhar#t=${opaqueToken}`;
}
