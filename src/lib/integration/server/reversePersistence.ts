import "server-only";
import { FieldValue } from "firebase-admin/firestore";
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

    const wins =
      !Number.isFinite(currentTime) ||
      incoming.time > currentTime ||
      (incoming.time === currentTime && event.event_id.localeCompare(currentEventId) > 0);

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
      });
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
      processing_outcome: wins ? "applied" : "ignored_stale",
      incoming_event_at: incoming.iso,
      ...(currentIso ? { previous_event_at: currentIso } : {}),
      ...(currentEventId ? { previous_event_id: currentEventId } : {}),
      updated_at: now,
    });

    return {
      already_processed: false,
      orderId: event.payload.externalOrderId,
      applied: wins,
      stale_ignored: !wins,
    };
  });
}
