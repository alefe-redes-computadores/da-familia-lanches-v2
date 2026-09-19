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
type ClaimedRaw = { docId: string; data: Record<string, unknown> };

const COLLECTION = "integration_notification_intents";
const LOCK_TTL_MS = 5 * 60 * 1000;
const text = (v: unknown) => String(v ?? "").trim();
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};

function millis(v: unknown): number | null {
  if (typeof v === "string") {
    const n = Date.parse(v);
    return Number.isFinite(n) ? n : null;
  }
  if (v && typeof v === "object" && "toMillis" in v &&
      typeof (v as {toMillis?: unknown}).toMillis === "function") {
    try { return (v as {toMillis:()=>number}).toMillis(); } catch { return null; }
  }
  return null;
}

function commercialType(event: IntegrationEventEnvelope): DflMessagingEventType | null {
  if (event.event_type === "order.created") return "order.created";
  if (event.event_type !== "order.updated") return null;
  const payload = obj(event.payload);
  const n = text(payload.status).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (n.includes("producao")) return "order.production";
  if (n === "pronto") return "order.ready";
  if (n.includes("cancel")) return "order.cancelled";
  return null;
}

export async function ensureCommercialMessagingIntent(event: IntegrationEventEnvelope) {
  const eventType = commercialType(event);
  if (!eventType) return {created:false, reason:"not_messaging_event" as const};
  const payload = obj(event.payload);
  const customer = obj(payload.customerSnapshot);
  const orderId = text(payload.orderId) || text(event.entity_id);
  if (!orderId) return {created:false, reason:"missing_order" as const};

  const ref = adminDb.collection(COLLECTION).doc(
    encodeURIComponent(`intent-msg-v1__${event.event_id}`)
  );
  const now = new Date().toISOString();
  try {
    await ref.create({
      intent_id:`intent-msg-v1__${event.event_id}`,
      intent_type:"commercial_message",
      source_event_id:event.event_id,
      source_event_type:event.event_type,
      messaging_event_type:eventType,
      messaging_source:"site",
      messaging_eligible:true,
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
  } catch (error) {
    const code = text((error as {code?:unknown}|null)?.code).toLowerCase();
    if (code === "6" || code.includes("already") || code.includes("exists"))
      return {created:false, reason:"exists" as const};
    throw error;
  }
}

function reverseType(v: unknown): DflMessagingEventType | null {
  switch (text(v)) {
    case "delivery_started": return "delivery.started";
    case "delivery_next_stop": return "delivery.next_stop";
    // Mudança interna de posição continua sendo persistida para tracking,
    // mas não vira mensagem automática. Isso evita spam a cada reordenação
    // ou conclusão anterior. O aviso especial é exclusivamente next_stop.
    case "delivery_position_changed": return null;
    case "delivery_completed": return "delivery.completed";
    case "delivery_failed": return "delivery.failed";
    default: return null;
  }
}

async function hydrate(docId:string, data:Record<string,unknown>):Promise<Projection|null> {
  if (data.messaging_eligible !== true) return null;
  const source = text(data.messaging_source) === "site" ? "site" : "entregas";
  const eventType =
    (text(data.messaging_event_type) as DflMessagingEventType) || reverseType(data.intent_type);
  if (!eventType) return null;
  const orderId = text(data.order_id);
  if (!orderId) return null;

  let phone = text(data.customer_phone);
  let name = text(data.customer_name) || null;
  let total = Number(data.total) || 0;
  let order: Record<string,unknown> = {};

  // O pedido continua sendo a autoridade comercial. Hidratamos o snapshot
  // completo para a mensagem inicial usar os mesmos dados do checkout.
  const orderSnap = await adminDb.collection("Pedidos").doc(orderId).get();
  if (orderSnap.exists) {
    order = orderSnap.data() as Record<string,unknown>;
    const customer = obj(order.customerSnapshot);
    phone = phone || text(customer.phoneE164) || text(customer.phone) || text(order.userPhone);
    name = name || text(customer.name) || text(order.userName) || null;
    total = total || Number(order.total) || 0;
  }
  if (!phone) return null;

  const delivery = obj(order.deliverySnapshot);
  const items = Array.isArray(order.itens) ? order.itens : [];
  const fulfillment = text(order.tipoEntrega) === "pickup" ? "pickup" : "delivery";

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
      items,
      payment_method:text(order.metodoPagamento)||null,
      change_for:order.trocoPara??null,

      // Messaging V12 — fatos comerciais opcionais.
      // Mantemos aliases tolerantes sem alterar o contrato do Pedido.
      payment_status:
        text(order.paymentStatus) ||
        text(order.statusPagamento) ||
        null,
      is_paid:
        order.isPaid === true ||
        order.pago === true ||
        ["paid","pago","approved","aprovado","confirmed","confirmado"]
          .includes(
            (
              text(order.paymentStatus) ||
              text(order.statusPagamento)
            ).toLowerCase()
          ),

      scheduled:
        order.isAgendamento === true ||
        order.isScheduled === true ||
        Boolean(
          order.scheduledFor ||
          order.scheduledAt ||
          order.dataAgendamento ||
          order.agendamento
        ),

      scheduled_for:
        order.scheduledFor ??
        order.scheduledAt ??
        order.dataAgendamento ??
        (
          order.agendamento &&
          typeof order.agendamento === "object" &&
          !Array.isArray(order.agendamento)
            ? (
                order.agendamento as Record<string,unknown>
              ).scheduledFor ??
              (
                order.agendamento as Record<string,unknown>
              ).dateTime ??
              (
                order.agendamento as Record<string,unknown>
              ).dataHora ??
              null
            : null
        ),

      fulfillment,
      address:fulfillment === "delivery" ? {
        street:text(delivery.street),
        number:text(delivery.number),
        district:text(delivery.district),
        complement:text(delivery.complement),
        reference:text(delivery.reference),
      } : null,
      delivery_fee:Number(order.taxaEntrega)||0,
      discount:Number(order.desconto)||0,
      delivery_id:data.delivery_id??null,
      stops_ahead:data.stops_ahead??null,
      is_next_stop:data.is_next_stop===true,
    },
  };
}

async function claimRawCandidate(docId:string, workerId:string):Promise<ClaimedRaw|null> {
  const ref = adminDb.collection(COLLECTION).doc(docId);
  return adminDb.runTransaction(async tx => {
    const fresh = await tx.get(ref);
    if (!fresh.exists) return null;
    const data = fresh.data() as Record<string,unknown>;
    if (data.messaging_eligible !== true) return null;
    const status = text(data.status);
    const lockedAt = millis(data.locked_at);
    const stale = status === "processing" && lockedAt !== null &&
      Date.now() - lockedAt >= LOCK_TTL_MS;
    if (status !== "pending" && !stale) return null;
    const now = new Date().toISOString();
    tx.update(ref,{
      status:"processing", locked_by:workerId, locked_at:now,
      attempts:Number(data.attempts||0)+1, updated_at:now,
      ...(stale ? {last_error:"Lock de processamento expirado e recuperado."} : {}),
    });
    return {docId, data:{...data,status:"processing",locked_by:workerId,locked_at:now}};
  });
}

async function releaseUnhydratable(raw:ClaimedRaw, workerId:string) {
  const ref = adminDb.collection(COLLECTION).doc(raw.docId);
  await adminDb.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const data = snap.data() as Record<string,unknown>;
    if (data.status !== "processing" || data.locked_by !== workerId) return;
    const now = new Date().toISOString();
    tx.update(ref,{
      status:"pending", locked_by:null, locked_at:null, updated_at:now,
      last_error:"Intent elegível sem dados suficientes para projeção.",
    });
  });
}

export async function claimMessagingProjections(limit=20) {
  const safeLimit = Math.max(1,Math.min(50,Math.trunc(limit)));
  const workerId = randomUUID();
  const snap = await adminDb.collection(COLLECTION)
    .where("messaging_eligible","==",true)
    .limit(safeLimit*4).get();
  const claimed:Projection[] = [];

  for (const candidate of snap.docs) {
    if (claimed.length >= safeLimit) break;
    const raw = await claimRawCandidate(candidate.id,workerId);
    if (!raw) continue;
    const projection = await hydrate(raw.docId,raw.data);
    if (!projection) {
      await releaseUnhydratable(raw,workerId);
      continue;
    }
    claimed.push(projection);
  }
  return {worker_id:workerId,events:claimed};
}

export async function settleMessagingProjections(
  workerId:string,
  results:Array<{intent_id:string;ok:boolean;error?:string}>,
) {
  let settled=0;
  for (const result of results) {
    const ref = adminDb.collection(COLLECTION).doc(result.intent_id);
    await adminDb.runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data() as Record<string,unknown>;
      if (data.status !== "processing" || data.locked_by !== workerId) return;
      const now = new Date().toISOString();
      tx.update(ref,result.ok ? {
        status:"queued",
        messaging_queued_at:now,
        processed_at:now,
        updated_at:now,
        locked_by:null,
        locked_at:null,
        last_error:null,
      } : {
        status:"pending",
        updated_at:now,
        locked_by:null,
        locked_at:null,
        last_error:text(result.error).slice(0,500)||"Falha no relay de mensageria.",
      });
      settled += 1;
    });
  }
  return {settled};
}
