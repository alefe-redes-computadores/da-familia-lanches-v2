import "server-only";
import { adminDb } from "./admin";

export type DflMessagingEventType =
  | "order.created" | "order.production" | "order.ready" | "order.cancelled"
  | "delivery.started" | "delivery.next_stop" | "delivery.position_changed"
  | "delivery.completed" | "delivery.failed";

export type DflMessagingProjection = {
  event_id: string;
  source: "site" | "entregas";
  event_type: DflMessagingEventType;
  order_id: string;
  customer_phone: string;
  customer_name: string | null;
  payload: Record<string, unknown>;
};

const text=(v:unknown)=>String(v??"").trim();
const objectValue=(v:unknown):Record<string,unknown> =>
  v && typeof v==="object" && !Array.isArray(v) ? v as Record<string,unknown> : {};

function phoneFromOrder(order:Record<string,unknown>){
  const c=objectValue(order.customerSnapshot);
  return text(c.phoneE164)||text(c.phone)||text(order.userPhone);
}
function nameFromOrder(order:Record<string,unknown>){
  const c=objectValue(order.customerSnapshot);
  return text(c.name)||text(order.userName)||null;
}
function statusEvent(status:unknown):DflMessagingEventType|null{
  const n=text(status).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  if(n.includes("producao")) return "order.production";
  if(n==="pronto") return "order.ready";
  if(n.includes("cancel")) return "order.cancelled";
  return null;
}
function intentEvent(v:unknown):DflMessagingEventType|null{
  switch(text(v)){
    case "delivery_started": return "delivery.started";
    case "delivery_next_stop": return "delivery.next_stop";
    case "delivery_position_changed": return "delivery.position_changed";
    case "delivery_completed": return "delivery.completed";
    case "delivery_failed": return "delivery.failed";
    default:return null;
  }
}
function iso(v:unknown){
  if(typeof v==="string"&&v.trim()) return v;
  if(v&&typeof v==="object"&&"toDate" in v){
    const fn=(v as {toDate?:unknown}).toDate;
    if(typeof fn==="function"){try{return (fn as ()=>Date)().toISOString();}catch{}}
  }
  return null;
}

export async function collectMessagingProjections(limit=100){
  const safeLimit=Math.max(1,Math.min(200,Math.trunc(limit)));
  const ordersSnap=await adminDb.collection("Pedidos").limit(safeLimit).get();
  const orders=new Map(ordersSnap.docs.map(d=>[d.id,d.data() as Record<string,unknown>]));
  const result:DflMessagingProjection[]=[];

  for(const [orderId,order] of orders){
    const phone=phoneFromOrder(order); if(!phone) continue;
    const customerName=nameFromOrder(order);
    const createdAt=iso(order.createdAt)||iso(order.data)||iso(order.created_at);
    result.push({
      event_id:`msg-site-order-created-v1__${orderId}`, source:"site",
      event_type:"order.created", order_id:orderId, customer_phone:phone,
      customer_name:customerName,
      payload:{customer_name:customerName,order_number:orderId.slice(-8).toUpperCase(),total:Number(order.total)||0,occurred_at:createdAt},
    });
    const eventType=statusEvent(order.status);
    if(eventType){
      const statusAt=iso(order.statusUpdatedAt)||iso(order.updatedAt)||null;
      result.push({
        event_id:`msg-site-status-v1__${orderId}__${eventType}__${statusAt||"current"}`,
        source:"site",event_type:eventType,order_id:orderId,customer_phone:phone,
        customer_name:customerName,
        payload:{customer_name:customerName,order_number:orderId.slice(-8).toUpperCase(),total:Number(order.total)||0,occurred_at:statusAt},
      });
    }
  }

  const intentsSnap=await adminDb.collection("integration_notification_intents")
    .where("status","==","pending").limit(safeLimit).get();
  for(const doc of intentsSnap.docs){
    const intent=doc.data() as Record<string,unknown>;
    const eventType=intentEvent(intent.intent_type); if(!eventType) continue;
    const orderId=text(intent.order_id); if(!orderId) continue;
    let order=orders.get(orderId);
    if(!order){
      const snap=await adminDb.collection("Pedidos").doc(orderId).get();
      if(!snap.exists) continue;
      order=snap.data() as Record<string,unknown>; orders.set(orderId,order);
    }
    const phone=phoneFromOrder(order); if(!phone) continue;
    const customerName=nameFromOrder(order);
    result.push({
      event_id:text(intent.source_event_id)||text(intent.intent_id)||doc.id,
      source:"entregas",event_type:eventType,order_id:orderId,customer_phone:phone,
      customer_name:customerName,
      payload:{customer_name:customerName,order_number:orderId.slice(-8).toUpperCase(),
        delivery_id:intent.delivery_id??null,stops_ahead:intent.stops_ahead??null,
        is_next_stop:intent.is_next_stop===true},
    });
  }
  return result.slice(0,safeLimit);
}
