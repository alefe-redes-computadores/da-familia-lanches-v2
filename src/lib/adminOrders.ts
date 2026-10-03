import { orderDateToMillis, normalizeText } from "./orderCompat";
import { normalizarStatus } from "./orderUtils";

export type AdminOrder = Record<string, any> & { id: string };

const ACTIVE = new Set(["Agendado", "Pendente", "Em Produção", "Pronto", "Saiu para Entrega"]);

export function isActiveAdminOrder(order: AdminOrder) {
  return ACTIVE.has(normalizarStatus(order.status));
}

export function orderCreatedTimestamp(order: AdminOrder) {
  return orderDateToMillis(order.data) || orderDateToMillis(order.createdAt);
}

export function orderOperationalTimestamp(order: AdminOrder) {
  return orderDateToMillis(order.statusUpdatedAt) || orderCreatedTimestamp(order);
}

export function orderHistoryTimestamp(order: AdminOrder) {
  return orderDateToMillis(order.statusUpdatedAt) || orderCreatedTimestamp(order);
}

export function orderAgeMinutes(order: AdminOrder, now = Date.now()) {
  const status = normalizarStatus(order.status);
  const stamp = status === "Finalizado" || status === "Cancelado"
    ? orderCreatedTimestamp(order)
    : orderOperationalTimestamp(order);
  return stamp > 0 ? Math.max(0, Math.floor((now - stamp) / 60000)) : null;
}

export function ageLabel(order: AdminOrder, now = Date.now()) {
  const status = normalizarStatus(order.status);
  if (status === "Agendado" && typeof order.scheduledFor === "string") {
    const scheduled = Date.parse(order.scheduledFor);
    if (Number.isFinite(scheduled)) {
      const diff = Math.ceil((scheduled - now) / 60000);
      if (diff <= 0) return "horário chegou";
      if (diff < 60) return `em ${diff} min`;
      if (diff < 1440) {
        const hours = Math.floor(diff / 60);
        const rest = diff % 60;
        return rest ? `em ${hours}h ${rest}min` : `em ${hours}h`;
      }
      return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      }).format(new Date(scheduled));
    }
  }
  const minutes = orderAgeMinutes(order, now);
  if (minutes == null) return "horário indisponível";
  if (minutes < 1) return "atualizado agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `há ${hours}h ${rest}min` : `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days === 1 ? "" : "s"}`;
}

export function operationalAttention(order: AdminOrder, now = Date.now()) {
  const status = normalizarStatus(order.status);
  if (status === "Agendado" || status === "Finalizado" || status === "Cancelado") return null;
  const minutes = orderAgeMinutes(order, now);
  if (minutes == null || minutes < 30) return null;

  if (status === "Pendente") {
    return {
      level: minutes >= 60 ? "high" : "medium",
      label: minutes >= 60
        ? "Aguardando aceite há mais de 1h"
        : "Aguardando aceite há mais de 30 min",
    } as const;
  }

  return {
    level: minutes >= 60 ? "high" : "medium",
    label: minutes >= 60
      ? "Sem atualização há mais de 1h"
      : "Sem atualização há mais de 30 min",
  } as const;
}

export function adminOrderSearchText(order: AdminOrder) {
  const address = order.deliverySnapshot && typeof order.deliverySnapshot === "object"
    ? Object.values(order.deliverySnapshot).join(" ")
    : "";
  const customer = order.customerSnapshot && typeof order.customerSnapshot === "object"
    ? Object.values(order.customerSnapshot).join(" ")
    : "";
  return normalizeText([
    order.id,
    order.userName,
    order.userEmail,
    order.userPhone,
    order.phone,
    order.endereco,
    order.metodoPagamento,
    order.scheduledFor,
    order.scheduledLabel,
    address,
    customer,
  ].join(" "));
}

const priority: Record<string, number> = {
  "Pronto": 0,
  "Pendente": 1,
  "Em Produção": 2,
  "Saiu para Entrega": 3,
  "Agendado": 4,
  "Finalizado": 5,
  "Cancelado": 6,
};

export function compareOperationalOrders(a: AdminOrder, b: AdminOrder) {
  const sa = normalizarStatus(a.status);
  const sb = normalizarStatus(b.status);
  const pa = priority[sa] ?? 99;
  const pb = priority[sb] ?? 99;
  if (pa !== pb) return pa - pb;

  if (sa === "Agendado" && sb === "Agendado") {
    const aa = Date.parse(String(a.scheduledFor ?? ""));
    const bb = Date.parse(String(b.scheduledFor ?? ""));
    if (Number.isFinite(aa) && Number.isFinite(bb) && aa !== bb) return aa - bb;
  }

  // Em filas ativas, o registro operacional mais antigo aparece primeiro.
  if (isActiveAdminOrder(a) && isActiveAdminOrder(b)) {
    return orderOperationalTimestamp(a) - orderOperationalTimestamp(b);
  }
  return orderHistoryTimestamp(b) - orderHistoryTimestamp(a) ||
    String(b.id).localeCompare(String(a.id));
}
