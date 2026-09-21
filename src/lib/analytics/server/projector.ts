import "server-only";
import { FieldPath, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/integration/server/admin";

const STATE="analytics_order_state_v2",DAILY="analytics_daily_v2",CHECKPOINTS="analytics_projector_checkpoints";
const PROJECTOR_VERSION=3;
let backfillCompleteInProcess=false;
type NumMap=Record<string,number>;
type Contribution={dateKey:string;sales:number;revenue:number;subtotal:number;deliveryFees:number;discounts:number;delivery:number;pickup:number;scheduled:number;immediate:number;logisticsCompleted:number;payments:NumMap;products:NumMap;origins:NumMap};
const empty=(dateKey:string):Contribution=>({dateKey,sales:0,revenue:0,subtotal:0,deliveryFees:0,discounts:0,delivery:0,pickup:0,scheduled:0,immediate:0,logisticsCompleted:0,payments:{},products:{},origins:{}});
const num=(v:unknown)=>{const n=Number(v);return Number.isFinite(n)?n:0};
const text=(v:unknown)=>typeof v==="string"?v.trim():"";
const key=(v:unknown)=>text(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"")||"nao_informado";
const isFinal=(v:unknown)=>["finalizado","concluido","concluida","completed"].includes(key(v));
const dateKey=(d:Date)=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(d);
function asDate(v:unknown):Date|null{if(v instanceof Timestamp)return v.toDate();if(v&&typeof v==="object"&&"toDate" in v&&typeof (v as {toDate?:unknown}).toDate==="function"){try{return (v as {toDate:()=>Date}).toDate()}catch{return null}}if(typeof v==="string"||typeof v==="number"){const d=new Date(v);return Number.isNaN(d.getTime())?null:d}return null}
function safeMap(v:unknown):NumMap{
 if(!v||typeof v!=="object"||Array.isArray(v))return{};
 const out:NumMap={};
 for(const[k,raw]of Object.entries(v as Record<string,unknown>)){
  const n=num(raw);
  if(Math.abs(n)>=1e-9)out[k]=n;
 }
 return out;
}
function addMap(a:NumMap|undefined|null,b:NumMap|undefined|null,sign=1){
 const out=safeMap(a);
 for(const[k,v]of Object.entries(safeMap(b))){
  const n=(out[k]||0)+v*sign;
  if(Math.abs(n)<1e-9)delete out[k];
  else out[k]=n;
 }
 return out;
}
function contribution(o:Record<string,unknown>):Contribution{
 const c=empty(dateKey(asDate(o.data)||asDate(o.createdAt)||asDate(o.created_at)||new Date()));if(!isFinal(o.status))return c;
 c.sales=1;c.revenue=num(o.total);c.subtotal=num(o.subtotal);c.deliveryFees=num(o.taxaEntrega);c.discounts=num(o.desconto);
 const pickup=key(o.tipoEntrega)==="pickup";c.pickup=pickup?1:0;c.delivery=pickup?0:1;
 const scheduled=o.isAgendamento===true;c.scheduled=scheduled?1:0;c.immediate+=scheduled?0:1;c.logisticsCompleted=o.deliveryOperationalCompleted===true?1:0;
 c.payments[key(o.metodoPagamento)]=c.revenue;c.origins.site=1;
 for(const raw of Array.isArray(o.itens)?o.itens:[]){if(!raw||typeof raw!=="object")continue;const i=raw as Record<string,unknown>;const name=text(i.name)||text(i.nome)||text(i.id)||"Item";const qty=Math.max(1,num(i.quantity||i.quantidade||1));c.products[name]=(c.products[name]||0)+qty}
 return c;
}
function daily(raw:Record<string,unknown>|undefined,k:string):Contribution{
 const r=raw||{};
 return{
  dateKey:k,
  sales:num(r.sales),
  revenue:num(r.revenue),
  subtotal:num(r.subtotal),
  deliveryFees:num(r.deliveryFees),
  discounts:num(r.discounts),
  delivery:num(r.delivery),
  pickup:num(r.pickup),
  scheduled:num(r.scheduled),
  immediate:num(r.immediate),
  logisticsCompleted:num(r.logisticsCompleted),
  payments:safeMap(r.payments),
  products:safeMap(r.products),
  origins:safeMap(r.origins),
 };
}
function normalizeContribution(raw:unknown,fallbackDateKey:string):Contribution|null{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))return null;
 const r=raw as Record<string,unknown>;
 return daily(r,text(r.dateKey)||fallbackDateKey);
}
function apply(a:Contribution,b:Contribution,sign:number):Contribution{return{...a,sales:a.sales+b.sales*sign,revenue:a.revenue+b.revenue*sign,subtotal:a.subtotal+b.subtotal*sign,deliveryFees:a.deliveryFees+b.deliveryFees*sign,discounts:a.discounts+b.discounts*sign,delivery:a.delivery+b.delivery*sign,pickup:a.pickup+b.pickup*sign,scheduled:a.scheduled+b.scheduled*sign,immediate:a.immediate+b.immediate*sign,logisticsCompleted:a.logisticsCompleted+b.logisticsCompleted*sign,payments:addMap(a.payments,b.payments,sign),products:addMap(a.products,b.products,sign),origins:addMap(a.origins,b.origins,sign)}}
const same=(a:Contribution,b:Contribution)=>JSON.stringify(a)===JSON.stringify(b);

async function persistState(stateRef:FirebaseFirestore.DocumentReference,next:Contribution,state:Record<string,unknown>){
 return adminDb.runTransaction(async tx=>{
  const ss=await tx.get(stateRef);
  const prev=ss.exists?normalizeContribution(ss.data()?.contribution,next.dateKey):null;
  if(prev&&same(prev,next)){tx.set(stateRef,{...state,updatedAt:new Date().toISOString()},{merge:true});return{projected:false,reason:"unchanged",dateKey:next.dateKey}}
  const keys=[...new Set([prev?.dateKey,next.dateKey].filter(Boolean) as string[])],refs=keys.map(k=>adminDb.collection(DAILY).doc(k)),snaps=await Promise.all(refs.map(r=>tx.get(r))),map=new Map<string,Contribution>();
  keys.forEach((k,i)=>map.set(k,daily(snaps[i].exists?snaps[i].data():undefined,k)));
  if(prev)map.set(prev.dateKey,apply(map.get(prev.dateKey)||empty(prev.dateKey),prev,-1));
  map.set(next.dateKey,apply(map.get(next.dateKey)||empty(next.dateKey),next,1));
  const now=new Date().toISOString();for(const[k,v]of map)tx.set(adminDb.collection(DAILY).doc(k),{...v,projectorVersion:PROJECTOR_VERSION,updatedAt:now},{merge:false});
  tx.set(stateRef,{...state,contribution:next,projectorVersion:PROJECTOR_VERSION,updatedAt:now},{merge:false});
  return{projected:true,dateKey:next.dateKey};
 });
}

export async function projectOrderById(orderId:string,sourceEventId?:string){
 const os=await adminDb.collection("Pedidos").doc(orderId).get();if(!os.exists)return{projected:false,reason:"order_not_found"};
 const next=contribution(os.data()||{});
 return persistState(adminDb.collection(STATE).doc(encodeURIComponent(orderId)),next,{orderId,authority:"dfl_site",businessKey:`dfl_site:order:${orderId}`,lastSourceEventId:sourceEventId||null});
}

export async function projectEntregasNativeDeliveryEvent(event:{entity_id?:unknown;event_id?:unknown;occurred_at?:unknown;payload?:Record<string,unknown>;}){
 const deliveryId=text(event.entity_id),p=(event.payload&&typeof event.payload==="object"?event.payload:{}) as Record<string,unknown>;if(!deliveryId)return{projected:false,reason:"missing_delivery_id"};if(p.analyticsNativeDelivery!==true)return{projected:false,reason:"not_native_analytics"};
 const next=empty(dateKey(asDate(p.completedAt)||asDate(p.createdAt)||asDate(event.occurred_at)||asDate(p.updatedAt)||new Date()));
 const siteOwned=Boolean(text(p.externalOrderId)||text(p.external_order_id)||key(p.externalOrderSource)==="dfl_site"||key(p.sourceSystem)==="dfl_site");
 if(!siteOwned&&p.completed===true){
  const revenue=num(p.customerCharge??p.value);next.sales=1;next.revenue=revenue;next.subtotal=revenue;next.logisticsCompleted=1;
  const fulfillment=key(p.fulfillmentMode);if(fulfillment==="pickup"||fulfillment==="retirada")next.pickup=1;else next.delivery=1;
  next.immediate=1;next.payments[key(p.paymentMethod)]=revenue;next.origins[key(p.origin)||"manual"]=1;
 }
 return persistState(adminDb.collection(STATE).doc(encodeURIComponent(`dfl_entregas:delivery:${deliveryId}`)),next,{orderId:null,deliveryId,authority:"dfl_entregas",businessKey:`dfl_entregas:delivery:${deliveryId}`,lastSourceEventId:text(event.event_id)||null});
}

export async function projectOrderEvent(event:{entity_id?:unknown;event_id?:unknown}){const id=text(event.entity_id);return id?projectOrderById(id,text(event.event_id)||undefined):{projected:false,reason:"missing_order_id"}}
export async function runAnalyticsBackfill(batchSize=80){
 if(backfillCompleteInProcess)return{complete:true,processed:0,cached:true};
 const ref=adminDb.collection(CHECKPOINTS).doc("site_orders_v3"),snap=await ref.get(),d=snap.data()||{};if(d.complete===true){backfillCompleteInProcess=true;return{complete:true,processed:0,cached:false}}
 const size=Math.max(10,Math.min(150,batchSize));let q=adminDb.collection("Pedidos").orderBy(FieldPath.documentId()).limit(size);const cursor=text(d.lastDocumentId);if(cursor)q=q.startAfter(cursor);
 const page=await q.get();let processed=0,last=cursor;for(const doc of page.docs){await projectOrderById(doc.id,"backfill-v3");processed++;last=doc.id}
 const complete=page.size<size;await ref.set({projectorVersion:PROJECTOR_VERSION,lastDocumentId:last||null,processedTotal:num(d.processedTotal)+processed,complete,updatedAt:new Date().toISOString(),completedAt:complete?new Date().toISOString():null},{merge:true});if(complete)backfillCompleteInProcess=true;
 return{complete,processed,lastDocumentId:last||null};
}
