"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  writeBatch
} from "firebase/firestore";
import { useAuthStore } from "@/store/auth.store";

// --- FUNÇÃO DE DATA REVISADA (Dia/Mês e Hora) ---
const formatarData = (data: any) => {
  if (!data) return "--/-- --:--";
  try {
    if (typeof data.toDate === 'function') {
      const d = data.toDate();
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    const d = new Date(data.seconds ? data.seconds * 1000 : data);
    return isNaN(d.getTime()) ? "--/-- --:--" : d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return "--/-- --:--";
  }
};

export default function AdminPage() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeOpen, setStoreOpen] = useState(true);
  const [tab, setTab] = useState<"cozinha" | "expedicao" | "concluidos">("cozinha");
  const { currentUser } = useAuthStore();
  const [alarmeAtivo, setAlarmeAtivo] = useState(false);

  const prevPedidosCount = useRef(0);
  const isFirstLoad = useRef(true);

  const admins = [
    "alefejohsefe@gmail.com",
    "kalebhstanley650@gmail.com",
    "contato@dafamilialanches.com.br"
  ];

  const controlarAlarme = (ligar: boolean) => {
    if (ligar) {
      setAlarmeAtivo(true);
      const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
      audio.play().catch(e => console.log("Aguardando interação para tocar som..."));

      setTimeout(() => {
        if (prevPedidosCount.current > 0) {
          controlarAlarme(true);
        } else {
          setAlarmeAtivo(false);
        }
      }, 4000);
    } else {
      setAlarmeAtivo(false);
    }
  };

  const avisarWhatsApp = (telefone: string, nome: string, status: string) => {
    if (!telefone) {
      alert("Atenção: Este pedido não possui número de telefone cadastrado.");
      return;
    }
    let foneLimpo = telefone.replace(/\D/g, "");
    if (foneLimpo.length > 0 && !foneLimpo.startsWith("55")) foneLimpo = `55${foneLimpo}`;
    
    const mensagens: any = {
      "Pronto": `Olá ${nome}! Seu pedido da Família Lanches está PRONTO para retirada! 🥡🔥`,
      "Saiu para Entrega": `Olá ${nome}! Seu pedido da Família Lanches SAIU para entrega com o motoboy! 🛵💨`,
    };

    const texto = encodeURIComponent(mensagens[status] || `Olá ${nome}! Seu pedido está sendo atualizado.`);
    const url = `https://api.whatsapp.com/send?phone=${foneLimpo}&text=${texto}`;
    window.open(url, "_blank");
  };

  const imprimirPedido = (pedido: any) => {
    const janela = window.open('', '', 'width=600,height=800');
    if (!janela) {
      alert("Por favor, libere os pop-ups para imprimir o cupom.");
      return;
    }

    const nomeCliente = pedido.userName || "Cliente não identificado";
    const endereco = pedido.endereco || "Endereço não informado";
    const itens = Array.isArray(pedido.itens) ? pedido.itens : [];

    const itensHtml = itens.map((item: any) => `
      <div style="border-bottom: 1px dashed #ccc; padding: 10px 0; font-size: 14px;">
        <div style="display: flex; justify-content: space-between;">
          <b>${item.quantity || 1}x ${item.name || "Item"}</b>
          <span>R$ ${(Number(item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
        </div>
        ${item.selectedAddons?.map((a: any) => `<div style="margin-left: 10px; font-size: 12px;">+ ${a.name}</div>`).join("") || ""}
      </div>
    `).join("");

    const conteudoCupom = `
      <html>
        <head><title>Cupom Família Lanches</title></head>
        <body style="font-family: 'Courier New', Courier, monospace; padding: 20px; color: #000;">
          <center>
            <h2 style="margin:0;">DA FAMÍLIA LANCHES</h2>
            <p style="margin:5px 0;">----------------------------</p>
            <p style="margin:0; font-weight:bold;">PEDIDO #${pedido.id ? pedido.id.slice(-4).toUpperCase() : "0000"}</p>
            <p style="margin:5px 0;">----------------------------</p>
          </center>
          <p><b>CLIENTE:</b> ${nomeCliente}</p>
          <p><b>TEL:</b> ${pedido.userPhone || "NÃO INFORMADO"}</p>
          <p><b>DATA:</b> ${formatarData(pedido.data)}</p>
          <p><b>ENTREGA:</b> ${pedido.tipoEntrega === 'pickup' ? 'RETIRADA' : 'ENTREGA'}</p>
          <p><b>ENDEREÇO:</b> ${endereco}</p>
          <p>----------------------------</p>
          <div style="margin: 10px 0;">${itensHtml || "<p>Nenhum item no pedido</p>"}</div>
          <p>----------------------------</p>
          <p><b>PAGAMENTO:</b> ${pedido.metodoPagamento?.toUpperCase() || "N/A"}</p>
          ${pedido.troco ? `<p><b>TROCO PARA:</b> ${pedido.troco}</p>` : ""}
          <p style="font-size: 20px; margin-top:10px;"><b>TOTAL: R$ ${Number(pedido.total || 0).toFixed(2)}</b></p>
          <p>----------------------------</p>
          <center><p style="font-size:12px;">Impresso em: ${new Date().toLocaleString()}</p></center>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `;

    janela.document.open();
    janela.document.write(conteudoCupom);
    janela.document.close();
  };
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      
      // Monitoramento para o alarme persistente
      const novosPedidosCount = docs.filter((p: any) => p.status === "Pendente" || !p.status).length;

      if (!isFirstLoad.current && novosPedidosCount > prevPedidosCount.current) {
        controlarAlarme(true);
      }

      if (novosPedidosCount === 0) setAlarmeAtivo(false);

      prevPedidosCount.current = novosPedidosCount;
      isFirstLoad.current = false;
      setPedidos(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;
    const unsub = onSnapshot(doc(db, "settings", "loja"), (snap) => {
      if (snap.exists()) setStoreOpen(snap.data().isOpen);
    });
    return () => unsub();
  }, [currentUser]);

  const updateStatus = async (id: string, newStatus: string, pedido?: any) => {
    try {
      await updateDoc(doc(db, "Pedidos", id), { status: newStatus });
      if (newStatus === "Pronto" && pedido?.tipoEntrega === "pickup") {
        avisarWhatsApp(pedido.userPhone, pedido.userName, "Pronto");
      } else if (newStatus === "Saiu para Entrega") {
        avisarWhatsApp(pedido.userPhone, pedido.userName, "Saiu para Entrega");
      }
    } catch (e) { 
      console.error("Erro ao atualizar:", e);
      alert("Erro ao atualizar status. Verifique sua conexão."); 
    }
  };

  const limparFinalizados = async () => {
    if (!confirm("Deseja arquivar todos os pedidos finalizados? Esta ação não pode ser desfeita.")) return;
    const batch = writeBatch(db);
    pedidos.filter(p => p.status === "Finalizado").forEach(p => {
      batch.delete(doc(db, "Pedidos", p.id));
    });
    await batch.commit();
  };

  const pedidosFiltrados = pedidos.filter(p => {
    const s = String(p.status || "Pendente").trim();
    if (tab === "cozinha") return s === "Pendente" || s === "Em Produção" || !p.status;
    if (tab === "expedicao") return s === "Pronto" || s === "Saiu para Entrega";
    return s === "Finalizado";
  });

  if (!currentUser || !admins.includes(currentUser.email!)) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "20px", fontFamily: "'Inter', sans-serif", backgroundColor: "#fcfcfc" }}>
        <div style={{ fontSize: "60px" }}>🔐</div>
        <h1 style={{ margin: 0, color: "#111" }}>Acesso Restrito</h1>
        <p style={{ color: "#666" }}>Esta área é exclusiva para administradores da Família Lanches.</p>
        <button onClick={() => window.location.href = "/"} style={{ padding: "12px 24px", borderRadius: "12px", border: "none", background: "#111", color: "#fff", fontWeight: "bold", cursor: "pointer" }}>Voltar para o Início</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto", fontFamily: "'Inter', sans-serif", backgroundColor: "#fcfcfc", minHeight: "100vh" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "40px", borderBottom: "1px solid #eee", paddingBottom: "30px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h1 style={{ fontSize: "32px", fontWeight: "900", margin: 0, color: "#111", letterSpacing: "-1px" }}>📟 Monitor da Família</h1>
            {alarmeAtivo && <span style={{ background: "#ff4444", color: "#fff", padding: "4px 12px", borderRadius: "50px", fontSize: "12px", fontWeight: "bold", animation: "pulse 1s infinite" }}>NOVO PEDIDO! 🔔</span>}
          </div>
          <div style={{ display: "flex", gap: "15px", marginTop: "20px", alignItems: "center", flexWrap: "wrap" }}>
            <button 
              onClick={() => updateDoc(doc(db, "settings", "loja"), { isOpen: !storeOpen })}
              style={{
                padding: "14px 28px", borderRadius: "14px", border: "none", fontWeight: "800", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "10px",
                background: storeOpen ? "#4caf50" : "#f44336", color: "#fff",
                boxShadow: "0 6px 20px rgba(0,0,0,0.1)", transition: "0.2s"
              }}
            >
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#fff", boxShadow: "0 0 10px #fff" }}></div>
              {storeOpen ? "LOJA ABERTA" : "LOJA FECHADA"}
            </button>

            <div style={{ display: "flex", background: "#f0f0f0", padding: "5px", borderRadius: "15px" }}>
              <button onClick={() => setTab("cozinha")} style={{ padding: "10px 20px", border: "none", borderRadius: "12px", cursor: "pointer", background: tab === "cozinha" ? "#fff" : "transparent", fontWeight: "800", color: tab === "cozinha" ? "#111" : "#888", boxShadow: tab === "cozinha" ? "0 4px 12px rgba(0,0,0,0.05)" : "none" }}>🔥 Cozinha ({pedidos.filter(p => !p.status || p.status === "Pendente" || p.status === "Em Produção").length})</button>
              <button onClick={() => setTab("expedicao")} style={{ padding: "10px 20px", border: "none", borderRadius: "12px", cursor: "pointer", background: tab === "expedicao" ? "#fff" : "transparent", fontWeight: "800", color: tab === "expedicao" ? "#111" : "#888", boxShadow: tab === "expedicao" ? "0 4px 12px rgba(0,0,0,0.05)" : "none" }}>🚚 Expedição ({pedidos.filter(p => p.status === "Pronto" || p.status === "Saiu para Entrega").length})</button>
              <button onClick={() => setTab("concluidos")} style={{ padding: "10px 20px", border: "none", borderRadius: "12px", cursor: "pointer", background: tab === "concluidos" ? "#fff" : "transparent", fontWeight: "800", color: tab === "concluidos" ? "#111" : "#888", boxShadow: tab === "concluidos" ? "0 4px 12px rgba(0,0,0,0.05)" : "none" }}>✅ Finalizados</button>
            </div>

            {tab === "concluidos" && (
              <button onClick={limparFinalizados} style={{ background: "#ff5252", color: "#fff", border: "none", padding: "12px 24px", borderRadius: "14px", fontWeight: "800", cursor: "pointer" }}>🗑️ Limpar Lista</button>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right", background: "#fff", padding: "15px", borderRadius: "15px", border: "1px solid #eee" }}>
            <p style={{ fontSize: "14px", color: "#111", margin: 0, fontWeight: "700" }}>{currentUser.email}</p>
            <span style={{ fontSize: "11px", color: "#4caf50", fontWeight: "bold" }}>● Gestor 4.1.0 Online 🔊</span>
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: "center", padding: "100px", color: "#aaa", fontSize: "18px" }}>⌛ Carregando pedidos...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))", gap: "30px" }}>
          {pedidosFiltrados.map(pedido => (
            <div key={pedido.id} style={{ background: "#fff", border: "1px solid #eee", borderRadius: "25px", padding: "25px", boxShadow: "0 15px 35px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <span style={{ fontSize: "12px", fontWeight: "900", padding: "6px 15px", borderRadius: "50px", background: "#111", color: "#fff" }}>
                  {pedido.status ? pedido.status.toUpperCase() : "PENDENTE"}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "13px", color: "#bbb", fontWeight: "600" }}>{formatarData(pedido.data)}</span>
                  <button onClick={() => imprimirPedido(pedido)} style={{ background: "#f5f5f5", border: "none", padding: "8px 12px", borderRadius: "10px", cursor: "pointer", fontSize: "18px" }}>🖨️</button>
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <h3 style={{ margin: "0", fontSize: "22px", fontWeight: "800", color: "#111" }}>{pedido.userName}</h3>
                      
                      {/* --- NOVO DESIGN DO TELEFONE AMARELO --- */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {pedido.userPhone && (
                          <span style={{ fontSize: "14px", color: "#000", fontWeight: "900", background: "#ffca28", padding: "4px 12px", borderRadius: "8px", boxShadow: "0 4px 10px rgba(255, 202, 40, 0.3)" }}>
                            📞 {pedido.userPhone}
                          </span>
                        )}
                        <button 
                          onClick={() => {
                            let f = pedido.userPhone?.replace(/\D/g, "");
                            if (f && !f.startsWith("55")) f = `55${f}`;
                            if (f) window.open(`https://api.whatsapp.com/send?phone=${f}`, "_blank");
                          }} 
                          style={{ background: "#25D366", border: "none", borderRadius: "12px", width: "35px", height: "35px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", boxShadow: "0 4px 12px rgba(37, 211, 102, 0.2)" }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        </button>
                      </div>
                    </div>
                    <span style={{ fontSize: "11px", color: "#ddd", fontWeight: "bold" }}>#{pedido.id.slice(-4).toUpperCase()}</span>
                </div>
                
                <div style={{ marginTop: "15px", padding: "15px", borderRadius: "18px", background: pedido.tipoEntrega === "pickup" ? "#e3f2fd" : "#fff3e0", color: "#111", fontSize: "14px", border: "1px solid", borderColor: pedido.tipoEntrega === "pickup" ? "#bbdefb" : "#ffe0b2" }}>
                    <b>📍 {pedido.tipoEntrega === "pickup" ? "🥡 RETIRADA EM MÃOS" : "🛵 ENTREGA EM CASA"}</b><br/>
                    <div style={{ marginTop: "5px", fontWeight: "500" }}>{pedido.endereco}</div>
                </div>
              </div>

              <div style={{ background: "#f8f9fa", borderRadius: "20px", padding: "20px", marginBottom: "20px", flex: 1 }}>
                {Array.isArray(pedido.itens) ? (
                  pedido.itens.map((item: any, idx: number) => (
                    <div key={idx} style={{ marginBottom: "12px", borderBottom: idx !== (pedido.itens.length - 1) ? "1px solid #eee" : "none", paddingBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "16px", fontWeight: "700", color: "#111" }}>{item.quantity}x {item.name}</span>
                          <span style={{ fontSize: "14px", color: "#777", fontWeight: "600" }}>R$ {(Number(item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                      </div>
                      {Array.isArray(item.selectedAddons) && item.selectedAddons.length > 0 && (
                        <div style={{ fontSize: "12px", color: "#d32f2f", marginTop: "8px", fontWeight: "900", background: "#ffebee", padding: "6px 12px", borderRadius: "8px", display: "inline-block" }}>
                          + EXTRA: {item.selectedAddons.map((a: any) => a.name.toUpperCase()).join(", ")}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                    <div style={{ fontSize: "14px", color: "#999", textAlign: "center", padding: "20px" }}>⚠️ Nenhum item registrado.</div>
                )}
              </div>

              <div style={{ marginBottom: "25px", borderTop: "2px dashed #eee", paddingTop: "20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#888", fontSize: "14px", marginBottom: "8px", fontWeight: "600" }}>
                    <span>FORMA: {pedido.metodoPagamento?.toUpperCase()}</span>
                    {pedido.troco && <span>TROCO PARA: {pedido.troco}</span>}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "16px", fontWeight: "700", color: "#111" }}>Valor Total:</span>
                    <span style={{ fontSize: "28px", fontWeight: "900", color: "#111" }}>R$ {Number(pedido.total || 0).toFixed(2)}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px" }}>
                {tab === "cozinha" && (pedido.status === "Pendente" || !pedido.status) && <button onClick={() => updateStatus(pedido.id, "Em Produção")} style={{ flex: 1, padding: "16px", borderRadius: "16px", border: "2px solid #111", background: "#fff", color: "#111", fontWeight: "900", cursor: "pointer", fontSize: "14px", transition: "0.2s" }}>ACEITAR PEDIDO</button>}
                {tab === "cozinha" && pedido.status === "Em Produção" && <button onClick={() => updateStatus(pedido.id, "Pronto", pedido)} style={{ flex: 1, padding: "16px", borderRadius: "16px", border: "none", background: "#4caf50", color: "#fff", fontWeight: "900", cursor: "pointer", fontSize: "14px", boxShadow: "0 6px 15px rgba(76, 175, 80, 0.3)" }}>MARCAR COMO PRONTO</button>}
                {tab === "expedicao" && pedido.status === "Pronto" && (
                  pedido.tipoEntrega === "delivery" ? 
                  <button onClick={() => updateStatus(pedido.id, "Saiu para Entrega", pedido)} style={{ flex: 1, padding: "16px", borderRadius: "16px", border: "none", background: "#2196f3", color: "#fff", fontWeight: "900", cursor: "pointer", fontSize: "14px" }}>SAIU PARA ENTREGA</button> : 
                  <button onClick={() => updateStatus(pedido.id, "Finalizado")} style={{ flex: 1, padding: "16px", borderRadius: "16px", border: "none", background: "#111", color: "#fff", fontWeight: "900", cursor: "pointer", fontSize: "14px" }}>FINALIZAR RETIRADA</button>
                )}
                {tab === "expedicao" && pedido.status === "Saiu para Entrega" && <button onClick={() => updateStatus(pedido.id, "Finalizado")} style={{ flex: 1, padding: "16px", borderRadius: "16px", border: "none", background: "#111", color: "#fff", fontWeight: "900", cursor: "pointer", fontSize: "14px" }}>CONCLUIR PEDIDO</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      <style jsx global>{`
        @keyframes pulse {
          0% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
