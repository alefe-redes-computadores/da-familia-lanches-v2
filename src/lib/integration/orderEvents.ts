// src/lib/integration/orderEvents.ts

import {
  buildIntegrationEvent,
  type IntegrationEventEnvelope,
} from "./contracts";
import {
  integrationEventId,
} from "./idempotency";

export type DflSiteOrderEventPayloadV1 = {
  orderId: string;
  sourceSystem: "dfl_site";
  orderSchemaVersion: number;
  userId: string;
  customerSnapshot: {
    id: string;
    name: string;
    email: string;
    phone: string;
    phoneE164: string;
  } | null;
  tipoEntrega: "delivery" | "pickup";
  deliverySnapshot: {
    cep: string;
    street: string;
    number: string;
    district: string;
    complement: string;
    reference: string;
  } | null;
  itens: unknown[];
  subtotal: number;
  taxaEntrega: number;
  desconto: number;
  cupom: string | null;
  rewardId: string | null;
  total: number;
  metodoPagamento: string;
  trocoPara: string | null;
  status: string;
  isAgendamento: boolean;
  statusUpdatedAt: string | null;
};

const objectValue = (
  value: unknown,
): Record<string, unknown> =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const text = (
  value: unknown,
) => String(value ?? "").trim();

const money = (
  value: unknown,
) => {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount
    : 0;
};

const nullableText = (
  value: unknown,
) => {
  const normalized = text(value);
  return normalized || null;
};

const customerSnapshotFromOrder = (
  raw: Record<string, unknown>,
): DflSiteOrderEventPayloadV1["customerSnapshot"] => {
  const customer =
    objectValue(raw.customerSnapshot);

  const id =
    text(customer.id) ||
    text(raw.userId);

  if (!id) return null;

  return {
    id,
    name:
      text(customer.name) ||
      text(raw.userName),
    email:
      text(customer.email) ||
      text(raw.userEmail),
    phone:
      text(customer.phone) ||
      text(raw.userPhone),
    phoneE164:
      text(customer.phoneE164),
  };
};

const deliverySnapshotFromOrder = (
  raw: Record<string, unknown>,
  tipoEntrega: "delivery" | "pickup",
): DflSiteOrderEventPayloadV1["deliverySnapshot"] => {
  if (tipoEntrega === "pickup") {
    return null;
  }

  const delivery =
    objectValue(raw.deliverySnapshot);

  return {
    cep: text(delivery.cep),
    street: text(delivery.street),
    number: text(delivery.number),
    district: text(delivery.district),
    complement:
      text(delivery.complement),
    reference:
      text(delivery.reference),
  };
};

export function buildDflSiteOrderPayloadV1(
  orderId: string,
  rawOrder: Record<string, unknown>,
  overrides?: {
    status?: string;
    statusUpdatedAt?: string | null;
  },
): DflSiteOrderEventPayloadV1 {
  const tipoEntrega =
    rawOrder.tipoEntrega === "pickup"
      ? "pickup"
      : "delivery";

  return {
    orderId,
    sourceSystem: "dfl_site",
    orderSchemaVersion:
      Number(rawOrder.orderSchemaVersion) ||
      2,
    userId: text(rawOrder.userId),
    customerSnapshot:
      customerSnapshotFromOrder(rawOrder),
    tipoEntrega,
    deliverySnapshot:
      deliverySnapshotFromOrder(
        rawOrder,
        tipoEntrega,
      ),
    itens: Array.isArray(rawOrder.itens)
      ? rawOrder.itens
      : [],
    subtotal: money(rawOrder.subtotal),
    taxaEntrega:
      money(rawOrder.taxaEntrega),
    desconto: money(rawOrder.desconto),
    cupom: nullableText(rawOrder.cupom),
    rewardId:
      nullableText(rawOrder.rewardId),
    total: money(rawOrder.total),
    metodoPagamento:
      text(rawOrder.metodoPagamento),
    trocoPara:
      nullableText(rawOrder.trocoPara),
    status:
      overrides?.status ??
      text(rawOrder.status),
    isAgendamento:
      rawOrder.isAgendamento === true,
    statusUpdatedAt:
      overrides?.statusUpdatedAt ??
      null,
  };
}

export function buildOrderCreatedEvent(
  input: {
    orderId: string;
    order: Record<string, unknown>;
    occurredAt: string;
  },
): IntegrationEventEnvelope<DflSiteOrderEventPayloadV1> {
  return buildIntegrationEvent({
    event_id: integrationEventId({
      event_type: "order.created",
      entity_id: input.orderId,
      occurrence_id: "created",
    }),
    event_type: "order.created",
    occurred_at: input.occurredAt,
    source_system: "dfl_site",
    entity_type: "order",
    entity_id: input.orderId,
    payload:
      buildDflSiteOrderPayloadV1(
        input.orderId,
        input.order,
      ),
  });
}

export function buildOrderUpdatedEvent(
  input: {
    orderId: string;
    order: Record<string, unknown>;
    status: string;
    occurredAt: string;
    occurrenceId: string;
  },
): IntegrationEventEnvelope<DflSiteOrderEventPayloadV1> {
  return buildIntegrationEvent({
    event_id: integrationEventId({
      event_type: "order.updated",
      entity_id: input.orderId,
      occurrence_id:
        input.occurrenceId,
    }),
    event_type: "order.updated",
    occurred_at: input.occurredAt,
    source_system: "dfl_site",
    entity_type: "order",
    entity_id: input.orderId,
    payload:
      buildDflSiteOrderPayloadV1(
        input.orderId,
        input.order,
        {
          status: input.status,
          statusUpdatedAt:
            input.occurredAt,
        },
      ),
  });
}
