import "server-only";
import { randomUUID } from "node:crypto";
import type { IntegrationEventEnvelope } from "../contracts";
import { adminDb } from "./admin";

export type DflMessagingEventType =
  | "order.created" | "order.production" | "order.ready" | "order.cancelled"
  | "delivery.started" | "delivery.next_stop" | "delivery.position_changed"
  | "delivery.completed" | "delivery.failed";

type Projection = {
  intent_id: string;
  source_event_id: string;
  source: "site" | "entregas";
  event_type: DflMessagingEventType;
  order_id: string;
  customer_phone: string;
  customer_name: string | null;
  payload: Record<string, unknown>;
};

const COLLECTION="integration_notification_intents";
const text=(v:unknown)=>String(v??"").trim();
const obj=(v:unknown):Record<string,unknown> =>
  v && typeof v==="object" && !Array.isArray(v) ? v as Record<string,unknown> : {};

function commercialType(event:IntegrationEventEnvelope):DflMessagingEventType|null{
  if(event.event_type==="order.created") return "order.created";
  if(event.event_type!=="order.updated") return null;
  const payload=obj(event.payload);
  const n=text(payload.status).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(n.includes("producao")) return "order.production";
  if(n==="pronto") return "order.ready";
  if(n.includes("cancel")) return "order.cancelled";
  return null;
}

export async function ensureCommercialMessagingIntent(event:IntegrationEventEnvelope){
  const eventType=commercialType(event);
  if(!eventType) return {created:false,reason:"not_messaging_event" as const};

  const payload=obj(event.payload);
  const customer=obj(payload.customerSnapshot);
  const orderId=text(payload.orderId)||text(event.entity_id);
  if(!orderId) return {created:false,reason:"missing_order" as const};

  const ref=adminDb.collection(COLLECTION).doc(
    encodeURIComponent(`intent-msg-v1__${event.event_id}`)
  );
  const snapshot=await ref.get();
  if(snapshot.exists) return {created:false,reason:"exists" as const};

  const now=new Date().toISOString();
  await ref.create({
    intent_id:`intent-msg-v1__${event.event_id}`,
    intent_type:"commercial_message",
    source_event_id:event.event_id,
    source_event_type:event.event_type,
    messaging_event_type:eventType,
    messaging_source:"site",
    order_id:orderId,
    customer_phone:text(customer.phoneE164)||text(customer.phone)||null,
    customer_name:text(customer.name)||null,
    total:Number(payload.total)||0,
    status:"pending",
    schema_version:2,
    created_at:now,
    updated_at:now,
  });
  return {created:true};
}

function reverseType(v:unknown):DflMessagingEventType|null{
  switch(text(v)){
    case "delivery_started": return "delivery.started";
    case "delivery_next_stop": return "delivery.next_stop";
    case "delivery_position_changed": return "delivery.position_changed";
    case "delivery_completed": return "delivery.completed";
    case "delivery_failed": return "delivery.failed";
    default:return null;
  }
}

async function hydrate(docId:string, data:Record<string,unknown>):Promise<Projection|null>{
  const source=text(data.messaging_source)==="site" ? "site" : "entregas";
  const eventType=(text(data.messaging_event_type) as DflMessagingEventType)||reverseType(data.intent_type);
  if(!eventType) return null;
  const orderId=text(data.order_id);
  if(!orderId) return null;

  let phone=text(data.customer_phone);
  let name=text(data.customer_name)||null;
  let total=Number(data.total)||0;

  if(!phone || source==="entregas"){
    const orderSnap=await adminDb.collection("Pedidos").doc(orderId).get();
    if(!orderSnap.exists) return null;
    const order=orderSnap.data() as Record<string,unknown>;
    const customer=obj(order.customerSnapshot);
    phone=phone||text(customer.phoneE164)||text(customer.phone)||text(order.userPhone);
    name=name||text(customer.name)||text(order.userName)||null;
    total=total||Number(order.total)||0;
  }
  if(!phone) return null;

  return {
    intent_id:docId,
    source_event_id:text(data.source_event_id)||text(data.intent_id)||docId,
    source,
    event_type:eventType,
    order_id:orderId,
    customer_phone:phone,
    customer_name:name,
    payload:{
      customer_name:name,
      order_number:orderId.slice(-8).toUpperCase(),
      total,
      delivery_id:data.delivery_id??null,
      stops_ahead:data.stops_ahead??null,
      is_next_stop:data.is_next_stop===true,
    },
  };
}

export async function claimMessagingProjections(limit=20){
  const safeLimit=Math.max(1,Math.min(50,Math.trunc(limit)));
  const workerId=randomUUID();
  const snap=await adminDb.collection(COLLECTION).where("status","==","pending").limit(safeLimit*2).get();
  const claimed:Projection[]=[];

  for(const candidate of snap.docs){
    if(claimed.length>=safeLimit) break;
    const lock=await adminDb.runTransaction(async tx=>{
      const fresh=await tx.get(candidate.ref);
      if(!fresh.exists) return null;
      const data=fresh.data() as Record<string,unknown>;
      if(data.status!=="pending") return null;
      const projection=await hydrate(candidate.id,data);
      if(!projection) return null;
      tx.update(candidate.ref,{
        status:"processing",locked_by:workerId,locked_at:new Date().toISOString(),
        attempts:Number(data.attempts||0)+1,updated_at:new Date().toISOString(),
      });
      return projection;
    });
    if(lock) claimed.push(lock);
  }
  return {worker_id:workerId,events:claimed};
}

export async function settleMessagingProjections(
  workerId:string,
  results:Array<{intent_id:string;ok:boolean;error?:string}>,
){
  let settled=0;
  for(const result of results){
    const ref=adminDb.collection(COLLECTION).doc(result.intent_id);
    await adminDb.runTransaction(async tx=>{
      const snap=await tx.get(ref);
      if(!snap.exists) return;
      const data=snap.data() as Record<string,unknown>;
      if(data.status!=="processing"||data.locked_by!==workerId) return;
      const now=new Date().toISOString();
      tx.update(ref,result.ok?{
        status:"sent",processed_at:now,updated_at:now,locked_by:null,locked_at:null,last_error:null,
      }:{
        status:"pending",updated_at:now,locked_by:null,locked_at:null,
        last_error:text(result.error).slice(0,500)||"Falha no relay de mensageria.",
      });
      settled+=1;
    });
  }
  return {settled};
}
