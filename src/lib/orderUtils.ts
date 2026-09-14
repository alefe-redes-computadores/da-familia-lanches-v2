import { orderDateToDate, paymentLabel } from "./orderCompat";

export const formatarData = (data: unknown) => {
  const date = orderDateToDate(data);
  if (!date) return "--/-- --:--";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const normalizarStatus = (status?: string) => {
  if (!status) return "Pendente";
  const s = String(status).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (s.includes("agend")) return "Agendado";
  if (s.includes("pendente")) return "Pendente";
  if (s.includes("producao")) return "Em Produção";
  if (s.includes("pronto")) return "Pronto";
  if (s.includes("saiu") || s.includes("entrega")) return "Saiu para Entrega";
  if (s.includes("final") || s.includes("conclu")) return "Finalizado";
  if (s.includes("cancel")) return "Cancelado";
  return "Pendente";
};

export const getColorByStatus = (status?: string) => {
  const s = normalizarStatus(status);
  if (s === "Agendado") return "#7e57c2";
  if (s === "Pendente") return "#ff9800";
  if (s === "Em Produção") return "#ffca28";
  if (s === "Pronto") return "#4caf50";
  if (s === "Saiu para Entrega") return "#2196f3";
  if (s === "Cancelado") return "#ef5350";
  return "#8d8d8d";
};

export const formatarPagamento = paymentLabel;

export const avisarWhatsApp = (telefone: string, nome: string, status: string) => {
  if (typeof window === "undefined" || !telefone) return;
  let foneLimpo = telefone.replace(/\D/g, "");
  if (!foneLimpo) return;
  if (!foneLimpo.startsWith("55")) foneLimpo = `55${foneLimpo}`;

  const mensagens: Record<string, string> = {
    Pronto: `Olá ${nome || ""}! Seu pedido da Família Lanches está PRONTO para retirada! 🥡🔥`,
    "Saiu para Entrega": `Olá ${nome || ""}! Seu pedido da Família Lanches SAIU para entrega com o motoboy! 🛵💨`,
  };

  const texto = encodeURIComponent(mensagens[status] || `Olá ${nome || ""}! Seu pedido está sendo atualizado.`);
  window.open(`https://api.whatsapp.com/send?phone=${foneLimpo}&text=${texto}`, "_blank", "noopener,noreferrer");
};
