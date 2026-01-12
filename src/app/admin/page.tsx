"use client";

import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  updateDoc, 
  doc 
} from "firebase/firestore";
import { useAuthStore } from "@/store/auth.store";

// --- FUNÇÃO DE DATA REVISADA (Dia/Mês e Hora) ---
const formatarData = (data: any) => {
  if (!data) return "--/-- --:--";
  try {
    if (typeof data.toDate === 'function') {
      const d = data.toDate();
      return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    const d = new Date(data.seconds ? data.seconds * 1000 : data);
    return isNaN(d.getTime()) ? "--/-- --:--" : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return "--/-- --:--";
  }
};

export default function AdminPage() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeOpen, setStoreOpen] = useState(true);
  const [tab, setTab] = useState<"ativos" | "concluidos">("ativos");
  const { currentUser } = useAuthStore();
  
  // Refs para controle do som e primeiro carregamento
  const prevPedidosCount = useRef(0);
  const isFirstLoad = useRef(true);

  const admins = [
    "alefejohsefe@gmail.com", 
    "kalebhstanley650@gmail.com", 
    "contato@dafamilialanches.com.br"
  ];

  // 🔊 FUNÇÃO PARA TOCAR ALERTA (Ding!)
  const playNotificationSound = () => {
    const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
    audio.play().catch(e => console.log("Aguardando interação para tocar som..."));
  };

  // 🖨️ FUNÇÃO DE IMPRESSÃO PROFISSIONAL (Versão Corrigida)
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
      <div style="border-bottom: 1px dashed #ccc; padding: 5px 0; font-size: 14px;">
        <b>${item.quantity || 1}x ${item.name || "Item"}</b><br/>
        ${item.selectedAddons?.map((a: any) => `<small>+ ${a.name}</small>`).join("<br/>") || ""}
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
          <p><b>DATA:</b> ${formatarData(pedido.data)}</p>
          <p><b>ENTREGA:</b> ${pedido.tipoEntrega === 'pickup' ? 'RETIRADA' : 'ENTREGA'}</p>
          <p><b>ENDEREÇO:</b> ${endereco}</p>
          <p>----------------------------</p>
          <div style="margin: 10px 0;">${itensHtml || "<p>Nenhum item no pedido</p>"}</div>
          <p>----------------------------</p>
          <p><b>PAGAMENTO:</b> ${pedido.metodoPagamento?.toUpperCase() || "N/A"}</p>
          ${pedido.troco ? `<p><b>TROCO PARA:</b> ${pedido.troco}</p>` : ""}
          <p style="font-size: 20px; margin-top:10px;"><b>TOTAL: R$ ${pedido.total ? pedido.total.toFixed(2) : "0.00"}</b></p>
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

  // 1. ESCUTAR PEDIDOS EM TEMPO REAL + LÓGICA DE SOM
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    const q = query(collection(db, "Pedidos"), orderBy("data", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const pedidosAtivosCount = docs.filter((p: any) => p.status !== "Finalizado").length;
      
      if (!isFirstLoad.current && pedidosAtivosCount > prevPedidosCount.current) {
        playNotificationSound();
      }
      
      prevPedidosCount.current = pedidosAtivosCount;
      isFirstLoad.current = false;
      
      setPedidos(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 2. ESCUTAR STATUS DA LOJA
  useEffect(() => {
    if (!currentUser || !admins.includes(currentUser.email!)) return;

    const unsub = onSnapshot(doc(db, "settings", "loja"), (snap) => {
      if (snap.exists()) setStoreOpen(snap.data().isOpen);
    });
    return () => unsub();
  }, [currentUser]);

  const toggleStore = async () => {
    try {
      await updateDoc(doc(db, "settings", "loja"), { isOpen: !storeOpen });
    } catch (e) { console.error(e); }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "Pedidos", id), { status: newStatus });
    } catch (e) { alert("Erro ao atualizar status"); }
  };

  const pedidosFiltrados = pedidos.filter(p => 
    tab === "ativos" ? p.status !== "Finalizado" : p.status === "Finalizado"
  );

  if (!currentUser || !admins.includes(currentUser.email!)) {
    return (
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "10px", fontFamily: "sans-serif" }}>
        <h1>Acesso Negado 🔐</h1>
        <button onClick={() => window.location.href = "/"} style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#111", color: "#fff", cursor: "pointer" }}>Voltar para o site</button>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto", fontFamily: "sans-serif", backgroundColor: "#fcfcfc", minHeight: "100vh" }}>
      
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px", borderBottom: "1px solid #eee", paddingBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "800", margin: 0, color: "#111" }}>📟 Monitor da Família</h1>
          
          <div style={{ display: "flex", gap: "15px", marginTop: "15px", alignItems: "center" }}>
            <button 
              onClick={toggleStore}
              style={{
                padding: "12px 24px", borderRadius: "12px", border: "none", fontWeight: "bold", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "10px",
                background: storeOpen ? "#4caf50" : "#f44336", color: "#fff",
                boxShadow: storeOpen ? "0 4px 15px rgba(76, 175, 80, 0.3)" : "0 4px 15px rgba(244, 67, 54, 0.3)",
              }}
            >
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#fff", boxShadow: "0 0 8px #fff" }}></div>
              {storeOpen ? "LOJA ABERTA" : "LOJA FECHADA"}
            </button>

            <div style={{ display: "flex", background: "#eee", padding: "4px", borderRadius: "12px" }}>
              <button 
                onClick={() => setTab("ativos")}
                style={{ padding: "8px 16px", border: "none", borderRadius: "10px", cursor: "pointer", background: tab === "ativos" ? "#fff" : "transparent", fontWeight: "bold", color: tab === "ativos" ? "#111" : "#666" }}
              >
                🔥 Na Cozinha ({pedidos.filter(p => p.status !== "Finalizado").length})
              </button>
              <button 
                onClick={() => setTab("concluidos")}
                style={{ padding: "8px 16px", border: "none", borderRadius: "10px", cursor: "pointer", background: tab === "concluidos" ? "#fff" : "transparent", fontWeight: "bold", color: tab === "concluidos" ? "#111" : "#666" }}
              >
                ✅ Finalizados
              </button>
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: "13px", color: "#444", margin: 0 }}><b>{currentUser.email}</b></p>
            <span style={{ fontSize: "11px", color: "#666" }}>Som de Alerta Ativo 🔊</span>
        </div>
      </header>

      {loading ? (
        <div style={{ textAlign: "center", padding: "50px", color: "#999" }}>Carregando dados da Família...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "25px" }}>
          {pedidosFiltrados.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "#999" }}>Nenhum pedido nesta aba.</div>
          )}
          
          {pedidosFiltrados.map(pedido => (
            <div key={pedido.id} style={{ 
              background: "#fff", border: "1px solid #eee", borderRadius: "20px", padding: "20px",
              boxShadow: "0 10px 20px rgba(0,0,0,0.03)", display: "flex", flexDirection: "column"
            }}>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
                <span style={{ 
                    fontSize: "11px", fontWeight: "800", padding: "5px 12px", borderRadius: "50px",
                    background: pedido.status === "Pendente" ? "#fff3e0" : (pedido.status === "Finalizado" ? "#e8f5e9" : "#e3f2fd"),
                    color: pedido.status === "Pendente" ? "#ef6c00" : (pedido.status === "Finalizado" ? "#2e7d32" : "#1565c0")
                  }}>
                    {pedido.status ? pedido.status.toUpperCase() : "PENDENTE"}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "12px", color: "#aaa", fontWeight: "600" }}>{formatarData(pedido.data)}</span>
                  <button onClick={() => imprimirPedido(pedido)} style={{ background: "#f5f5f5", border: "none", padding: "5px 8px", borderRadius: "8px", cursor: "pointer", fontSize: "16px" }}>🖨️</button>
                </div>
              </div>

              <div style={{ marginBottom: "15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <h3 style={{ margin: "0", fontSize: "20px", fontWeight: "700" }}>{pedido.userName}</h3>
                    <span style={{ fontSize: "10px", color: "#ccc" }}>#{pedido.id.slice(-4).toUpperCase()}</span>
                </div>
                <div style={{ marginTop: "10px", padding: "10px", borderRadius: "12px", background: "#fff3e0", color: "#444", fontSize: "13px", border: "1px solid #ffe0b2" }}>
                    <b>📍 {pedido.tipoEntrega === "pickup" ? "RETIRADA NO BALCÃO" : "ENTREGA"}</b><br/>
                    {pedido.endereco}
                </div>
              </div>

              <div style={{ background: "#f8f9fa", borderRadius: "15px", padding: "15px", marginBottom: "15px", flex: 1 }}>
                {Array.isArray(pedido.itens) && pedido.itens.map((item: any, idx: number) => (
                  <div key={idx} style={{ marginBottom: "10px", borderBottom: idx !== pedido.itens.length - 1 ? "1px solid #eee" : "none", paddingBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "14px", fontWeight: "600" }}>{item.quantity}x {item.name}</span>
                        <span style={{ fontSize: "13px", color: "#888" }}>R$ {(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                    {item.selectedAddons?.length > 0 && (
                      <div style={{ fontSize: "11px", color: "#d32f2f", marginTop: "3px" }}>
                        + {item.selectedAddons.map((a: any) => a.name).join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ marginBottom: "20px", borderTop: "2px dashed #eee", paddingTop: "15px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: "#666", fontSize: "13px", marginBottom: "5px" }}>
                    <span>{pedido.metodoPagamento?.toUpperCase()}</span>
                    {pedido.troco && <span>Troco: {pedido.troco}</span>}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "14px", fontWeight: "600" }}>Total:</span>
                    <span style={{ fontSize: "22px", fontWeight: "800", color: "#111" }}>{pedido.total?.toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'})}</span>
                </div>
              </div>

              {tab === "ativos" && (
                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={() => updateStatus(pedido.id, "Em Produção")} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "1px solid #ddd", background: "#fff", fontWeight: "700", cursor: "pointer" }}>Produzir</button>
                  <button onClick={() => updateStatus(pedido.id, "Finalizado")} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", background: "#111", color: "#fff", fontWeight: "700", cursor: "pointer" }}>Concluir</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
