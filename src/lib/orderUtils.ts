// --- FUNÇÕES DE FORMATAÇÃO ---
export const formatarData = (data: any) => {
  if (!data) return "--/-- --:--";
  try {
    const d = data.toDate ? data.toDate() : new Date(data.seconds ? data.seconds * 1000 : data);
    return d.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (e) { return "--/-- --:--"; }
};

export const normalizarStatus = (status?: string) => {
  if (!status) return "Pendente";
  const s = String(status).toLowerCase().trim();
  if (s.includes("pendente")) return "Pendente";
  if (s.includes("produção")) return "Em Produção";
  if (s.includes("pronto")) return "Pronto";
  if (s.includes("saiu")) return "Saiu para Entrega";
  if (s.includes("final")) return "Finalizado";
  return "Pendente";
};

export const getColorByStatus = (status: string) => {
  const s = normalizarStatus(status);
  if (s === "Pendente") return "#ff9800";
  if (s === "Em Produção") return "#ffca28";
  if (s === "Pronto") return "#4caf50";
  if (s === "Saiu para Entrega") return "#2196f3";
  return "#eee";
};

// --- FUNÇÃO DE WHATSAPP ---
export const avisarWhatsApp = (telefone: string, nome: string, status: string) => {
  if (!telefone) return;
  let foneLimpo = telefone.replace(/\D/g, "");
  if (foneLimpo.length > 0 && !foneLimpo.startsWith("55")) foneLimpo = `55${foneLimpo}`;
  
  const mensagens: any = {
    "Pronto": `Olá ${nome}! Seu pedido da Família Lanches está PRONTO para retirada! 🥡🔥`,
    "Saiu para Entrega": `Olá ${nome}! Seu pedido da Família Lanches SAIU para entrega com o motoboy! 🛵💨`,
  };
  
  const texto = encodeURIComponent(mensagens[status] || `Olá ${nome}! Seu pedido está sendo atualizado.`);
  window.open(`https://api.whatsapp.com/send?phone=${foneLimpo}&text=${texto}`, "_blank");
};