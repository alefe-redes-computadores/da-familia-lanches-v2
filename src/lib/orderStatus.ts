import { Timestamp } from "firebase/firestore";
import { normalizarStatus } from "./orderUtils";

export type CanonicalOrderStatus = "Agendado" | "Pendente" | "Em Produção" | "Pronto" | "Saiu para Entrega" | "Finalizado" | "Cancelado";
export type StatusHistoryEntry = { status: string; at?: unknown };

export const ORDER_FLOW: CanonicalOrderStatus[] = ["Pendente", "Em Produção", "Pronto", "Saiu para Entrega", "Finalizado"];

export function statusTitle(status?: string, pickup = false) {
  const s = normalizarStatus(status);
  if (s === "Agendado") return "Pedido agendado";
  if (s === "Pendente") return "Pedido recebido";
  if (s === "Em Produção") return "Em preparo";
  if (s === "Pronto") return pickup ? "Pronto para retirada" : "Pedido pronto";
  if (s === "Saiu para Entrega") return "Saiu para entrega";
  if (s === "Finalizado") return pickup ? "Pedido retirado" : "Pedido entregue";
  if (s === "Cancelado") return "Pedido cancelado";
  return s;
}

export function statusDescription(status?: string, pickup = false) {
  const s = normalizarStatus(status);
  if (s === "Agendado") return "A loja recebeu o pedido para o próximo período de atendimento.";
  if (s === "Pendente") return "Recebemos seu pedido e ele aguarda confirmação da equipe.";
  if (s === "Em Produção") return "A cozinha já está preparando seu pedido.";
  if (s === "Pronto") return pickup ? "Seu pedido está pronto no balcão." : "Seu pedido está pronto e aguarda despacho.";
  if (s === "Saiu para Entrega") return "O pedido está a caminho do endereço informado.";
  if (s === "Finalizado") return pickup ? "Retirada concluída. Obrigado por pedir com a gente." : "Entrega concluída. Obrigado por pedir com a gente.";
  if (s === "Cancelado") return "Este pedido foi cancelado.";
  return "Acompanhe as atualizações do seu pedido por aqui.";
}

export function statusProgress(status?: string, pickup = false) {
  const s = normalizarStatus(status);
  if (s === "Agendado") return 8;
  if (s === "Pendente") return 18;
  if (s === "Em Produção") return 45;
  if (s === "Pronto") return pickup ? 82 : 68;
  if (s === "Saiu para Entrega") return 84;
  if (s === "Finalizado") return 100;
  return 0;
}

export function timelineSteps(pickup = false) {
  return pickup
    ? ["Pendente", "Em Produção", "Pronto", "Finalizado"] as CanonicalOrderStatus[]
    : ORDER_FLOW;
}

export function statusReached(current: string | undefined, step: CanonicalOrderStatus, pickup = false) {
  const normalized = normalizarStatus(current);
  if (normalized === "Cancelado" || normalized === "Agendado") return false;
  const flow = timelineSteps(pickup);
  return flow.indexOf(normalized as CanonicalOrderStatus) >= flow.indexOf(step);
}

export function historyEntry(status: string) {
  return { status: normalizarStatus(status), at: Timestamp.now() };
}
