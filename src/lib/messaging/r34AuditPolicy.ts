/** R34 — pure, restricted, read-only per-order messaging audit contract. */
export const R34_PROJECT='bwggczkzsqcdeayyysmx';
export const R34_AUDIT_URL=`https://${R34_PROJECT}.supabase.co/functions/v1/dfl-messaging-audit`;
export const R34_MAX_ROWS=24;
export const R34_SOURCES=['site','manual','entregas'] as const;
export const R34_EVENTS=['all','order.created','order.production','order.ready','order.cancelled','delivery.started','delivery.next_stop','delivery.position_changed','delivery.completed','delivery.failed'] as const;
export type R34Source=typeof R34_SOURCES[number];
export type R34Event=typeof R34_EVENTS[number];
export type R34Query={source:R34Source;orderId:string;eventType:R34Event};
export type R34Entry={eventType:string;state:string;fingerprint:string;createdAt:string|null;sentAt:string|null;providerAccepted:boolean;failureCode:string|null};
export type R34AuditData={contract:'dfl.messaging.audit.v1';version:1;ok:true;source:R34Source;orderId:string;eventType:R34Event;checkedAt:string;records:R34Entry[];sampleLimited:boolean;customerDeliveryVerified:false};
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
const iso=(x:unknown)=>x===null||(typeof x==='string'&&x.length<=40&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(x)&&Number.isFinite(Date.parse(x)));
export function r34ValidQuery(x:unknown):x is R34Query {
 if(!obj(x)||Object.keys(x).length!==3||!Object.keys(x).every(k=>['source','orderId','eventType'].includes(k)))return false;
 if(!R34_SOURCES.includes(x.source as R34Source)||!R34_EVENTS.includes(x.eventType as R34Event))return false;
 if(typeof x.orderId!=='string')return false;
 if(x.source==='manual')return /^entregas:dfl-[A-Za-z0-9-]{12,120}$/.test(x.orderId);
 return /^[A-Za-z0-9_-]{8,120}$/.test(x.orderId);
}
const status=new Set(['pending','processing','sent','failed','dead_letter','suppressed','unknown']);
export function r34ValidAuditReply(x:unknown,q:R34Query):x is R34AuditData {
 if(!obj(x)||Object.keys(x).length!==10||!Object.keys(x).every(k=>['contract','version','ok','source','orderId','eventType','checkedAt','records','sampleLimited','customerDeliveryVerified'].includes(k)))return false;
 if(x.contract!=='dfl.messaging.audit.v1'||x.version!==1||x.ok!==true||x.source!==q.source||x.orderId!==q.orderId||x.eventType!==q.eventType||
   !iso(x.checkedAt)||x.checkedAt===null||x.sampleLimited!==true&&x.sampleLimited!==false||x.customerDeliveryVerified!==false||!Array.isArray(x.records)||x.records.length>R34_MAX_ROWS)return false;
 for(const row of x.records){
  if(!obj(row)||Object.keys(row).length!==7||!Object.keys(row).every(k=>['eventType','state','fingerprint','createdAt','sentAt','providerAccepted','failureCode'].includes(k))||
    !(R34_EVENTS.includes(row.eventType as R34Event)&&row.eventType!=='all'||row.eventType==='unknown')||(q.eventType!=='all'&&row.eventType!==q.eventType)||
    !status.has(String(row.state))||typeof row.fingerprint!=='string'||!/^[a-f0-9]{16}$/.test(row.fingerprint)||
    !iso(row.createdAt)||!iso(row.sentAt)||typeof row.providerAccepted!=='boolean'||
    !(row.failureCode===null||(typeof row.failureCode==='string'&&/^[A-Z][A-Z0-9_]{2,80}$/.test(row.failureCode))))return false;
 }
 return true;
}
