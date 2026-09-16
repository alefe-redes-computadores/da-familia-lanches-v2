import "server-only";
import { Timestamp, type DocumentReference } from "firebase-admin/firestore";
import { adminDb } from "./admin";
import type { IntegrationEventEnvelope } from "../contracts";

type ReverseEventType =
  | "delivery.assigned"
  | "delivery.out_for_delivery"
  | "delivery.position_changed"
  | "delivery.next_stop"
  | "delivery.completed"
  | "delivery.failed"
  | "route.started"
  | "route.reordered"
  | "route.completed";

type ReversePayload = {
  externalOrderId: string;
  externalOrderSource: "dfl_site";
  deliveryId: string;
  routeId?: string | null;
  routeName?: string | null;
  motoboyId?: string | null;
  motoboyName?: string | null;
  stopGroupId?: string | null;
  stopPosition?: number | null;
  stopsAhead?: number | null;
  totalStops?: number | null;
  nextStop?: boolean;
  completedAt?: string | null;
  failedReason?: string | null;
};

export type ReverseIntegrationEvent = IntegrationEventEnvelope<ReversePayload> & {
  event_type: ReverseEventType;
};

const SUPPORTED = new Set<ReverseEventType>([
  "delivery.assigned",
  "delivery.out_for_delivery",
  "delivery.position_changed",
  "delivery.next_stop",
  "delivery.completed",
  "delivery.failed",
  "route.started",
  "route.reordered",
  "route.completed",
]);

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function optionalCount(value: unknown) {
  return value == null || (Number.isInteger(value) && Number(value) >= 0);
}

type CommercialStatus = "Agendado" | "Pendente" | "Em Produção" | "Pronto" | "Saiu para Entrega" | "Finalizado" | "Cancelado";
function projectionDecision(
  before: CommercialStatus,
  target: CommercialStatus | null,
  pickup: boolean,
) {
  if (
    !target ||
    pickup ||
    before === "Cancelado" ||
    before === "Finalizado" ||
    target === before
  ) {
    return { apply: false, deferred: false, reason: "not_applicable" as const };
  }

  // Os valores recebidos aqui já foram convertidos para CommercialStatus.
  // A projeção reversa é propositalmente mais restrita que a máquina manual:
  // logística só pode avançar as duas fronteiras que ela realmente comprova.
  if (before === "Pronto" && target === "Saiu para Entrega") {
    return { apply: true, deferred: false, reason: "ready_to_dispatch" as const };
  }

  if (before === "Saiu para Entrega" && target === "Finalizado") {
    return { apply: true, deferred: false, reason: "delivery_completed" as const };
  }

  return { apply: false, deferred: true, reason: "commercial_step_pending" as const };
}
function commercialStatus(value: unknown): CommercialStatus {
  if (typeof value !== "string" || !value.trim()) return "Pendente";

  // Mesma regra semântica usada pelo cliente, inclusive remoção correta
  // dos diacríticos de "Produção". Mantida local ao módulo server-only
  // para não puxar dependências client/Firebase para o runtime Admin.
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

  if (normalized.includes("agend")) return "Agendado";
  if (normalized.includes("pendente")) return "Pendente";
  if (normalized.includes("producao")) return "Em Produção";
  if (normalized.includes("pronto")) return "Pronto";
  if (normalized.includes("saiu") || normalized.includes("entrega")) return "Saiu para Entrega";
  if (normalized.includes("final") || normalized.includes("conclu")) return "Finalizado";
  if (normalized.includes("cancel")) return "Cancelado";
  return "Pendente";
}
function projectedStatus(type: ReverseEventType): CommercialStatus | null {
  if (["delivery.out_for_delivery","delivery.position_changed","delivery.next_stop","route.started"].includes(type)) return "Saiu para Entrega";
  if (type === "delivery.completed") return "Finalizado";
  return null;
}
function rewardCode(userId:string,milestone:number){return `DFL${userId.replace(/[^a-z0-9]/gi,"").slice(0,5).toUpperCase()}${String(milestone).padStart(2,"0")}`;}
function positive(value:unknown,fallback:number,min=0){const n=Number(value);return Number.isFinite(n)&&n>=min?n:fallback;}

export function assertReverseIntegrationEvent(
  event: IntegrationEventEnvelope,
): asserts event is ReverseIntegrationEvent {
  if (event.source_system !== "dfl_entregas") throw new Error("source_system reverso inválido.");
  if (!SUPPORTED.has(event.event_type as ReverseEventType)) throw new Error(`event_type reverso não suportado: ${event.event_type}`);
  if (!event.payload || typeof event.payload !== "object") throw new Error("Payload reverso ausente.");

  const p = event.payload as Record<string, unknown>;
  if (!nonEmpty(p.externalOrderId)) throw new Error("externalOrderId ausente.");
  if (p.externalOrderSource !== "dfl_site") throw new Error("externalOrderSource inválido.");
  if (!nonEmpty(p.deliveryId)) throw new Error("deliveryId ausente.");
  if (!optionalCount(p.stopPosition) || !optionalCount(p.stopsAhead) || !optionalCount(p.totalStops)) {
    throw new Error("Contadores de parada inválidos.");
  }
}

function eventClock(event: ReverseIntegrationEvent) {
  const time = Date.parse(event.occurred_at);
  if (!Number.isFinite(time)) throw new Error("occurred_at reverso inválido.");
  return { iso: new Date(time).toISOString(), time };
}

export async function consumeDflEntregasEvent(event: ReverseIntegrationEvent) {
  const inboxRef = adminDb.collection("integration_inbox").doc(encodeURIComponent(event.event_id));
  const orderRef = adminDb.collection("Pedidos").doc(event.payload.externalOrderId);
  const now = new Date().toISOString();

  return adminDb.runTransaction(async (tx) => {
    const [inboxSnap, orderSnap] = await Promise.all([tx.get(inboxRef), tx.get(orderRef)]);

    if (inboxSnap.exists && inboxSnap.data()?.status === "processed") {
      return { already_processed: true, orderId: event.payload.externalOrderId, applied: false, stale_ignored: false };
    }
    if (!orderSnap.exists) throw new Error("Pedido do Site não encontrado para evento reverso.");

    const order = orderSnap.data() || {};
    if (String(order.sourceSystem || "") !== "dfl_site") throw new Error("Pedido não pertence ao contrato dfl_site.");

    const incoming = eventClock(event);
    const currentIso =
      typeof order.deliveryTrackingLastEventAt === "string"
        ? order.deliveryTrackingLastEventAt
        : "";
    const currentTime = currentIso ? Date.parse(currentIso) : Number.NaN;
    const currentEventId =
      typeof order.deliveryTrackingLastEventId === "string"
        ? order.deliveryTrackingLastEventId
        : "";

    const winsByClock =
      !Number.isFinite(currentTime) ||
      incoming.time > currentTime ||
      (incoming.time === currentTime && event.event_id.localeCompare(currentEventId) > 0);

    // Conclusão logística é terminal para o tracking desta entrega.
    // Evento tardio de posição/próxima parada não pode ressuscitá-la.
    const operationalAlreadyCompleted =
      order.deliveryOperationalCompleted === true ||
      nonEmpty(order.deliveryOperationalCompletedAt) ||
      order.deliveryTrackingEvent === "delivery.completed";
    const trackingResurrection =
      operationalAlreadyCompleted && event.event_type !== "delivery.completed";
    const wins = winsByClock && !trackingResurrection;

    const beforeStatus = commercialStatus(order.status);
    const targetStatus = wins ? projectedStatus(event.event_type) : null;
    const pickup = order.tipoEntrega === "pickup";
    const projection = projectionDecision(beforeStatus, targetStatus, pickup);
    const statusChanged = projection.apply;
    const projectionDeferred = Boolean(wins && projection.deferred);

    let rewardWrite: { ref: DocumentReference; data: Record<string, unknown> } | null = null;
    if (statusChanged && targetStatus === "Finalizado") {
      const userId=String(order.userId??"").trim();
      if(userId){
        const configRef=adminDb.collection("RecompensasConfig").doc("loyalty");
        const configSnap=await tx.get(configRef); const cfg=configSnap.exists?(configSnap.data()||{}):{};
        if(configSnap.exists&&cfg.active===true){
          const every=Math.max(1,Math.floor(positive(cfg.everyOrders,5,1)));
          const ordersSnap=await tx.get(adminDb.collection("Pedidos").where("userId","==",userId));
          const completed=ordersSnap.docs.filter(d=>d.id!==event.payload.externalOrderId&&commercialStatus(d.data().status)==="Finalizado").length+1;
          if(completed>0&&completed%every===0){
            const milestone=completed/every; const ref=adminDb.collection("Usuarios").doc(userId).collection("RecompensasRecebidas").doc(`loyalty-${milestone}`);
            const old=await tx.get(ref);
            if(!old.exists){
              const days=Math.max(0,Math.floor(positive(cfg.expiresDays,30,0)));
              rewardWrite={ref,data:{campaignId:"loyalty",code:rewardCode(userId,milestone),title:String(cfg.title??"Fidelidade Da Família"),description:String(cfg.description??"Benefício liberado por pedidos finalizados."),discountType:cfg.discountType==="percent"?"percent":"fixed",discountValue:positive(cfg.discountValue,10,.01),minOrder:positive(cfg.minOrder,0),milestone,completedOrdersAtAward:completed,used:false,usedOrderId:null,usedAt:null,earnedAt:Timestamp.fromMillis(incoming.time),expiresAt:days?Timestamp.fromMillis(Date.now()+days*86400000):null}};
            }
          }
        }
      }
    }

    if (wins) {
      const p = event.payload;
      tx.update(orderRef, {
        deliveryTrackingEvent: event.event_type,
        deliveryTrackingLastEventAt: incoming.iso,
        deliveryTrackingLastEventId: event.event_id,
        deliveryTrackingUpdatedAt: now,
        deliveryId: p.deliveryId,
        deliveryRouteId: p.routeId ?? null,
        deliveryRouteName: p.routeName ?? null,
        deliveryMotoboyId: p.motoboyId ?? null,
        deliveryMotoboyName: p.motoboyName ?? null,
        deliveryStopGroupId: p.stopGroupId ?? null,
        deliveryStopPosition: p.stopPosition ?? null,
        deliveryStopsAhead: p.stopsAhead ?? null,
        deliveryTotalStops: p.totalStops ?? null,
        deliveryIsNextStop: p.nextStop === true,
        deliveryCompletedAt: p.completedAt ?? null,
        deliveryFailedReason: p.failedReason ?? null,
        deliveryOperationalCompleted: event.event_type === "delivery.completed" ? true : (order.deliveryOperationalCompleted === true),
        deliveryOperationalCompletedAt: event.event_type === "delivery.completed" ? (p.completedAt ?? incoming.iso) : (order.deliveryOperationalCompletedAt ?? null),
        deliveryCommercialProjectionPending: projectionDeferred,
        deliveryCommercialProjectionTarget: projectionDeferred ? targetStatus : null,
        deliveryCommercialProjectionEventId: projectionDeferred ? event.event_id : null,
        deliveryCommercialProjectionEventType: projectionDeferred ? event.event_type : null,
        deliveryCommercialProjectionAt: projectionDeferred ? Timestamp.fromMillis(incoming.time) : null,
        ...(statusChanged && targetStatus ? {
          status: targetStatus,
          statusUpdatedAt: Timestamp.fromMillis(incoming.time),
          statusHistory: [...(Array.isArray(order.statusHistory)?order.statusHistory:[]), {status:targetStatus,at:Timestamp.fromMillis(incoming.time),source:"dfl_entregas",sourceEventId:event.event_id}],
          statusProjectionSource: "dfl_entregas", statusProjectionEventId:event.event_id, statusProjectionEventType:event.event_type, statusProjectionAt:Timestamp.fromMillis(incoming.time),
        } : {}),
      });
      if(rewardWrite) tx.set(rewardWrite.ref, rewardWrite.data);
    }

    if (wins) {
      const intentType = event.event_type === "delivery.next_stop" ? "delivery_next_stop"
        : event.event_type === "delivery.completed" ? "delivery_completed"
        : event.event_type === "delivery.failed" ? "delivery_failed"
        : event.event_type === "delivery.assigned" ? "delivery_assigned"
        : event.event_type === "delivery.position_changed" ? "delivery_position_changed"
        : null;
      if (intentType) {
        const intentId = encodeURIComponent(`intent-v1__${event.event_id}`);
        tx.set(adminDb.collection("integration_notification_intents").doc(intentId), {
          intent_id: `intent-v1__${event.event_id}`,
          intent_type: intentType,
          source_event_id: event.event_id,
          source_event_type: event.event_type,
          order_id: event.payload.externalOrderId,
          delivery_id: event.payload.deliveryId,
          stops_ahead: event.payload.stopsAhead ?? null,
          is_next_stop: event.payload.nextStop === true,
          status: "pending",
          schema_version: 1,
          created_at: now,
          updated_at: now,
        });
      }
    }

    tx.set(inboxRef, {
      event_id: event.event_id,
      event_type: event.event_type,
      source_system: event.source_system,
      entity_type: event.entity_type,
      entity_id: event.entity_id,
      schema_version: event.schema_version,
      received_at: now,
      processed_at: now,
      status: "processed",
      local_entity_type: "order",
      local_entity_id: event.payload.externalOrderId,
      processing_outcome: wins ? "applied" : (trackingResurrection ? "ignored_after_delivery_completed" : "ignored_stale"),
      incoming_event_at: incoming.iso,
      commercial_status_before: beforeStatus,
      commercial_status_after: statusChanged ? targetStatus : beforeStatus,
      commercial_status_changed: statusChanged,
      commercial_projection_deferred: projectionDeferred,
      commercial_projection_target: projectionDeferred ? targetStatus : null,
      commercial_projection_decision: projection.reason,
      commercial_projection_pickup: pickup,
      reward_awarded: Boolean(rewardWrite),
      ...(currentIso ? { previous_event_at: currentIso } : {}),
      ...(currentEventId ? { previous_event_id: currentEventId } : {}),
      updated_at: now,
    });

    return {
      already_processed: false,
      orderId: event.payload.externalOrderId,
      applied: wins,
      stale_ignored: !wins,
      commercial_status_changed: statusChanged,
      commercial_status: statusChanged ? targetStatus : beforeStatus,
      commercial_projection_deferred: projectionDeferred,
      commercial_projection_target: projectionDeferred ? targetStatus : null,
      commercial_projection_decision: projection.reason,
      reward_awarded: Boolean(rewardWrite),
    };
  });
}
