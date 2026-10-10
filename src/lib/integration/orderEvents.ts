// src/lib/integration/orderEvents.ts

import {
  buildIntegrationEvent,
  type IntegrationEventEnvelope,
} from "./contracts";
import {
  integrationEventId,
} from "./idempotency";
import { products as fallbackProducts } from "@/data/products";
import { resolveBundleItems } from "@/lib/catalogComposition";

export type DflSiteOrderItemSnapshotV1 = {
  id: string; name: string; quantity: number; unitPrice: number; lineTotal: number;
  category: string | null;
  detailsTitle: string | null; detailsItems: string[]; includedExtras: string | null;
  components: { id: string; name: string; category: string | null; quantity: number; origin: "included_in_bundle"; note: string | null }[];
  selectedAddons: { id: string; name: string; price: number }[]; observation: string | null;
};

export type DflSiteOrderEventPayloadV1 = {
  orderId: string;
  sourceSystem: "dfl_site";
  orderSchemaVersion: number;
  userId: string;
  customerMode: "google" | "guest";
  checkoutChannel: "site" | "whatsapp";
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
  itens: DflSiteOrderItemSnapshotV1[];
  subtotal: number;
  taxaEntrega: number;
  desconto: number;
  cupom: string | null;
  rewardId: string | null;
  total: number;
  originalTotal: number;
  metodoPagamento: string;
  trocoPara: string | null;
  observacao: string | null;
  status: string;
  cancelReasonCode?: string | null;
  cancelReasonLabel?: string | null;
  cancelPublicMessage?: string | null;
  cancelItemProductIds?: string[];
  isAgendamento: boolean;
  scheduledFor: string | null;
  scheduledLabel: string | null;
  scheduleWindowMinutes: number | null;
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

const money = (value: unknown) => {
  const amount=Number(value);
  return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) / 100 : 0;
};

const deliveryProjectedTotal = (value: unknown) => Math.ceil(money(value));

const nullableText = (
  value: unknown,
) => {
  const normalized = text(value);
  return normalized || null;
};

const orderItemsSnapshot = (value: unknown): DflSiteOrderItemSnapshotV1[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    const item = objectValue(raw); const id = text(item.id); const name = text(item.name);
    if (!id || !name) return [];
    const quantity = Math.max(1, Math.trunc(money(item.quantity) || 1));
    const unitPrice = Math.max(0, money(item.price));
    const detailsItems = Array.isArray(item.detailsItems) ? item.detailsItems.map(text).filter(Boolean) : [];
    const selectedAddons = Array.isArray(item.selectedAddons) ? item.selectedAddons.flatMap((rawAddon) => {
      const addon = objectValue(rawAddon); const addonId = text(addon.id); const addonName = text(addon.name);
      return addonId && addonName ? [{ id: addonId, name: addonName, price: Math.max(0, money(addon.price)) }] : [];
    }) : [];
    const fallback=fallbackProducts.find((product)=>product.id===id);
    const productForComposition={...(fallback??{}),...item,id,name,quantity,price:unitPrice,category:text(item.category)||fallback?.category||""} as typeof fallbackProducts[number];
    const components=resolveBundleItems(productForComposition,fallbackProducts).flatMap((component)=>component.product?[{id:component.product.id,name:component.product.name,category:component.product.category||null,quantity:component.quantity*quantity,origin:"included_in_bundle" as const,note:component.note??null}]:[]);
    return [{ id, name, quantity, unitPrice, lineTotal: money(unitPrice * quantity), category:text(item.category)||fallback?.category||null, detailsTitle: nullableText(item.detailsTitle), detailsItems, includedExtras: nullableText(item.includedExtras), components, selectedAddons, observation: nullableText(item.observation) }];
  });
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
    customerMode: rawOrder.customerMode === "guest" ? "guest" : "google",
    checkoutChannel: rawOrder.checkoutChannel === "whatsapp" ? "whatsapp" : "site",
    customerSnapshot:
      customerSnapshotFromOrder(rawOrder),
    tipoEntrega,
    deliverySnapshot:
      deliverySnapshotFromOrder(
        rawOrder,
        tipoEntrega,
      ),
    itens: orderItemsSnapshot(rawOrder.itens),
    subtotal: money(rawOrder.subtotal),
    taxaEntrega:
      money(rawOrder.taxaEntrega),
    desconto: money(rawOrder.desconto),
    cupom: nullableText(rawOrder.cupom),
    rewardId:
      nullableText(rawOrder.rewardId),
    total: deliveryProjectedTotal(rawOrder.total),
    originalTotal: money(rawOrder.total),
    metodoPagamento:
      text(rawOrder.metodoPagamento),
    trocoPara:
      nullableText(rawOrder.trocoPara),
    observacao:
      nullableText(rawOrder.observacao),
    status:
      overrides?.status ??
      text(rawOrder.status),
    cancelReasonCode: nullableText(rawOrder.cancelReasonCode),
    cancelReasonLabel: nullableText(rawOrder.cancelReasonLabel),
    cancelPublicMessage: nullableText(rawOrder.cancelPublicMessage),
    cancelItemProductIds: Array.isArray(rawOrder.cancelItemProductIds)
      ? rawOrder.cancelItemProductIds.map((value) => text(value)).filter(Boolean)
      : [],
    isAgendamento:
      rawOrder.isAgendamento === true,
    scheduledFor: nullableText(rawOrder.scheduledFor),
    scheduledLabel: nullableText(rawOrder.scheduledLabel),
    scheduleWindowMinutes: rawOrder.isAgendamento === true ? Math.max(0, Math.trunc(money(rawOrder.scheduleWindowMinutes) || 30)) : null,
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
